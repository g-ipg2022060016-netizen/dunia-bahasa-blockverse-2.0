import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import {
  AuthenticatedRequest,
  attachOptionalUser,
  COOKIE_NAME,
  requireAuth,
  requireTeacher,
  sanitizeUser,
  signToken,
  verifyToken,
} from './server/auth';
import { getDb, saveDb, UPLOADS_DIR } from './server/db';
import { DEFAULT_AVATAR } from './src/data/curriculumDefaults';
import {
  AvatarConfig,
  GroupQuestState,
  MasteryLevel,
  RemotePlayerState,
  StudentProgressRecord,
  UserRole,
  WorldData,
  WorldSnapshot,
  WorldSummary,
} from './src/types/blockverse';

const PORT = Number(process.env.PORT || 3000);
const app = express();
app.use(express.json({ limit: '20mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(attachOptionalUser);

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

function generateCode(prefix: string, len = 4): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = prefix;
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role, avatar } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    role?: UserRole;
    avatar?: AvatarConfig;
  };

  if (!name || !email || !password || (role !== 'guru' && role !== 'murid')) {
    res.status(400).json({ error: 'Sila lengkapkan nama, e-mel, kata laluan dan peranan.' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Kata laluan mestilah sekurang-kurangnya 6 aksara.' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const db = getDb();
  if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    res.status(409).json({ error: 'E-mel ini sudah didaftarkan. Sila log masuk.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = `usr_${crypto.randomUUID().slice(0, 8)}`;
  const teacherCode = role === 'guru' ? generateCode('GURU-', 4) : undefined;
  const newUser = {
    id,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role,
    ...(teacherCode ? { teacherCode } : {}),
    avatar: avatar || { ...DEFAULT_AVATAR, avatarName: name.trim().slice(0, 18) },
    badges: ['avatar_pereka'],
    totalStars: 10,
    createdAt: new Date().toISOString(),
  };

  await saveDb((draft) => {
    draft.users.push(newUser);
  });

  const token = signToken({
    userId: newUser.id,
    role: newUser.role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14,
  });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 14,
  });
  res.json({ user: sanitizeUser(newUser), token });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Sila masukkan e-mel dan kata laluan.' });
    return;
  }
  const db = getDb();
  const found = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!found || !(await bcrypt.compare(password, found.passwordHash))) {
    res.status(401).json({ error: 'E-mel atau kata laluan tidak sah.' });
    return;
  }

  const token = signToken({
    userId: found.id,
    role: found.role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14,
  });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 14,
  });
  res.json({ user: sanitizeUser(found), token });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/auth/me', (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.json({ user: null });
    return;
  }
  res.json({ user: req.user });
});

// ==========================================
// AVATAR & BADGES ENDPOINTS
// ==========================================

app.put('/api/avatar', requireAuth, async (req: AuthenticatedRequest, res) => {
  const avatar = req.body as AvatarConfig;
  if (!avatar || typeof avatar.avatarName !== 'string' || !avatar.uniformOption) {
    res.status(400).json({ error: 'Data avatar tidak lengkap.' });
    return;
  }

  let updatedUser = req.user!;
  await saveDb((draft) => {
    const idx = draft.users.findIndex((u) => u.id === req.user!.id);
    if (idx !== -1) {
      draft.users[idx].avatar = {
        ...avatar,
        avatarName: avatar.avatarName.trim().slice(0, 24) || draft.users[idx].name,
      };
      if (!draft.users[idx].badges.includes('avatar_pereka')) {
        draft.users[idx].badges.push('avatar_pereka');
      }
      updatedUser = sanitizeUser(draft.users[idx]);
    }
  });

  res.json({ user: updatedUser });
});

// ==========================================
// WORLDS ENDPOINTS (CENTRALIZED SYNC + RBAC)
// ==========================================

app.get('/api/worlds', (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const visible = db.worlds.filter(
    (w) => w.isPublished || (req.user && w.ownerId === req.user.id)
  );
  res.json({ worlds: visible.map(makeWorldSummary) });
});

