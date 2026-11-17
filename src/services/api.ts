import { DEFAULT_AVATAR } from '../data/curriculumDefaults';
import {
  AvatarConfig,
  BuildingTemplate,
  MasteryLevel,
  StudentProgressRecord,
  UserProfile,
  UserRole,
  WorldData,
  WorldSnapshot,
  WorldSummary,
} from '../types/blockverse';
import { DEFAULT_STARTER_WORLDS } from './defaultWorldsClient';
import {
  isSupabaseEnabled,
  mapRowToWorld,
  mapWorldToRow,
  supabase,
  SupabaseWorldRow,
} from './supabaseClient';

const TOKEN_KEY = 'blockverse_auth_token';

export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

function generateCode(prefix: string, len = 4): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = prefix;
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function makeWorldSummary(w: WorldData): WorldSummary {
  return {
    id: w.id,
    worldCode: w.worldCode,
    title: w.title,
    description: w.description,
    worldType: w.worldType,
    ownerName: w.ownerName,
    teacherCode: w.teacherCode,
    isPublished: w.isPublished,
    allowStudentBuild: w.allowStudentBuild,
    maxPlayers: w.maxPlayers,
    stationCount: w.stations.length,
    musicCount: w.musicZones.length,
    updatedAt: w.updatedAt,
  };
}

function computeMastery(score: number, maxScore: number, completed: boolean): MasteryLevel {
  if (!completed && score === 0) return 'Belum Mula';
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (completed && ratio >= 0.85) return 'Cemerlang';
  if (completed && ratio >= 0.6) return 'Menguasai';
  return 'Dalam Latihan';
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error('Pelayan API tidak tersedia. Pastikan pemboleh ubah Supabase telah ditetapkan.');
  }
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : `Ralat pelayan (${res.status})`
    );
  }
  return data as T;
}

// ==========================================
// SUPABASE PROFILE & SEED HELPERS
// ==========================================

interface ProfileRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teacher_code: string | null;
  avatar: AvatarConfig;
  badges: string[];
  total_stars: number;
  created_at: string;
}

function mapProfileRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    ...(row.teacher_code ? { teacherCode: row.teacher_code } : {}),
    avatar: row.avatar?.avatarName ? row.avatar : { ...DEFAULT_AVATAR, avatarName: row.name },
    badges: Array.isArray(row.badges) ? row.badges : ['avatar_pereka'],
    totalStars: Number(row.total_stars ?? 10),
    createdAt: row.created_at,
  };
}

async function ensureStarterWorldsInSupabase(teacherProfile: UserProfile) {
  if (!supabase || teacherProfile.role !== 'guru') return;
  try {
    const { count, error } = await supabase
      .from('worlds')
      .select('id', { count: 'exact', head: true });
    if (error || (count ?? 0) > 0) return;

    const rows = DEFAULT_STARTER_WORLDS.map((w) =>
      mapWorldToRow({
        ...w,
        ownerId: teacherProfile.id,
        ownerName: teacherProfile.name,
        teacherCode: teacherProfile.teacherCode || 'GURU-0001',
      })
    );
    await supabase.from('worlds').upsert(rows, { onConflict: 'id' });
  } catch {
    // Ignore if schema is not initialized yet
  }
}

async function fetchOrCreateSupabaseProfile(authUser: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}): Promise<UserProfile> {
  if (!supabase) throw new Error('Supabase tidak dikonfigurasi.');

  const { data: existing, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error) {
    if (error.message.includes('profiles')) {
      throw new Error(
        'Jadual Supabase belum dicipta. Sila jalankan skrip supabase_schema.sql dalam SQL Editor Supabase anda terlebih dahulu.'
      );
    }
    throw new Error(error.message);
  }

  if (existing) {
    return mapProfileRow(existing as ProfileRow);
  }

  const meta = authUser.user_metadata || {};
  const role: UserRole = meta.role === 'guru' ? 'guru' : 'murid';
  const name = String(meta.name || authUser.email?.split('@')[0] || 'Pengguna');
  const teacherCode = role === 'guru' ? String(meta.teacher_code || generateCode('GURU-', 4)) : null;
  const avatar =
    (meta.avatar as AvatarConfig | undefined) || {
      ...DEFAULT_AVATAR,
      avatarName: name.slice(0, 18),
    };

  const newRow = {
    id: authUser.id,
    name,
    email: authUser.email || '',
    role,
    teacher_code: teacherCode,
    avatar,
    badges: ['avatar_pereka'],
    total_stars: 10,
  };

  const { data: inserted, error: insErr } = await supabase
    .from('profiles')
    .insert(newRow)
    .select('*')
    .single();

  if (insErr) throw new Error(insErr.message);
  const profile = mapProfileRow(inserted as ProfileRow);
  await ensureStarterWorldsInSupabase(profile);
  return profile;
}