app.get('/api/worlds/by-code/:worldCode', (req: AuthenticatedRequest, res) => {
  const code = String(req.params.worldCode || '').trim().toUpperCase();
  const db = getDb();
  const world = db.worlds.find((w) => w.worldCode.toUpperCase() === code);
  if (!world) {
    res.status(404).json({ error: `Kod Dunia "${code}" tidak dijumpai.` });
    return;
  }
  if (!world.isPublished && (!req.user || world.ownerId !== req.user.id)) {
    res.status(403).json({
      error: 'Dunia ini belum diterbitkan oleh guru pemiliknya.',
    });
    return;
  }
  res.json({ world });
});

app.post('/api/worlds', requireTeacher, async (req: AuthenticatedRequest, res) => {
  const { title, description, worldType } = req.body as {
    title?: string;
    description?: string;
    worldType?: WorldData['worldType'];
  };
  if (!title || !title.trim()) {
    res.status(400).json({ error: 'Sila masukkan nama dunia.' });
    return;
  }
  const db = getDb();
  let worldCode = generateCode('BM', 4);
  while (db.worlds.some((w) => w.worldCode === worldCode)) {
    worldCode = generateCode('BM', 4);
  }

  const newWorld: WorldData = {
    id: `wld_${crypto.randomUUID().slice(0, 8)}`,
    worldCode,
    title: title.trim(),
    description:
      (description || '').trim() ||
      'Dunia pembelajaran bahasa baharu binaan guru.',
    worldType: worldType || 'kreatif',
    ownerId: req.user!.id,
    ownerName: req.user!.name,
    teacherCode: req.user!.teacherCode || 'GURU-0001',
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
        title: title.trim(),
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

  await saveDb((draft) => {
    draft.worlds.push(newWorld);
  });

  res.status(201).json({ world: newWorld });
});

app.put('/api/worlds/:worldId', requireTeacher, async (req: AuthenticatedRequest, res) => {
  const { worldId } = req.params;
  const db = getDb();
  const existing = db.worlds.find((w) => w.id === worldId);
  if (!existing) {
    res.status(404).json({ error: 'Dunia tidak dijumpai.' });
    return;
  }
  if (existing.ownerId !== req.user!.id) {
    res.status(403).json({
      error: 'Akses ditolak: Anda hanya boleh menyunting dunia milik anda sendiri.',
    });
    return;
  }

  const patch = req.body as Partial<WorldData>;
  let updatedWorld: WorldData = existing;

  await saveDb((draft) => {
    const idx = draft.worlds.findIndex((w) => w.id === worldId);
    if (idx !== -1) {
      const prev = draft.worlds[idx];
      updatedWorld = {
        ...prev,
        title: typeof patch.title === 'string' && patch.title.trim() ? patch.title.trim() : prev.title,
        description: typeof patch.description === 'string' ? patch.description : prev.description,
        isPublished: typeof patch.isPublished === 'boolean' ? patch.isPublished : prev.isPublished,
        allowStudentBuild:
          typeof patch.allowStudentBuild === 'boolean'
            ? patch.allowStudentBuild
            : prev.allowStudentBuild,
        maxPlayers:
          typeof patch.maxPlayers === 'number'
            ? Math.max(2, Math.min(50, patch.maxPlayers))
            : prev.maxPlayers,
        dayTimeMode: patch.dayTimeMode || prev.dayTimeMode,
        blocks: Array.isArray(patch.blocks) ? patch.blocks : prev.blocks,
        structures: Array.isArray(patch.structures) ? patch.structures : prev.structures,
        npcs: Array.isArray(patch.npcs) ? patch.npcs : prev.npcs,
        stations: Array.isArray(patch.stations) ? patch.stations : prev.stations,
        musicZones: Array.isArray(patch.musicZones) ? patch.musicZones : prev.musicZones,
        signs: Array.isArray(patch.signs) ? patch.signs : prev.signs,
        customUniforms: Array.isArray(patch.customUniforms)
          ? patch.customUniforms
          : prev.customUniforms,
        version: prev.version + 1,
        updatedAt: new Date().toISOString(),
      };
      draft.worlds[idx] = updatedWorld;
    }
  });

  broadcastToWorld(updatedWorld.worldCode, {
    type: 'world:update',
    world: updatedWorld,
  });

  res.json({ world: updatedWorld });
});

app.post('/api/worlds/:worldId/student-blocks', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { worldId } = req.params;
  const db = getDb();
  const existing = db.worlds.find((w) => w.id === worldId);
  if (!existing) {
    res.status(404).json({ error: 'Dunia tidak dijumpai.' });
    return;
  }
  if (!existing.allowStudentBuild && existing.ownerId !== req.user!.id) {
    res.status(403).json({
      error: 'Guru tidak mengaktifkan mod membina untuk murid di dunia ini.',
    });
    return;
  }
  const { blocks } = req.body as { blocks?: WorldData['blocks'] };
  if (!Array.isArray(blocks)) {
    res.status(400).json({ error: 'Senarai blok tidak sah.' });
    return;
  }

  let updatedWorld = existing;
  await saveDb((draft) => {
    const idx = draft.worlds.findIndex((w) => w.id === worldId);
    if (idx !== -1) {
      draft.worlds[idx].blocks = blocks;
      draft.worlds[idx].version += 1;
      draft.worlds[idx].updatedAt = new Date().toISOString();
      updatedWorld = draft.worlds[idx];
    }
  });

  broadcastToWorld(updatedWorld.worldCode, {
    type: 'world:update',
    world: updatedWorld,
  });
  res.json({ world: updatedWorld });
});

app.post('/api/worlds/:worldId/snapshot', requireTeacher, async (req: AuthenticatedRequest, res) => {
  const { worldId } = req.params;
  const { note } = req.body as { note?: string };
  const db = getDb();
  const existing = db.worlds.find((w) => w.id === worldId);
  if (!existing) {
    res.status(404).json({ error: 'Dunia tidak dijumpai.' });
    return;
  }
  if (existing.ownerId !== req.user!.id) {
    res.status(403).json({ error: 'Akses ditolak.' });
    return;
  }

  const snap: WorldSnapshot = {
    id: `snp_${crypto.randomUUID().slice(0, 8)}`,
    savedAt: new Date().toISOString(),
    note: (note || '').trim() || `Titik Pulih Versi ${existing.version}`,
    blocks: existing.blocks,
    structures: existing.structures,
    npcs: existing.npcs,
    stations: existing.stations,
    musicZones: existing.musicZones,
    signs: existing.signs,
  };

  let updatedWorld = existing;
  await saveDb((draft) => {
    const idx = draft.worlds.findIndex((w) => w.id === worldId);
    if (idx !== -1) {
      draft.worlds[idx].snapshots = [snap, ...draft.worlds[idx].snapshots].slice(0, 12);
      updatedWorld = draft.worlds[idx];
    }
  });

  res.json({ snapshot: snap, snapshots: updatedWorld.snapshots });
});

app.post('/api/worlds/:worldId/restore/:snapshotId', requireTeacher, async (req: AuthenticatedRequest, res) => {
  const { worldId, snapshotId } = req.params;
  const db = getDb();
  const existing = db.worlds.find((w) => w.id === worldId);
  if (!existing) {
    res.status(404).json({ error: 'Dunia tidak dijumpai.' });
    return;
  }
  if (existing.ownerId !== req.user!.id) {
    res.status(403).json({ error: 'Akses ditolak.' });
    return;
  }
  const snap = existing.snapshots.find((s) => s.id === snapshotId);
  if (!snap) {
    res.status(404).json({ error: 'Titik pemulihan tidak dijumpai.' });
    return;
  }

  let updatedWorld = existing;
  await saveDb((draft) => {
    const idx = draft.worlds.findIndex((w) => w.id === worldId);
    if (idx !== -1) {
      draft.worlds[idx].blocks = snap.blocks;
      draft.worlds[idx].structures = snap.structures;
      draft.worlds[idx].npcs = snap.npcs;
      draft.worlds[idx].stations = snap.stations;
      draft.worlds[idx].musicZones = snap.musicZones;
      draft.worlds[idx].signs = snap.signs;
      draft.worlds[idx].version += 1;
      draft.worlds[idx].updatedAt = new Date().toISOString();
      updatedWorld = draft.worlds[idx];
    }
  });

  broadcastToWorld(updatedWorld.worldCode, {
    type: 'world:update',
    world: updatedWorld,
  });

  res.json({ world: updatedWorld });
});