// ==========================================
// PUBLIC UNIFIED API (SUPABASE OR EXPRESS)
// ==========================================

export async function getCurrentUser(): Promise<UserProfile | null> {
  if (isSupabaseEnabled() && supabase) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    try {
      return await fetchOrCreateSupabaseProfile(data.user);
    } catch {
      return null;
    }
  }
  try {
    const res = await apiFetch<{ user: UserProfile | null }>('/api/auth/me');
    return res.user ?? null;
  } catch {
    return null;
  }
}

export async function loginAccount(
  email: string,
  password: string
): Promise<{ user: UserProfile; token: string }> {
  if (isSupabaseEnabled() && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      throw new Error(
        error.message === 'Invalid login credentials'
          ? 'E-mel atau kata laluan tidak sah.'
          : error.message
      );
    }
    if (!data.user) throw new Error('Log masuk gagal.');
    const profile = await fetchOrCreateSupabaseProfile(data.user);
    await ensureStarterWorldsInSupabase(profile);
    return { user: profile, token: data.session?.access_token || '' };
  }

  const res = await apiFetch<{ user: UserProfile; token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setStoredToken(res.token);
  return res;
}

export async function registerAccount(payload: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  avatar?: AvatarConfig;
}): Promise<{ user: UserProfile; token: string }> {
  if (isSupabaseEnabled() && supabase) {
    const teacherCode = payload.role === 'guru' ? generateCode('GURU-', 4) : undefined;
    const avatarPayload = payload.avatar || {
      ...DEFAULT_AVATAR,
      avatarName: payload.name.trim().slice(0, 18),
    };
    const { data, error } = await supabase.auth.signUp({
      email: payload.email.trim(),
      password: payload.password,
      options: {
        data: {
          name: payload.name.trim(),
          role: payload.role,
          teacher_code: teacherCode,
          avatar: avatarPayload,
        },
      },
    });
    if (error) throw new Error(error.message);
    if (!data.session || !data.user) {
      throw new Error(
        'Pendaftaran berjaya! Sila sahkan pautan e-mel anda (atau matikan "Confirm email" di tetapan Auth Supabase untuk ujian pantas) sebelum log masuk.'
      );
    }
    const profile = await fetchOrCreateSupabaseProfile(data.user);
    await ensureStarterWorldsInSupabase(profile);
    return { user: profile, token: data.session.access_token };
  }

  const res = await apiFetch<{ user: UserProfile; token: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setStoredToken(res.token);
  return res;
}

export async function logoutAccount(): Promise<void> {
  if (isSupabaseEnabled() && supabase) {
    await supabase.auth.signOut();
    return;
  }
  await apiFetch('/api/auth/logout', { method: 'POST' });
  setStoredToken(null);
}

export async function saveAvatarToServer(avatar: AvatarConfig): Promise<UserProfile> {
  if (isSupabaseEnabled() && supabase) {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      throw new Error('Sila log masuk akaun terlebih dahulu untuk menyimpan avatar.');
    }
    const profile = await fetchOrCreateSupabaseProfile(authData.user);
    const nextAvatar: AvatarConfig = {
      ...avatar,
      avatarName: avatar.avatarName.trim().slice(0, 24) || profile.name,
    };
    const nextBadges = profile.badges.includes('avatar_pereka')
      ? profile.badges
      : [...profile.badges, 'avatar_pereka'];

    const { data, error } = await supabase
      .from('profiles')
      .update({ avatar: nextAvatar, badges: nextBadges })
      .eq('id', authData.user.id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return mapProfileRow(data as ProfileRow);
  }

  const res = await apiFetch<{ user: UserProfile }>('/api/avatar', {
    method: 'PUT',
    body: JSON.stringify(avatar),
  });
  return res.user;
}

export async function listWorlds(): Promise<WorldSummary[]> {
  if (isSupabaseEnabled() && supabase) {
    const { data, error } = await supabase
      .from('worlds')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return DEFAULT_STARTER_WORLDS.map(makeWorldSummary);
    }
    return (data as SupabaseWorldRow[]).map(mapRowToWorld).map(makeWorldSummary);
  }

  try {
    const res = await apiFetch<{ worlds?: WorldSummary[] }>('/api/worlds');
    if (Array.isArray(res.worlds) && res.worlds.length > 0) {
      return res.worlds;
    }
  } catch {
    // Fallback to starter worlds on static hosting
  }
  return DEFAULT_STARTER_WORLDS.map(makeWorldSummary);
}