// ==========================================
// TEMPLATES & FILE UPLOADS
// ==========================================

app.get('/api/templates', requireTeacher, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const list = db.templates.filter((t) => t.ownerId === req.user!.id);
  res.json({ templates: list });
});

app.post('/api/templates', requireTeacher, async (req: AuthenticatedRequest, res) => {
  const { name, category, blocks, structures } = req.body as {
    name?: string;
    category?: string;
    blocks?: WorldData['blocks'];
    structures?: WorldData['structures'];
  };
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Sila masukkan nama templat.' });
    return;
  }
  const tpl = {
    id: `tpl_${crypto.randomUUID().slice(0, 8)}`,
    ownerId: req.user!.id,
    name: name.trim(),
    category: (category || '').trim() || 'Binaan Guru',
    blocks: Array.isArray(blocks) ? blocks : [],
    structures: Array.isArray(structures) ? structures : [],
    createdAt: new Date().toISOString(),
  };
  await saveDb((draft) => {
    draft.templates.unshift(tpl);
  });
  res.status(201).json({ template: tpl });
});

const ALLOWED_EXTS = new Set([
  '.mp3',
  '.wav',
  '.ogg',
  '.webm',
  '.m4a',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.pdf',
]);

app.post('/api/upload', requireTeacher, async (req: AuthenticatedRequest, res) => {
  const { filename, dataBase64 } = req.body as {
    filename?: string;
    dataBase64?: string;
  };
  if (!filename || !dataBase64) {
    res.status(400).json({ error: 'Fail muat naik tidak lengkap.' });
    return;
  }
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    res.status(400).json({
      error: 'Format fail tidak disokong. Sila muat naik MP3, WAV, OGG, WebM, PNG, JPG atau PDF.',
    });
    return;
  }

  const cleanBase64 = dataBase64.includes(',') ? dataBase64.split(',')[1] : dataBase64;
  const buffer = Buffer.from(cleanBase64, 'base64');
  if (buffer.length > 15 * 1024 * 1024) {
    res.status(413).json({ error: 'Saiz fail melebihi had maksimum 15 MB.' });
    return;
  }

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  const safeName = `${Date.now()}_${crypto.randomUUID().slice(0, 6)}${ext}`;
  const fullPath = path.join(UPLOADS_DIR, safeName);
  await fs.promises.writeFile(fullPath, buffer);
  res.json({ url: `/uploads/${safeName}`, filename: safeName });
});

// ==========================================
// STUDENT PROGRESS & TEACHER ANALYTICS
// ==========================================

function computeMastery(score: number, maxScore: number, completed: boolean): MasteryLevel {
  if (!completed && score === 0) return 'Belum Mula';
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (completed && ratio >= 0.85) return 'Cemerlang';
  if (completed && ratio >= 0.6) return 'Menguasai';
  return 'Dalam Latihan';
}

app.post('/api/progress', requireAuth, async (req: AuthenticatedRequest, res) => {
  const {
    worldId,
    stationId,
    stationTitle,
    expression,
    category,
    score,
    maxScore,
    attempts,
    wrongAttempts,
    completed,
    timeSpentSeconds,
    unmasteredQuestions,
    historyEntry,
    badgeUnlocked,
  } = req.body as {
    worldId?: string;
    stationId?: string;
    stationTitle?: string;
    expression?: string;
    category?: StudentProgressRecord['category'];
    score?: number;
    maxScore?: number;
    attempts?: number;
    wrongAttempts?: number;
    completed?: boolean;
    timeSpentSeconds?: number;
    unmasteredQuestions?: string[];
    historyEntry?: StudentProgressRecord['history'][0];
    badgeUnlocked?: string;
  };

  if (!worldId || !stationId) {
    res.status(400).json({ error: 'Maklumat stesen atau dunia tidak lengkap.' });
    return;
  }

  const db = getDb();
  const world = db.worlds.find((w) => w.id === worldId);
  if (!world) {
    res.status(404).json({ error: 'Dunia tidak dijumpai.' });
    return;
  }

  const user = req.user!;
  let savedRecord: StudentProgressRecord | null = null;
  let updatedBadges: string[] = [];
  let updatedStars = user.totalStars;

  await saveDb((draft) => {
    const existingIdx = draft.progress.findIndex(
      (p) => p.studentId === user.id && p.worldId === world.id && p.stationId === stationId
    );
    const now = new Date().toISOString();
    const nextScore = Math.max(0, Number(score || 0));
    const nextMax = Math.max(1, Number(maxScore || 20));
    const nextCompleted = Boolean(completed);
    const masteryLevel = computeMastery(nextScore, nextMax, nextCompleted);

    if (existingIdx !== -1) {
      const prev = draft.progress[existingIdx];
      const deltaScore = Math.max(0, nextScore - prev.score);
      prev.score = Math.max(prev.score, nextScore);
      prev.maxScore = nextMax;
      prev.attempts += Number(attempts || 1);
      prev.wrongAttempts += Number(wrongAttempts || 0);
      prev.completed = prev.completed || nextCompleted;
      prev.masteryLevel = computeMastery(prev.score, prev.maxScore, prev.completed);
      prev.timeSpentSeconds += Number(timeSpentSeconds || 0);
      prev.unmasteredQuestions = Array.isArray(unmasteredQuestions)
        ? unmasteredQuestions
        : prev.unmasteredQuestions;
      if (historyEntry) {
        prev.history.push(historyEntry);
      }
      prev.avatarSummary = {
        uniformOption: user.avatar.uniformOption,
        skinColor: user.avatar.skinColor,
        hairColor: user.avatar.hairColor,
        avatarName: user.avatar.avatarName,
      };
      prev.updatedAt = now;
      savedRecord = prev;

      const uIdx = draft.users.findIndex((u) => u.id === user.id);
      if (uIdx !== -1) {
        draft.users[uIdx].totalStars += deltaScore;
        updatedStars = draft.users[uIdx].totalStars;
      }
    } else {
      const rec: StudentProgressRecord = {
        id: `prg_${crypto.randomUUID().slice(0, 8)}`,
        studentId: user.id,
        studentName: user.name,
        avatarSummary: {
          uniformOption: user.avatar.uniformOption,
          skinColor: user.avatar.skinColor,
          hairColor: user.avatar.hairColor,
          avatarName: user.avatar.avatarName,
        },
        worldId: world.id,
        worldCode: world.worldCode,
        worldTitle: world.title,
        stationId,
        stationTitle: stationTitle || stationId,
        expression: expression || stationTitle || stationId,
        category: category || 'Simpulan Bahasa',
        score: nextScore,
        maxScore: nextMax,
        attempts: Number(attempts || 1),
        wrongAttempts: Number(wrongAttempts || 0),
        completed: nextCompleted,
        masteryLevel,
        timeSpentSeconds: Number(timeSpentSeconds || 15),
        unmasteredQuestions: Array.isArray(unmasteredQuestions) ? unmasteredQuestions : [],
        history: historyEntry ? [historyEntry] : [],
        updatedAt: now,
      };
      draft.progress.push(rec);
      savedRecord = rec;

      const uIdx = draft.users.findIndex((u) => u.id === user.id);
      if (uIdx !== -1) {
        draft.users[uIdx].totalStars += nextScore;
        updatedStars = draft.users[uIdx].totalStars;
      }
    }

    // Auto-award curriculum badges
    const uIdx = draft.users.findIndex((u) => u.id === user.id);
    if (uIdx !== -1) {
      const u = draft.users[uIdx];
      const completedAll = draft.progress.filter(
        (p) => p.studentId === user.id && p.completed
      );
      const sbCount = completedAll.filter((p) => p.category === 'Simpulan Bahasa').length;
      const prCount = completedAll.filter((p) => p.category === 'Perumpamaan').length;
      const pbCount = completedAll.filter(
        (p) => p.category === 'Pepatah' || p.category === 'Bidalan'
      ).length;

      if (sbCount >= 3 && !u.badges.includes('peneroka_kampung')) {
        u.badges.push('peneroka_kampung');
      }
      if (prCount >= 2 && !u.badges.includes('penjaga_hutan')) {
        u.badges.push('penjaga_hutan');
      }
      if (pbCount >= 2 && !u.badges.includes('pendeta_istana')) {
        u.badges.push('pendeta_istana');
      }
      if (badgeUnlocked && !u.badges.includes(badgeUnlocked)) {
        u.badges.push(badgeUnlocked);
      }
      updatedBadges = [...u.badges];
    }
  });

  res.json({
    record: savedRecord,
    badges: updatedBadges,
    totalStars: updatedStars,
  });
});