export async function loadWorldByCode(worldCode: string): Promise<WorldData> {
  const code = worldCode.trim().toUpperCase();
  if (isSupabaseEnabled() && supabase) {
    const { data, error } = await supabase
      .from('worlds')
      .select('*')
      .eq('world_code', code)
      .maybeSingle();

    if (!error && data) {
      return mapRowToWorld(data as SupabaseWorldRow);
    }
    const starter = DEFAULT_STARTER_WORLDS.find((w) => w.worldCode.toUpperCase() === code);
    if (starter) return starter;
    throw new Error(`Kod Dunia "${code}" tidak dijumpai.`);
  }

  try {
    const res = await apiFetch<{ world?: WorldData }>(
      `/api/worlds/by-code/${encodeURIComponent(code)}`
    );
    if (res.world) return res.world;
  } catch {
    const starter = DEFAULT_STARTER_WORLDS.find((w) => w.worldCode.toUpperCase() === code);
    if (starter) return starter;
  }
  throw new Error(`Kod Dunia "${code}" tidak dijumpai.`);
}

export async function createNewWorld(payload: {
  title: string;
  description: string;
  worldType: WorldData['worldType'];
}): Promise<WorldData> {
  if (isSupabaseEnabled() && supabase) {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('Sila log masuk akaun Guru terlebih dahulu.');
    const profile = await fetchOrCreateSupabaseProfile(authData.user);
    if (profile.role !== 'guru') {
      throw new Error('Hanya akaun Guru dibenarkan mencipta dunia baharu.');
    }

    const worldCode = generateCode('BM', 4);
    const newWorld: WorldData = {
      id: `wld_${crypto.randomUUID().slice(0, 8)}`,
      worldCode,
      title: payload.title.trim(),
      description:
        payload.description.trim() || 'Dunia pembelajaran bahasa baharu binaan guru.',
      worldType: payload.worldType || 'kreatif',
      ownerId: profile.id,
      ownerName: profile.name,
      teacherCode: profile.teacherCode || 'GURU-0001',
      isPublished: true,
      allowStudentBuild: false,
      maxPlayers: 25,
      dayTimeMode: 'siang',
      blocks: [],
      structures: [
        {
          id: `str_studio_${Date.now()}`,
          kind: 'studio_avatar',
          name: 'Studio Avatar Sekolah Malaysia',
          x: -10,
          y: 0,
          z: -6,
        },
      ],
      npcs: [],
      stations: [],
      musicZones: [],
      signs: [
        {
          id: `sign_${Date.now()}`,
          title: payload.title.trim(),
          message: 'Selamat datang ke dunia baharu ciptaan guru!',
          x: 2,
          y: 0,
          z: 2,
        },
      ],
      customUniforms: [],
      snapshots: [],
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('worlds')
      .insert(mapWorldToRow(newWorld))
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return mapRowToWorld(data as SupabaseWorldRow);
  }

  const res = await apiFetch<{ world: WorldData }>('/api/worlds', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.world;
}

export async function updateWorldOnServer(
  worldId: string,
  patch: Partial<WorldData>
): Promise<WorldData> {
  if (isSupabaseEnabled() && supabase) {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('Sila log masuk sebagai Guru terlebih dahulu.');
    const profile = await fetchOrCreateSupabaseProfile(authData.user);
    if (profile.role !== 'guru') {
      throw new Error('Akses ditolak: Hanya Guru boleh menyunting dunia.');
    }

    const { data: existingRow } = await supabase
      .from('worlds')
      .select('*')
      .eq('id', worldId)
      .maybeSingle();

    const existing = existingRow
      ? mapRowToWorld(existingRow as SupabaseWorldRow)
      : DEFAULT_STARTER_WORLDS.find((w) => w.id === worldId);

    if (!existing) throw new Error('Dunia tidak dijumpai.');
    if (existing.ownerId && existing.ownerId !== profile.id) {
      throw new Error('Akses ditolak: Anda hanya boleh menyunting dunia milik anda sendiri.');
    }

    const nextWorld: WorldData = {
      ...existing,
      ...patch,
      ownerId: existing.ownerId || profile.id,
      ownerName: existing.ownerId ? existing.ownerName : profile.name,
      teacherCode: existing.ownerId ? existing.teacherCode : profile.teacherCode || 'GURU-0001',
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('worlds')
      .upsert(mapWorldToRow(nextWorld), { onConflict: 'id' })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    const saved = mapRowToWorld(data as SupabaseWorldRow);

    // Broadcast live world update via Supabase Realtime
    const ch = supabase.channel(`blockverse:${saved.worldCode}`);
    await ch.send({ type: 'broadcast', event: 'world:update', payload: { world: saved } }).catch(() => {});

    return saved;
  }

  const res = await apiFetch<{ world: WorldData }>(`/api/worlds/${worldId}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
  return res.world;
}

export async function updateStudentBlocks(
  worldId: string,
  blocks: WorldData['blocks']
): Promise<WorldData> {
  if (isSupabaseEnabled() && supabase) {
    const { data, error } = await supabase.rpc('update_student_blocks', {
      p_world_id: worldId,
      p_blocks: blocks,
    });
    if (error) throw new Error(error.message);
    return mapRowToWorld(data as SupabaseWorldRow);
  }

  const res = await apiFetch<{ world: WorldData }>(
    `/api/worlds/${worldId}/student-blocks`,
    {
      method: 'POST',
      body: JSON.stringify({ blocks }),
    }
  );
  return res.world;
}

export async function createWorldSnapshot(worldId: string, note: string) {
  if (isSupabaseEnabled() && supabase) {
    const { data: row, error } = await supabase
      .from('worlds')
      .select('*')
      .eq('id', worldId)
      .single();
    if (error || !row) throw new Error('Dunia tidak dijumpai.');
    const existing = mapRowToWorld(row as SupabaseWorldRow);
    const snap: WorldSnapshot = {
      id: `snp_${crypto.randomUUID().slice(0, 8)}`,
      savedAt: new Date().toISOString(),
      note: note.trim() || `Titik Pulih Versi ${existing.version}`,
      blocks: existing.blocks,
      structures: existing.structures,
      npcs: existing.npcs,
      stations: existing.stations,
      musicZones: existing.musicZones,
      signs: existing.signs,
    };
    const nextSnaps = [snap, ...existing.snapshots].slice(0, 12);
    await updateWorldOnServer(worldId, { snapshots: nextSnaps });
    return { snapshot: snap, snapshots: nextSnaps };
  }

  return apiFetch<{ snapshot: WorldData['snapshots'][0]; snapshots: WorldData['snapshots'] }>(
    `/api/worlds/${worldId}/snapshot`,
    {
      method: 'POST',
      body: JSON.stringify({ note }),
    }
  );
}

export async function restoreWorldSnapshot(worldId: string, snapshotId: string) {
  if (isSupabaseEnabled() && supabase) {
    const { data: row, error } = await supabase
      .from('worlds')
      .select('*')
      .eq('id', worldId)
      .single();
    if (error || !row) throw new Error('Dunia tidak dijumpai.');
    const existing = mapRowToWorld(row as SupabaseWorldRow);
    const snap = existing.snapshots.find((s) => s.id === snapshotId);
    if (!snap) throw new Error('Titik pemulihan tidak dijumpai.');
    return updateWorldOnServer(worldId, {
      blocks: snap.blocks,
      structures: snap.structures,
      npcs: snap.npcs,
      stations: snap.stations,
      musicZones: snap.musicZones,
      signs: snap.signs,
    });
  }

  const res = await apiFetch<{ world: WorldData }>(
    `/api/worlds/${worldId}/restore/${snapshotId}`,
    { method: 'POST' }
  );
  return res.world;
}

export async function listTemplates(): Promise<BuildingTemplate[]> {
  if (isSupabaseEnabled() && supabase) {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return [];
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('owner_id', authData.user.id)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map((t) => ({
      id: t.id,
      ownerId: t.owner_id,
      name: t.name,
      category: t.category,
      blocks: t.blocks || [],
      structures: t.structures || [],
      createdAt: t.created_at,
    }));
  }

  const res = await apiFetch<{ templates: BuildingTemplate[] }>('/api/templates');
  return res.templates;
}

export async function saveTemplate(payload: {
  name: string;
  category: string;
  blocks: WorldData['blocks'];
  structures: WorldData['structures'];
}): Promise<BuildingTemplate> {
  if (isSupabaseEnabled() && supabase) {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('Sila log masuk akaun Guru.');
    const row = {
      id: `tpl_${crypto.randomUUID().slice(0, 8)}`,
      owner_id: authData.user.id,
      name: payload.name.trim(),
      category: payload.category.trim() || 'Binaan Guru',
      blocks: payload.blocks,
      structures: payload.structures,
    };
    const { data, error } = await supabase
      .from('templates')
      .insert(row)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return {
      id: data.id,
      ownerId: data.owner_id,
      name: data.name,
      category: data.category,
      blocks: data.blocks || [],
      structures: data.structures || [],
      createdAt: data.created_at,
    };
  }

  const res = await apiFetch<{ template: BuildingTemplate }>('/api/templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.template;
}

export async function uploadMediaFile(file: File): Promise<{ url: string; filename: string }> {
  if (isSupabaseEnabled() && supabase) {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('Sila log masuk sebagai Guru untuk memuat naik fail.');
    const safeExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const filePath = `${authData.user.id}/${Date.now()}_${crypto.randomUUID().slice(0, 6)}.${safeExt}`;
    const { error } = await supabase.storage
      .from('blockverse-media')
      .upload(filePath, file, { upsert: false });
    if (error) throw new Error(error.message);

    const { data: pub } = supabase.storage.from('blockverse-media').getPublicUrl(filePath);
    return { url: pub.publicUrl, filename: file.name };
  }

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca fail'));
    reader.readAsDataURL(file);
  });

  return apiFetch<{ url: string; filename: string }>('/api/upload', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, dataBase64: base64 }),
  });
}

export async function recordStudentProgress(payload: {
  worldId: string;
  stationId: string;
  stationTitle: string;
  expression: string;
  category: StudentProgressRecord['category'];
  score: number;
  maxScore: number;
  attempts: number;
  wrongAttempts: number;
  completed: boolean;
  timeSpentSeconds: number;
  unmasteredQuestions: string[];
  historyEntry?: StudentProgressRecord['history'][0];
  badgeUnlocked?: string;
}) {
  if (isSupabaseEnabled() && supabase) {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('Sila log masuk untuk merekod kemajuan.');
    const profile = await fetchOrCreateSupabaseProfile(authData.user);

    const { data: worldRow } = await supabase
      .from('worlds')
      .select('id, world_code, title')
      .eq('id', payload.worldId)
      .maybeSingle();

    const worldCode = worldRow?.world_code || 'KAMPUNG01';
    const worldTitle = worldRow?.title || 'Dunia Bahasa Blockverse';

    const { data: existing } = await supabase
      .from('student_progress')
      .select('*')
      .eq('student_id', profile.id)
      .eq('world_id', payload.worldId)
      .eq('station_id', payload.stationId)
      .maybeSingle();

    const prevScore = existing ? Number(existing.score || 0) : 0;
    const bestScore = Math.max(prevScore, payload.score);
    const deltaScore = Math.max(0, bestScore - prevScore);
    const nextCompleted = Boolean(existing?.completed || payload.completed);
    const nextHistory = [
      ...((existing?.history as StudentProgressRecord['history']) || []),
      ...(payload.historyEntry ? [payload.historyEntry] : []),
    ];

    const recordRow = {
      id: existing?.id || `prg_${crypto.randomUUID().slice(0, 8)}`,
      student_id: profile.id,
      student_name: profile.name,
      avatar_summary: {
        uniformOption: profile.avatar.uniformOption,
        skinColor: profile.avatar.skinColor,
        hairColor: profile.avatar.hairColor,
        avatarName: profile.avatar.avatarName,
      },
      world_id: payload.worldId,
      world_code: worldCode,
      world_title: worldTitle,
      station_id: payload.stationId,
      station_title: payload.stationTitle,
      expression: payload.expression,
      category: payload.category,
      score: bestScore,
      max_score: Math.max(1, payload.maxScore),
      attempts: (existing?.attempts || 0) + payload.attempts,
      wrong_attempts: (existing?.wrong_attempts || 0) + payload.wrongAttempts,
      completed: nextCompleted,
      mastery_level: computeMastery(bestScore, payload.maxScore, nextCompleted),
      time_spent_seconds: (existing?.time_spent_seconds || 0) + payload.timeSpentSeconds,
      unmastered_questions: payload.unmasteredQuestions,
      history: nextHistory,
      updated_at: new Date().toISOString(),
    };

    const { data: savedRow, error: saveErr } = await supabase
      .from('student_progress')
      .upsert(recordRow, { onConflict: 'student_id,world_id,station_id' })
      .select('*')
      .single();

    if (saveErr) throw new Error(saveErr.message);

    // Update student stars & badges
    const nextStars = profile.totalStars + deltaScore;
    const nextBadges = [...profile.badges];
    if (payload.badgeUnlocked && !nextBadges.includes(payload.badgeUnlocked)) {
      nextBadges.push(payload.badgeUnlocked);
    }

    const { data: allMyProg } = await supabase
      .from('student_progress')
      .select('category, completed')
      .eq('student_id', profile.id)
      .eq('completed', true);

    const completedList = allMyProg || [];
    if (
      completedList.filter((p) => p.category === 'Simpulan Bahasa').length >= 3 &&
      !nextBadges.includes('peneroka_kampung')
    ) {
      nextBadges.push('peneroka_kampung');
    }
    if (
      completedList.filter((p) => p.category === 'Perumpamaan').length >= 2 &&
      !nextBadges.includes('penjaga_hutan')
    ) {
      nextBadges.push('penjaga_hutan');
    }
    if (
      completedList.filter((p) => p.category === 'Pepatah' || p.category === 'Bidalan').length >= 2 &&
      !nextBadges.includes('pendeta_istana')
    ) {
      nextBadges.push('pendeta_istana');
    }

    await supabase
      .from('profiles')
      .update({ total_stars: nextStars, badges: nextBadges })
      .eq('id', profile.id);

    return {
      record: mapProgressRow(savedRow),
      badges: nextBadges,
      totalStars: nextStars,
    };
  }

  return apiFetch<{
    record: StudentProgressRecord;
    badges: string[];
    totalStars: number;
  }>('/api/progress', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function mapProgressRow(row: Record<string, unknown>): StudentProgressRecord {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    studentName: String(row.student_name),
    avatarSummary: row.avatar_summary as StudentProgressRecord['avatarSummary'],
    worldId: String(row.world_id),
    worldCode: String(row.world_code),
    worldTitle: String(row.world_title),
    stationId: String(row.station_id),
    stationTitle: String(row.station_title),
    expression: String(row.expression),
    category: row.category as StudentProgressRecord['category'],
    score: Number(row.score || 0),
    maxScore: Number(row.max_score || 20),
    attempts: Number(row.attempts || 1),
    wrongAttempts: Number(row.wrong_attempts || 0),
    completed: Boolean(row.completed),
    masteryLevel: row.mastery_level as MasteryLevel,
    timeSpentSeconds: Number(row.time_spent_seconds || 0),
    unmasteredQuestions: (row.unmastered_questions as string[]) || [],
    history: (row.history as StudentProgressRecord['history']) || [],
    updatedAt: String(row.updated_at),
  };
}

export async function getMyProgress(): Promise<StudentProgressRecord[]> {
  if (isSupabaseEnabled() && supabase) {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return [];
    const { data } = await supabase
      .from('student_progress')
      .select('*')
      .eq('student_id', authData.user.id);
    return (data || []).map(mapProgressRow);
  }

  const res = await apiFetch<{ records: StudentProgressRecord[] }>('/api/progress/me');
  return res.records;
}

export async function getTeacherAnalytics(): Promise<{
  worlds: WorldSummary[];
  records: StudentProgressRecord[];
}> {
  if (isSupabaseEnabled() && supabase) {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('Sila log masuk akaun Guru.');
    const { data: myWorldsRows } = await supabase
      .from('worlds')
      .select('*')
      .eq('owner_id', authData.user.id);

    const worlds = (myWorldsRows as SupabaseWorldRow[] | null)?.map(mapRowToWorld) || [];
    const worldIds = worlds.map((w) => w.id);
    if (worldIds.length === 0) {
      return { worlds: [], records: [] };
    }

    const { data: progRows } = await supabase
      .from('student_progress')
      .select('*')
      .in('world_id', worldIds)
      .order('updated_at', { ascending: false });

    return {
      worlds: worlds.map(makeWorldSummary),
      records: (progRows || []).map(mapProgressRow),
    };
  }

  return apiFetch<{ worlds: WorldSummary[]; records: StudentProgressRecord[] }>(
    '/api/teacher/analytics'
  );
}