app.get('/api/progress/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const records = db.progress.filter((p) => p.studentId === req.user!.id);
  res.json({ records });
});

app.get('/api/teacher/analytics', requireTeacher, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const myWorlds = db.worlds.filter((w) => w.ownerId === req.user!.id);
  const myWorldIds = new Set(myWorlds.map((w) => w.id));
  const records = db.progress.filter((p) => myWorldIds.has(p.worldId));

  res.json({
    worlds: myWorlds.map(makeWorldSummary),
    records,
  });
});

// ==========================================
// HTTP SERVER + WEBSOCKET MULTIPLAYER SERVER
// ==========================================

const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

interface ClientConnection {
  ws: WebSocket;
  playerId: string;
  worldCode: string;
  state: RemotePlayerState;
}

const worldRooms = new Map<string, Map<string, ClientConnection>>();
const worldGroupQuests = new Map<string, GroupQuestState>();

function getOrCreateGroupQuest(worldCode: string): GroupQuestState {
  let q = worldGroupQuests.get(worldCode);
  if (!q) {
    q = {
      worldCode,
      questId: `gq_${worldCode}`,
      title: 'Misi Muafakat: Kumpulkan 2 Peneroka di Stesen Bahasa!',
      targetCount: 2,
      collectedBy: {},
      completed: false,
    };
    worldGroupQuests.set(worldCode, q);
  }
  return q;
}

function broadcastToWorld(worldCode: string, payload: unknown, excludePlayerId?: string) {
  const room = worldRooms.get(worldCode.toUpperCase());
  if (!room) return;
  const serialized = JSON.stringify(payload);
  for (const [pid, client] of room.entries()) {
    if (excludePlayerId && pid === excludePlayerId) continue;
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(serialized);
    }
  }
}

wss.on('connection', (ws) => {
  let currentConn: ClientConnection | null = null;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(String(raw)) as {
        type: string;
        token?: string;
        worldCode?: string;
        playerName?: string;
        avatar?: AvatarConfig;
        x?: number;
        y?: number;
        z?: number;
        yaw?: number;
        animState?: RemotePlayerState['animState'];
        emoteText?: string;
      };

      if (msg.type === 'join') {
        const worldCode = String(msg.worldCode || 'KAMPUNG01').toUpperCase();
        const db = getDb();
        const world = db.worlds.find((w) => w.worldCode.toUpperCase() === worldCode);
        if (!world) {
          ws.send(JSON.stringify({ type: 'error', error: 'Kod Dunia tidak sah.' }));
          return;
        }

        let room = worldRooms.get(worldCode);
        if (!room) {
          room = new Map();
          worldRooms.set(worldCode, room);
        }

        if (room.size >= world.maxPlayers) {
          ws.send(
            JSON.stringify({
              type: 'error',
              error: `Dunia penuh (had maksimum ${world.maxPlayers} pemain).`,
            })
          );
          return;
        }

        const verified = verifyToken(msg.token);
        let playerId = `guest_${crypto.randomUUID().slice(0, 6)}`;
        let playerName = (msg.playerName || 'Peneroka').slice(0, 24);
        let role: UserRole = 'murid';
        let avatar = msg.avatar || DEFAULT_AVATAR;

        if (verified) {
          const user = db.users.find((u) => u.id === verified.userId);
          if (user) {
            playerId = user.id;
            playerName = user.avatar.avatarName || user.name;
            role = user.role;
            avatar = msg.avatar || user.avatar;
          }
        }

        // Remove stale duplicate socket for same user in room
        if (room.has(playerId)) {
          room.delete(playerId);
        }

        const initialState: RemotePlayerState = {
          playerId,
          name: playerName,
          role,
          avatar,
          x: Number(msg.x ?? 0),
          y: Number(msg.y ?? 0),
          z: Number(msg.z ?? 6),
          yaw: Number(msg.yaw ?? 0),
          animState: 'idle',
          updatedAt: Date.now(),
        };

        currentConn = { ws, playerId, worldCode, state: initialState };
        room.set(playerId, currentConn);

        const existingPlayers = Array.from(room.values())
          .filter((c) => c.playerId !== playerId)
          .map((c) => c.state);

        ws.send(
          JSON.stringify({
            type: 'joined',
            playerId,
            worldCode,
            players: existingPlayers,
            groupQuest: getOrCreateGroupQuest(worldCode),
          })
        );

        broadcastToWorld(
          worldCode,
          { type: 'player:joined', player: initialState },
          playerId
        );
        return;
      }

      if (!currentConn) return;

      if (msg.type === 'state') {
        currentConn.state.x = Number(msg.x ?? currentConn.state.x);
        currentConn.state.y = Number(msg.y ?? currentConn.state.y);
        currentConn.state.z = Number(msg.z ?? currentConn.state.z);
        currentConn.state.yaw = Number(msg.yaw ?? currentConn.state.yaw);
        if (msg.animState) currentConn.state.animState = msg.animState;
        if (msg.avatar) currentConn.state.avatar = msg.avatar;
        currentConn.state.updatedAt = Date.now();

        broadcastToWorld(
          currentConn.worldCode,
          { type: 'player:state', player: currentConn.state },
          currentConn.playerId
        );
      } else if (msg.type === 'emote') {
        // Child-safety: restrict to safe preset emotes only
        const ALLOWED_EMOTES = new Set([
          'Melambai 👋',
          'Angkat Tangan ✋',
          'Menari 🎵',
          'Tahniah! ⭐',
          'Jom Belajar! 📖',
        ]);
        const safeEmote = ALLOWED_EMOTES.has(msg.emoteText || '')
          ? msg.emoteText
          : 'Melambai 👋';
        currentConn.state.emoteText = safeEmote;
        broadcastToWorld(currentConn.worldCode, {
          type: 'player:emote',
          playerId: currentConn.playerId,
          emoteText: safeEmote,
          animState: msg.animState || 'wave',
        });
      } else if (msg.type === 'quest:contribute') {
        const quest = getOrCreateGroupQuest(currentConn.worldCode);
        quest.collectedBy[currentConn.playerId] = currentConn.state.name;
        if (Object.keys(quest.collectedBy).length >= quest.targetCount) {
          quest.completed = true;
        }
        broadcastToWorld(currentConn.worldCode, {
          type: 'quest:update',
          groupQuest: quest,
        });
      }
    } catch {
      // Ignore malformed socket frames
    }
  });

  ws.on('close', () => {
    if (!currentConn) return;
    const room = worldRooms.get(currentConn.worldCode);
    if (room) {
      room.delete(currentConn.playerId);
      broadcastToWorld(currentConn.worldCode, {
        type: 'player:left',
        playerId: currentConn.playerId,
      });
    }
  });
});

// ==========================================
// VITE DEV MIDDLEWARE / STATIC PRODUCTION
// ==========================================

async function startServer() {
  getDb();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Dunia Bahasa Blockverse server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
