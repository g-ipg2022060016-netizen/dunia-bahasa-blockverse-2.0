import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  Globe,
  Hammer,
  Home,
  LayoutDashboard,
  Music,
  Redo2,
  Save,
  Settings,
  Sparkles,
  Undo2,
  Upload,
  UserCheck,
  Users,
  Video,
} from 'lucide-react';
import { AuthAndWorldModal } from './components/AuthAndWorldModal';
import { AvatarCreator } from './components/AvatarCreator';
import { BadgesAndSettingsModal } from './components/BadgesAndSettingsModal';
import { LearningStationModal } from './components/LearningStationModal';
import { TeacherContentEditor } from './components/TeacherContentEditor';
import { TeacherDashboard } from './components/TeacherDashboard';
import { DEFAULT_AVATAR } from './data/curriculumDefaults';
import {
  getCurrentUser,
  getStoredToken,
  listTemplates,
  listWorlds,
  loadWorldByCode,
  loginAccount,
  logoutAccount,
  recordStudentProgress,
  registerAccount,
  saveAvatarToServer,
  saveTemplate,
  updateStudentBlocks,
  updateWorldOnServer,
} from './services/api';
import { playBlockSound } from './services/audioSynth';
import {
  flushOfflineProgressQueue,
  getOfflineCachedWorld,
  queueOfflineProgress,
} from './services/offlineSync';
import { isSupabaseEnabled, supabase } from './services/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { BLOCK_CATALOG } from './three/textures';
import {
  CreatorToolType,
  NearbyTarget,
  TouchControlState,
  WorldCanvas,
} from './three/WorldCanvas';
import {
  AvatarAnimState,
  AvatarConfig,
  BlockType,
  BuildingTemplate,
  GroupQuestState,
  LearningStation,
  MusicZone,
  RemotePlayerState,
  UserProfile,
  UserRole,
  VoxelBlock,
  WorldData,
  WorldSummary,
} from './types/blockverse';

const FALLBACK_BOOT_WORLD: WorldData = {
  id: 'wld_kampung_01',
  worldCode: 'KAMPUNG01',
  title: 'Kampung Simpulan Bahasa',
  description: 'Memuatkan dunia maya 3D...',
  worldType: 'kampung',
  ownerId: 'usr_guru_1',
  ownerName: 'Cikgu Aminah',
  teacherCode: 'GURU-1001',
  isPublished: true,
  allowStudentBuild: false,
  maxPlayers: 25,
  dayTimeMode: 'siang',
  blocks: [],
  structures: [],
  npcs: [],
  stations: [],
  musicZones: [],
  signs: [],
  customUniforms: [],
  snapshots: [],
  version: 1,
  updatedAt: new Date().toISOString(),
};

const CREATOR_TOOLS: { id: CreatorToolType; label: string }[] = [
  { id: 'block', label: 'Letak Blok' },
  { id: 'erase', label: 'Padam Blok' },
  { id: 'rumah_kampung', label: 'Rumah Kampung' },
  { id: 'sekolah', label: 'Sekolah' },
  { id: 'pondok_belajar', label: 'Pondok Belajar' },
  { id: 'pokok', label: 'Pokok' },
  { id: 'haiwan_kucing', label: 'Kucing' },
  { id: 'haiwan_rusa', label: 'Rusa' },
  { id: 'npc', label: 'Watak NPC' },
  { id: 'sign', label: 'Papan Tanda' },
  { id: 'station', label: 'Stesen Bahasa' },
  { id: 'music', label: 'Zon Muzik' },
];

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error?.message || 'Ralat tidak dijangka' };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-white/15 rounded-2xl p-6 space-y-3 text-center">
            <h2 className="font-display text-xl font-bold text-amber-300">
              Dunia Bahasa Blockverse
            </h2>
            <p className="text-sm text-slate-300">
              Paparan mengalami ralat sementara ({this.state.errorMsg}). Sila muat semula halaman.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 text-sm font-bold"
            >
              Muat Semula
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <BlockverseApp />
    </AppErrorBoundary>
  );
}

function BlockverseApp() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [avatar, setAvatar] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [worldsList, setWorldsList] = useState<WorldSummary[]>([]);
  const [activeWorld, setActiveWorld] = useState<WorldData>(FALLBACK_BOOT_WORLD);
  const [screenMode, setScreenMode] = useState<'menu' | 'play'>('menu');

  // Camera, Atmosphere & HUD state
  const [cameraMode, setCameraMode] = useState<'third' | 'first'>('third');
  const [dayTimeMode, setDayTimeMode] = useState<'siang' | 'senja' | 'malam' | 'kitaran'>('siang');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [manualAnim, setManualAnim] = useState<AvatarAnimState | null>(null);
  const [nearbyTarget, setNearbyTarget] = useState<NearbyTarget | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modals
  const [showAvatarCreator, setShowAvatarCreator] = useState(false);
  const [studioModalMode, setStudioModalMode] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'world' | null>(null);
  const [showTeacherDashboard, setShowTeacherDashboard] = useState(false);
  const [badgesSettingsModal, setBadgesSettingsModal] = useState<'badges' | 'settings' | null>(null);
  const [activeLearningModal, setActiveLearningModal] = useState<{
    station?: LearningStation;
    musicZone?: MusicZone;
  } | null>(null);
  const [activeDialogue, setActiveDialogue] = useState<{
    title: string;
    subtitle: string;
    body: string;
    stationId?: string;
  } | null>(null);

  // Teacher Creator Mode state + Undo / Redo history
  const [creatorActive, setCreatorActive] = useState(false);
  const [creatorTool, setCreatorTool] = useState<CreatorToolType>('block');
  const [selectedBlockType, setSelectedBlockType] = useState<BlockType>('plank');
  const [selectedBlockTint, setSelectedBlockTint] = useState<string>('');
  const [undoStack, setUndoStack] = useState<WorldData[]>([]);
  const [redoStack, setRedoStack] = useState<WorldData[]>([]);
  const [templates, setTemplates] = useState<BuildingTemplate[]>([]);
  const [contentEditorState, setContentEditorState] = useState<{
    mode: 'station' | 'music';
    pos: { x: number; y: number; z: number };
  } | null>(null);

  // Multiplayer WebSocket / Supabase Realtime state
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayerState[]>([]);
  const [groupQuest, setGroupQuest] = useState<GroupQuestState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const guestIdRef = useRef<string>(`tamu_${Math.random().toString(36).slice(2, 10)}`);
  const lastBroadcastMoveRef = useRef<number>(0);

  // Mobile Touch Controls Ref
  const touchControlsRef = useRef<TouchControlState>({
    moveX: 0,
    moveY: 0,
    jumpPressed: false,
    runActive: false,
  });

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr));
    }, 3500);
  }, []);

  // Initial load: User session, Worlds list, Default World (with offline fallback), and offline queue sync
  useEffect(() => {
    (async () => {
      try {
        const [me, worlds] = await Promise.all([
          getCurrentUser().catch(() => null),
          listWorlds().catch(() => []),
        ]);
        const safeWorlds = Array.isArray(worlds) ? worlds : [];
        if (me) {
          setUser(me);
          setAvatar(me.avatar);
        }
        setWorldsList(safeWorlds);

        const defaultCode = safeWorlds[0]?.worldCode || 'KAMPUNG01';
        try {
          const loaded = await loadWorldByCode(defaultCode);
          setActiveWorld(loaded);
          setDayTimeMode(loaded.dayTimeMode || 'siang');
        } catch {
          const cached = await getOfflineCachedWorld(defaultCode);
          if (cached) setActiveWorld(cached);
        }
      } catch {
        // Fallback already in state
      }
      await flushOfflineProgressQueue();
    })();

    const onOnline = () => {
      flushOfflineProgressQueue().then((count) => {
        if (count > 0) showToast(`${count} rekod luar talian berjaya disegerakkan!`);
      });
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [showToast]);

  // Keyboard shortcuts ('V' camera toggle)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) {
        return;
      }
      if (e.code === 'KeyV' && screenMode === 'play') {
        setCameraMode((prev) => (prev === 'third' ? 'first' : 'third'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screenMode]);

  // Multiplayer & Real-Time World Sync Connection (Supabase Realtime or Local WebSocket)
  useEffect(() => {
    if (screenMode !== 'play') {
      wsRef.current?.close();
      wsRef.current = null;
      if (realtimeChannelRef.current && supabase) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      setRemotePlayers([]);
      return;
    }

    const myPlayerId = user?.id || guestIdRef.current;
    const myPlayerName = avatar.avatarName || user?.name || 'Peneroka';
    const myRole: UserRole = user?.role || 'murid';

    if (isSupabaseEnabled() && supabase) {
      const sb = supabase;
      setGroupQuest({
        worldCode: activeWorld.worldCode,
        questId: 'misi_muafakat_1',
        title: 'Misi Muafakat: Kumpulkan 3 Rakan di Dunia',
        targetCount: 3,
        collectedBy: {},
        completed: false,
      });

      const channel = sb.channel(`blockverse:${activeWorld.worldCode}`, {
        config: {
          presence: { key: myPlayerId },
          broadcast: { self: false },
        },
      });
      realtimeChannelRef.current = channel;

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const activeKeys = new Set(Object.keys(state));
          setRemotePlayers((prev) => prev.filter((p) => activeKeys.has(p.playerId)));
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          setRemotePlayers((prev) => prev.filter((p) => p.playerId !== key));
        })
        .on('broadcast', { event: 'player:state' }, ({ payload }) => {
          const incoming = payload as RemotePlayerState | undefined;
          if (!incoming || incoming.playerId === myPlayerId) return;
          setRemotePlayers((prev) => {
            const idx = prev.findIndex((p) => p.playerId === incoming.playerId);
            if (idx === -1) return [...prev, incoming];
            const copy = [...prev];
            copy[idx] = incoming;
            return copy;
          });
        })
        .on('broadcast', { event: 'player:emote' }, ({ payload }) => {
          const em = payload as
            | { playerId: string; emoteText?: string; animState?: AvatarAnimState }
            | undefined;
          if (!em || em.playerId === myPlayerId) return;
          setRemotePlayers((prev) =>
            prev.map((p) =>
              p.playerId === em.playerId
                ? { ...p, emoteText: em.emoteText, animState: em.animState || 'wave' }
                : p
            )
          );
        })
        .on('broadcast', { event: 'quest:contribute' }, ({ payload }) => {
          const contrib = payload as { playerId: string; playerName: string } | undefined;
          if (!contrib) return;
          setGroupQuest((prev) => {
            if (!prev) return prev;
            const nextCollected = {
              ...prev.collectedBy,
              [contrib.playerId]: contrib.playerName,
            };
            const justCompleted =
              !prev.completed && Object.keys(nextCollected).length >= prev.targetCount;
            if (justCompleted) {
              playBlockSound('success');
              showToast('Misi Muafakat Berjaya Diselesaikan Bersama!');
            }
            return {
              ...prev,
              collectedBy: nextCollected,
              completed: Object.keys(nextCollected).length >= prev.targetCount,
            };
          });
        })
        .on('broadcast', { event: 'world:update' }, ({ payload }) => {
          const data = payload as { world?: WorldData } | undefined;
          if (data?.world) {
            setActiveWorld(data.world);
            showToast('Dunia telah dikemas kini secara masa nyata oleh guru!');
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              playerId: myPlayerId,
              name: myPlayerName,
              role: myRole,
            });
            await channel.send({
              type: 'broadcast',
              event: 'player:state',
              payload: {
                playerId: myPlayerId,
                name: myPlayerName,
                role: myRole,
                avatar,
                x: 0,
                y: 0,
                z: 6,
                yaw: Math.PI,
                animState: 'idle',
                updatedAt: Date.now(),
              } satisfies RemotePlayerState,
            });
          }
        });

      return () => {
        sb.removeChannel(channel);
        realtimeChannelRef.current = null;
      };
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'join',
          token: getStoredToken(),
          worldCode: activeWorld.worldCode,
          playerName: myPlayerName,
          avatar,
          x: 0,
          y: 0,
          z: 6,
          yaw: Math.PI,
        })
      );
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(String(evt.data));
        if (msg.type === 'joined') {
          setRemotePlayers(msg.players || []);
          if (msg.groupQuest) setGroupQuest(msg.groupQuest);
        } else if (msg.type === 'player:joined') {
          setRemotePlayers((prev) => {
            const filtered = prev.filter((p) => p.playerId !== msg.player.playerId);
            return [...filtered, msg.player];
          });
        } else if (msg.type === 'player:left') {
          setRemotePlayers((prev) => prev.filter((p) => p.playerId !== msg.playerId));
        } else if (msg.type === 'player:state') {
          setRemotePlayers((prev) => {
            const idx = prev.findIndex((p) => p.playerId === msg.player.playerId);
            if (idx === -1) return [...prev, msg.player];
            const copy = [...prev];
            copy[idx] = msg.player;
            return copy;
          });
        } else if (msg.type === 'player:emote') {
          setRemotePlayers((prev) =>
            prev.map((p) =>
              p.playerId === msg.playerId
                ? { ...p, emoteText: msg.emoteText, animState: msg.animState || 'wave' }
                : p
            )
          );
        } else if (msg.type === 'quest:update') {
          setGroupQuest(msg.groupQuest);
          if (msg.groupQuest?.completed) {
            playBlockSound('success');
            showToast('Misi Muafakat Berjaya Diselesaikan Bersama!');
          }
        } else if (msg.type === 'world:update' && msg.world) {
          setActiveWorld(msg.world);
          showToast('Dunia telah dikemas kini secara masa nyata oleh guru!');
        } else if (msg.type === 'error') {
          showToast(msg.error);
        }
      } catch {
        // Ignore parse failures
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [screenMode, activeWorld.worldCode, user?.id]);

  const handlePlayerMove = useCallback(
    (pos: { x: number; y: number; z: number; yaw: number; animState: AvatarAnimState }) => {
      if (isSupabaseEnabled() && realtimeChannelRef.current) {
        const nowMs = Date.now();
        if (nowMs - lastBroadcastMoveRef.current < 85) return;
        lastBroadcastMoveRef.current = nowMs;
        const myPlayerId = user?.id || guestIdRef.current;
        realtimeChannelRef.current
          .send({
            type: 'broadcast',
            event: 'player:state',
            payload: {
              playerId: myPlayerId,
              name: avatar.avatarName || user?.name || 'Peneroka',
              role: user?.role || 'murid',
              avatar,
              ...pos,
              updatedAt: nowMs,
            } satisfies RemotePlayerState,
          })
          .catch(() => {});
        return;
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'state',
            ...pos,
            avatar,
          })
        );
      }
    },
    [avatar, user?.id, user?.name, user?.role]
  );

  // Handlers for Auth & Worlds
  const handleLogin = async (email: string, password: string) => {
    const res = await loginAccount(email, password);
    setUser(res.user);
    setAvatar(res.user.avatar);
    const list = await listWorlds();
    setWorldsList(list);
    if (isSupabaseEnabled()) {
      loadWorldByCode(activeWorld.worldCode)
        .then((w) => setActiveWorld(w))
        .catch(() => {});
    }
    showToast(`Selamat kembali, ${res.user.name}!`);
  };

  const handleRegister = async (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }) => {
    const res = await registerAccount({ ...payload, avatar });
    setUser(res.user);
    const list = await listWorlds();
    setWorldsList(list);
    if (isSupabaseEnabled()) {
      loadWorldByCode(activeWorld.worldCode)
        .then((w) => setActiveWorld(w))
        .catch(() => {});
    }
    showToast(`Akaun ${res.user.role === 'guru' ? 'Guru' : 'Murid'} berjaya didaftarkan!`);
  };

  const handleLogout = async () => {
    await logoutAccount();
    setUser(null);
    setCreatorActive(false);
    setShowTeacherDashboard(false);
    showToast('Anda telah log keluar.');
  };

  const handleEnterWorldCode = async (code: string) => {
    try {
      const w = await loadWorldByCode(code);
      setActiveWorld(w);
      setDayTimeMode(w.dayTimeMode || 'siang');
      setScreenMode('play');
      showToast(`Memasuki dunia: ${w.title} (${w.worldCode})`);
    } catch (err) {
      const cached = await getOfflineCachedWorld(code);
      if (cached) {
        setActiveWorld(cached);
        setScreenMode('play');
        showToast(`Mod Luar Talian: Memasuki ${cached.title}`);
      } else {
        throw err;
      }
    }
  };

  const handleSaveAvatar = async (nextAvatar: AvatarConfig) => {
    setAvatar(nextAvatar);
    if (user) {
      const updated = await saveAvatarToServer(nextAvatar);
      setUser(updated);
    } else {
      throw new Error('Sila log masuk akaun terlebih dahulu untuk menyimpan avatar merentas peranti.');
    }
  };

  // Teacher Creator Mode Mutations with Undo / Redo
  const pushWorldChange = (updater: (prev: WorldData) => WorldData) => {
    setUndoStack((u) => [...u.slice(-19), activeWorld]);
    setRedoStack([]);
    setActiveWorld((prev) => updater(prev));
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, activeWorld]);
    setUndoStack((u) => u.slice(0, -1));
    setActiveWorld(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, activeWorld]);
    setRedoStack((r) => r.slice(0, -1));
    setActiveWorld(next);
  };

  const isOwnerTeacher =
    user?.role === 'guru' && (!activeWorld.ownerId || user.id === activeWorld.ownerId);

  const canBuildHere =
    isOwnerTeacher || (activeWorld.allowStudentBuild && Boolean(user));

  const handlePlaceBlock = (blk: VoxelBlock) => {
    if (!canBuildHere) {
      showToast('Anda tidak mempunyai kebenaran membina di dunia ini.');
      return;
    }
    playBlockSound('place');
    pushWorldChange((prev) => ({
      ...prev,
      blocks: [...prev.blocks.filter((b) => !(b.x === blk.x && b.y === blk.y && b.z === blk.z)), blk],
    }));
  };

  const handleRemoveBlock = (x: number, y: number, z: number) => {
    if (!canBuildHere) return;
    playBlockSound('break');
    pushWorldChange((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((b) => !(b.x === x && b.y === y && b.z === z)),
    }));
  };

  const handlePlaceEntity = (tool: CreatorToolType, pos: { x: number; y: number; z: number }) => {
    if (!isOwnerTeacher) {
      showToast('Hanya guru pemilik dunia boleh menambah bangunan atau stesen pembelajaran.');
      return;
    }
    if (tool === 'station') {
      setContentEditorState({ mode: 'station', pos });
      return;
    }
    if (tool === 'music') {
      setContentEditorState({ mode: 'music', pos });
      return;
    }
    if (tool === 'npc') {
      playBlockSound('place');
      pushWorldChange((prev) => ({
        ...prev,
        npcs: [
          ...prev.npcs,
          {
            id: `npc_${Date.now()}`,
            name: 'Cikgu Baharu',
            roleTitle: 'Pembimbing Bahasa',
            x: pos.x,
            y: pos.y,
            z: pos.z,
            patrolRadius: 2,
            shirtColor: '#0284c7',
            skinColor: '#eab68c',
            dialogue: 'Selamat belajar Simpulan Bahasa dan Peribahasa di kawasan ini!',
          },
        ],
      }));
      return;
    }
    if (tool === 'sign') {
      playBlockSound('place');
      pushWorldChange((prev) => ({
        ...prev,
        signs: [
          ...prev.signs,
          {
            id: `sign_${Date.now()}`,
            title: 'Sudut Ilmu Guru',
            message: 'Terokai kawasan baharu yang dibina oleh guru anda!',
            x: pos.x,
            y: pos.y,
            z: pos.z,
          },
        ],
      }));
      return;
    }

    // Structure placement
    playBlockSound('place');
    const nameMap: Record<string, string> = {
      rumah_kampung: 'Rumah Kampung Baharu',
      sekolah: 'Blok Sekolah Baharu',
      pondok_belajar: 'Pondok Ilmu',
      pokok: 'Pokok Rimba',
      haiwan_kucing: 'Kucing Kampung',
      haiwan_rusa: 'Rusa Jinak',
    };
    pushWorldChange((prev) => ({
      ...prev,
      structures: [
        ...prev.structures,
        {
          id: `str_${Date.now()}`,
          kind: tool as WorldData['structures'][0]['kind'],
          name: nameMap[tool] || 'Binaan Guru',
          x: pos.x,
          y: pos.y,
          z: pos.z,
        },
      ],
    }));
  };

  const handleSaveWorldChanges = async (publishNow?: boolean) => {
    try {
      if (isOwnerTeacher) {
        const updated = await updateWorldOnServer(activeWorld.id, {
          blocks: activeWorld.blocks,
          structures: activeWorld.structures,
          npcs: activeWorld.npcs,
          stations: activeWorld.stations,
          musicZones: activeWorld.musicZones,
          signs: activeWorld.signs,
          dayTimeMode,
          ...(typeof publishNow === 'boolean' ? { isPublished: publishNow } : {}),
        });
        setActiveWorld(updated);
        playBlockSound('success');
        showToast(
          publishNow
            ? 'Dunia berjaya diterbitkan dan disegerakkan ke semua peranti!'
            : 'Perubahan dunia disimpan ke pelayan awan!'
        );
      } else if (activeWorld.allowStudentBuild && user) {
        const updated = await updateStudentBlocks(activeWorld.id, activeWorld.blocks);
        setActiveWorld(updated);
        showToast('Blok binaan murid disimpan!');
      } else {
        showToast('Log masuk sebagai Guru pemilik untuk menyimpan perubahan dunia.');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan dunia.');
    }
  };

  const handleSaveAsTemplate = async () => {
    if (user?.role !== 'guru') return;
    const tplName = `Templat ${activeWorld.title} (${activeWorld.blocks.length} blok)`;
    try {
      const tpl = await saveTemplate({
        name: tplName,
        category: 'Binaan Guru',
        blocks: activeWorld.blocks,
        structures: activeWorld.structures,
      });
      setTemplates((prev) => [tpl, ...prev]);
      showToast(`Templat "${tpl.name}" disimpan!`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan templat.');
    }
  };

  const handleOpenCreatorMode = async () => {
    if (!user) {
      setAuthModalTab('login');
      showToast('Sila log masuk sebagai Guru untuk membuka Mod Pembina Dunia.');
      return;
    }
    if (user.role !== 'guru' && !activeWorld.allowStudentBuild) {
      showToast('Akaun murid hanya boleh membina jika diizinkan oleh guru.');
      return;
    }
    if (user.role === 'guru') {
      listTemplates().then(setTemplates).catch(() => {});
    }
    setCreatorActive(true);
    setScreenMode('play');
  };

  const handleInteractTarget = (target: NearbyTarget) => {
    playBlockSound('click');
    if (target.kind === 'station') {
      setActiveLearningModal({ station: target.station });
    } else if (target.kind === 'music') {
      setActiveLearningModal({ musicZone: target.musicZone });
    } else if (target.kind === 'studio') {
      setStudioModalMode(true);
      setShowAvatarCreator(true);
    } else if (target.kind === 'npc') {
      setActiveDialogue({
        title: target.npc.name,
        subtitle: target.npc.roleTitle,
        body: target.npc.dialogue,
        stationId: target.npc.stationId,
      });
    } else if (target.kind === 'sign') {
      setActiveDialogue({
        title: target.sign.title,
        subtitle: 'Papan Tanda Dunia',
        body: target.sign.message,
      });
    } else if (target.kind === 'clue') {
      playBlockSound('success');
      setActiveDialogue({
        title: `Petunjuk Rahsia: ${target.station.expression}`,
        subtitle: 'Objek Tersembunyi Ditemui!',
        body: target.clueText,
        stationId: target.station.id,
      });
    }
  };

  const triggerEmote = (anim: AvatarAnimState, emoteText?: string) => {
    setManualAnim(anim);
    if (emoteText) {
      if (isSupabaseEnabled() && realtimeChannelRef.current) {
        const myPlayerId = user?.id || guestIdRef.current;
        realtimeChannelRef.current
          .send({
            type: 'broadcast',
            event: 'player:emote',
            payload: { playerId: myPlayerId, animState: anim, emoteText },
          })
          .catch(() => {});
      } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'emote', animState: anim, emoteText }));
      }
    }
    if (anim !== 'sit' && anim !== 'hold_book') {
      setTimeout(() => {
        setManualAnim((curr) => (curr === anim ? null : curr));
      }, 3200);
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 select-none">
      {/* FULL-SCREEN 3D VOXEL WORLD VIEWPORT */}
      <WorldCanvas
        world={activeWorld}
        playerAvatar={avatar}
        mode={screenMode}
        cameraMode={cameraMode}
        dayTimeMode={dayTimeMode}
        manualAnimOverride={manualAnim}
        remotePlayers={remotePlayers}
        creatorActive={creatorActive}
        creatorTool={creatorTool}
        selectedBlockType={selectedBlockType}
        selectedBlockTint={selectedBlockTint || undefined}
        touchControlsRef={touchControlsRef}
        onPlayerMove={handlePlayerMove}
        onNearbyChange={setNearbyTarget}
        onInteractRequest={handleInteractTarget}
        onCreatorPlaceBlock={handlePlaceBlock}
        onCreatorRemoveBlock={handleRemoveBlock}
        onCreatorPlaceEntity={handlePlaceEntity}
      />

      {/* TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-semibold shadow-xl border border-white/15">
          {toastMsg}
        </div>
      )}

      {/* ======================================================== */}
      {/* MAIN MENU OVERLAY (WHEN IN MENU MODE)                    */}
      {/* ======================================================== */}
      {screenMode === 'menu' && (
        <div className="fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-8 pointer-events-none">
          {/* Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pointer-events-auto">
            <div className="px-4 py-2 rounded-xl bg-slate-900/85 text-white border border-white/15">
              <div className="text-xs text-amber-300 font-semibold">
                Dunia Aktif: {activeWorld.title} · Kod: {activeWorld.worldCode}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAuthModalTab('login')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-900 text-xs sm:text-sm font-bold shadow-lg hover:bg-slate-100 whitespace-nowrap"
              >
                <UserCheck className="w-4 h-4 text-sky-600" />
                {user
                  ? `${user.name} (${user.role === 'guru' ? 'Guru' : 'Murid'})`
                  : 'Log Masuk / Daftar Akaun'}
              </button>
            </div>
          </div>

          {/* Center-Left Hero Menu Card */}
          <div className="my-auto max-w-md w-full bg-slate-950/85 text-white p-6 sm:p-7 rounded-2xl border border-white/15 shadow-2xl pointer-events-auto space-y-5">
            <div>
              <p className="text-xs font-semibold text-amber-300 tracking-wide">
                Platform Pembelajaran Bahasa Melayu 3D
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight mt-1">
                DUNIA BAHASA BLOCKVERSE
              </h1>
              <p className="text-sm text-slate-300 mt-1.5">
                "Bina Duniamu, Terokai Bahasa!"
              </p>
            </div>

            {/* 7 Required Main Menu Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  playBlockSound('click');
                  setCreatorActive(false);
                  setScreenMode('play');
                }}
                className="sm:col-span-2 flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-amber-400 text-slate-950 font-bold text-sm hover:bg-amber-300 transition-colors"
              >
                <Compass className="w-4 h-4" />
                MULA PENGEMBARAAN
              </button>

              <button
                type="button"
                onClick={() => {
                  playBlockSound('click');
                  setStudioModalMode(false);
                  setShowAvatarCreator(true);
                }}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-sky-600 text-white font-bold text-xs sm:text-sm hover:bg-sky-500 transition-colors whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" />
                CIPTA AVATAR
              </button>

              <button
                type="button"
                onClick={() => {
                  playBlockSound('click');
                  setAuthModalTab('world');
                }}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs sm:text-sm hover:bg-emerald-500 transition-colors whitespace-nowrap"
              >
                <Globe className="w-4 h-4" />
                MASUK DUNIA
              </button>

              <button
                type="button"
                onClick={handleOpenCreatorMode}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-xs sm:text-sm hover:bg-white/20 transition-colors whitespace-nowrap"
              >
                <Hammer className="w-4 h-4 text-amber-300" />
                BINA DUNIA
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!user || user.role !== 'guru') {
                    setAuthModalTab('login');
                    showToast('Sila log masuk akaun Guru untuk membuka Ruang Guru.');
                  } else {
                    setShowTeacherDashboard(true);
                  }
                }}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-xs sm:text-sm hover:bg-white/20 transition-colors whitespace-nowrap"
              >
                <LayoutDashboard className="w-4 h-4 text-sky-300" />
                RUANG GURU
              </button>

              <button
                type="button"
                onClick={() => setBadgesSettingsModal('badges')}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-xs sm:text-sm hover:bg-white/20 transition-colors whitespace-nowrap"
              >
                <Award className="w-4 h-4 text-amber-300" />
                KOLEKSI LENCANA
              </button>

              <button
                type="button"
                onClick={() => setBadgesSettingsModal('settings')}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-xs sm:text-sm hover:bg-white/20 transition-colors whitespace-nowrap"
              >
                <Settings className="w-4 h-4 text-slate-300" />
                TETAPAN
              </button>
            </div>
          </div>

          {/* Bottom World Quick Switcher Strip */}
          <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
            {(Array.isArray(worldsList) ? worldsList : []).slice(0, 5).map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => handleEnterWorldCode(w.worldCode)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors border ${
                  activeWorld.id === w.id
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-slate-900/80 text-white border-white/15 hover:bg-slate-800'
                }`}
              >
                {w.title} ({w.worldCode})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PLAYABLE 3D HUD (WHEN EXPLORING OR BUILDING)             */}
      {/* ======================================================== */}
      {screenMode === 'play' && (
        <>
          {/* Minimal Top-Left World Info & Top-Right Navigation */}
          <div className="fixed top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            <div className="px-4 py-2 rounded-xl bg-slate-950/80 text-white border border-white/15 pointer-events-auto flex items-center gap-3">
              <div>
                <div className="font-display font-bold text-sm leading-tight">
                  {activeWorld.title}
                </div>
                <div className="text-xs text-slate-300 font-mono-nums">
                  Kod: {activeWorld.worldCode} · Pemain: {remotePlayers.length + 1}/{activeWorld.maxPlayers}
                </div>
              </div>
              {groupQuest && (
                <button
                  type="button"
                  onClick={() => {
                    if (isSupabaseEnabled() && realtimeChannelRef.current) {
                      const myPlayerId = user?.id || guestIdRef.current;
                      const myPlayerName = avatar.avatarName || user?.name || 'Peneroka';
                      setGroupQuest((prev) => {
                        if (!prev) return prev;
                        const nextCollected = {
                          ...prev.collectedBy,
                          [myPlayerId]: myPlayerName,
                        };
                        const completed = Object.keys(nextCollected).length >= prev.targetCount;
                        if (completed && !prev.completed) {
                          playBlockSound('success');
                          showToast('Misi Muafakat Berjaya Diselesaikan Bersama!');
                        }
                        return { ...prev, collectedBy: nextCollected, completed };
                      });
                      realtimeChannelRef.current
                        .send({
                          type: 'broadcast',
                          event: 'quest:contribute',
                          payload: { playerId: myPlayerId, playerName: myPlayerName },
                        })
                        .catch(() => {});
                    } else {
                      wsRef.current?.send(JSON.stringify({ type: 'quest:contribute' }));
                    }
                    showToast('Anda menyertai Misi Muafakat Kumpulan!');
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                    groupQuest.completed
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Misi Muafakat ({Object.keys(groupQuest.collectedBy).length}/{groupQuest.targetCount})
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                type="button"
                onClick={() => setCameraMode((c) => (c === 'third' ? 'first' : 'third'))}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950/80 text-white border border-white/15 text-xs font-semibold hover:bg-slate-900"
              >
                <Video className="w-3.5 h-3.5 text-sky-400" />
                {cameraMode === 'third' ? 'Kamera 3' : 'Kamera 1'}
              </button>

              {canBuildHere && (
                <button
                  type="button"
                  onClick={() => setCreatorActive((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border ${
                    creatorActive
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-slate-950/80 text-white border-white/15 hover:bg-slate-900'
                  }`}
                >
                  <Hammer className="w-3.5 h-3.5" />
                  {creatorActive ? 'Mod Membina: AKTIF' : 'Mod Membina'}
                </button>
              )}

              {user?.role === 'guru' && (
                <button
                  type="button"
                  onClick={() => setShowTeacherDashboard(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950/80 text-white border border-white/15 text-xs font-semibold hover:bg-slate-900"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-amber-300" />
                  Ruang Guru
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setCreatorActive(false);
                  setScreenMode('menu');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950/80 text-white border border-white/15 text-xs font-semibold hover:bg-slate-900"
              >
                <Home className="w-3.5 h-3.5" />
                Menu
              </button>
            </div>
          </div>

          {/* Proximity Interactive Prompt (Unobstructive Center-Bottom above Dock) */}
          {nearbyTarget && (
            <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-20">
              <button
                type="button"
                onClick={() => handleInteractTarget(nearbyTarget)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-400 text-slate-950 font-bold text-sm shadow-2xl border-2 border-white hover:bg-amber-300 transition-transform active:scale-95"
              >
                <BookOpen className="w-4 h-4" />
                <span>
                  [E] Buka:{' '}
                  {nearbyTarget.kind === 'station'
                    ? nearbyTarget.station.title
                    : nearbyTarget.kind === 'music'
                    ? nearbyTarget.musicZone.title
                    : nearbyTarget.kind === 'studio'
                    ? nearbyTarget.name
                    : nearbyTarget.kind === 'npc'
                    ? `Bercakap dengan ${nearbyTarget.npc.name}`
                    : nearbyTarget.kind === 'clue'
                    ? 'Periksa Petunjuk Tersembunyi'
                    : nearbyTarget.sign.title}
                </span>
              </button>
            </div>
          )}

          {/* Mobile Touch Controls (Left D-Pad + Right Jump/Run) */}
          <div className="fixed bottom-28 left-4 z-20 md:hidden grid grid-cols-3 gap-1 w-28">
            <div />
            <button
              type="button"
              onTouchStart={() => { touchControlsRef.current.moveY = 1; }}
              onTouchEnd={() => { touchControlsRef.current.moveY = 0; }}
              className="h-9 rounded-lg bg-slate-900/75 text-white text-xs font-bold border border-white/20"
            >
              ▲
            </button>
            <div />
            <button
              type="button"
              onTouchStart={() => { touchControlsRef.current.moveX = -1; }}
              onTouchEnd={() => { touchControlsRef.current.moveX = 0; }}
              className="h-9 rounded-lg bg-slate-900/75 text-white text-xs font-bold border border-white/20"
            >
              ◀
            </button>
            <button
              type="button"
              onTouchStart={() => { touchControlsRef.current.moveY = -1; }}
              onTouchEnd={() => { touchControlsRef.current.moveY = 0; }}
              className="h-9 rounded-lg bg-slate-900/75 text-white text-xs font-bold border border-white/20"
            >
              ▼
            </button>
            <button
              type="button"
              onTouchStart={() => { touchControlsRef.current.moveX = 1; }}
              onTouchEnd={() => { touchControlsRef.current.moveX = 0; }}
              className="h-9 rounded-lg bg-slate-900/75 text-white text-xs font-bold border border-white/20"
            >
              ▶
            </button>
          </div>

          <div className="fixed bottom-28 right-4 z-20 md:hidden flex flex-col gap-2">
            <button
              type="button"
              onTouchStart={() => {
                touchControlsRef.current.jumpPressed = true;
                playBlockSound('jump');
              }}
              className="px-4 py-3 rounded-xl bg-sky-600/90 text-white text-xs font-bold border border-white/25"
            >
              Lompat
            </button>
          </div>

          {/* COLLAPSIBLE UNIFIED BOTTOM CONTROL DOCK */}
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(940px,95vw)] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setDockCollapsed((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-t-xl bg-slate-900/90 text-slate-200 text-xs font-semibold border border-b-0 border-white/15 hover:text-white"
            >
              {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {dockCollapsed ? 'Papar Kawalan' : 'Sembunyi Kawalan'}
            </button>

            {!dockCollapsed && (
              <div className="w-full p-3 rounded-2xl bg-slate-950/90 text-white border border-white/15 shadow-2xl space-y-2.5">
                {creatorActive ? (
                  <>
                    {/* Teacher Creator Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {CREATOR_TOOLS.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setCreatorTool(t.id)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                              creatorTool === t.id
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-white/10 text-slate-200 hover:bg-white/20'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleUndo}
                          disabled={undoStack.length === 0}
                          title="Undo"
                          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-35"
                        >
                          <Undo2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleRedo}
                          disabled={redoStack.length === 0}
                          title="Redo"
                          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-35"
                        >
                          <Redo2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreatorActive(false)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 text-xs font-semibold hover:bg-white/20"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Pratonton
                        </button>
                        {user?.role === 'guru' && (
                          <button
                            type="button"
                            onClick={handleSaveAsTemplate}
                            className="px-2.5 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-500 whitespace-nowrap"
                          >
                            Simpan Templat
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSaveWorldChanges(false)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 whitespace-nowrap"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Simpan
                        </button>
                        {user?.role === 'guru' && (
                          <button
                            type="button"
                            onClick={() => handleSaveWorldChanges(true)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold hover:bg-amber-300 whitespace-nowrap"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Terbitkan
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Block Type & Color Picker */}
                    {creatorTool === 'block' && (
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                        {(Object.keys(BLOCK_CATALOG) as BlockType[]).map((bt) => (
                          <button
                            key={bt}
                            type="button"
                            onClick={() => setSelectedBlockType(bt)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 ${
                              selectedBlockType === bt
                                ? 'bg-sky-600 text-white'
                                : 'bg-white/10 text-slate-200 hover:bg-white/20'
                            }`}
                          >
                            <span
                              className="w-3 h-3 rounded-sm border border-white/40"
                              style={{ backgroundColor: BLOCK_CATALOG[bt].base }}
                            />
                            {BLOCK_CATALOG[bt].label}
                          </button>
                        ))}
                        <label className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 text-xs shrink-0">
                          Warna:
                          <input
                            type="color"
                            value={selectedBlockTint || '#ffffff'}
                            onChange={(e) => setSelectedBlockTint(e.target.value)}
                          />
                        </label>
                      </div>
                    )}

                    {/* Quick Templates Strip */}
                    {templates.length > 0 && (
                      <div className="flex items-center gap-2 text-xs overflow-x-auto">
                        <span className="text-slate-400 shrink-0">Templat Tersimpan:</span>
                        {templates.map((tpl) => (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => {
                              pushWorldChange((prev) => ({
                                ...prev,
                                blocks: [...prev.blocks, ...tpl.blocks],
                                structures: [...prev.structures, ...tpl.structures],
                              }));
                              showToast(`Templat "${tpl.name}" diterapkan ke dunia!`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 shrink-0"
                          >
                            + {tpl.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  /* Explorer Action & Safe Emote Dock */
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-slate-400 mr-1">Aksi Avatar:</span>
                      <button
                        type="button"
                        onClick={() => triggerEmote('wave', 'Melambai 👋')}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold"
                      >
                        Melambai
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerEmote('dance', 'Menari 🎵')}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold"
                      >
                        Menari
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerEmote('sit')}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold"
                      >
                        Duduk
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerEmote('raise_hand', 'Angkat Tangan ✋')}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold"
                      >
                        Angkat Tangan
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerEmote('hold_book', 'Jom Belajar! 📖')}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold"
                      >
                        Pegang Buku
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerEmote('celebrate', 'Tahniah! ⭐')}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold"
                      >
                        Raikan
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <span className="hidden sm:inline">
                        WASD Gerak · Space Lompat · Seret Skrin Putar 360° · E Interaksi
                      </span>
                      {activeWorld.musicZones.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveLearningModal({ musicZone: activeWorld.musicZones[0] })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-500"
                        >
                          <Music className="w-3.5 h-3.5" />
                          Lagu
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ======================================================== */}
      {/* MODALS & EDITORS                                         */}
      {/* ======================================================== */}
      {showAvatarCreator && (
        <AvatarCreator
          initialAvatar={avatar}
          customUniforms={activeWorld.customUniforms}
          isInsideStudio={studioModalMode}
          onSave={handleSaveAvatar}
          onClose={() => setShowAvatarCreator(false)}
        />
      )}

      {authModalTab && (
        <AuthAndWorldModal
          initialTab={authModalTab}
          currentUser={user}
          worlds={worldsList}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onEnterWorldCode={handleEnterWorldCode}
          onClose={() => setAuthModalTab(null)}
        />
      )}

      {activeLearningModal && (
        <LearningStationModal
          station={activeLearningModal.station}
          musicZone={activeLearningModal.musicZone}
          worldId={activeWorld.id}
          onCelebrate={() => triggerEmote('celebrate', 'Tahniah! ⭐')}
          onDanceToggle={(dancing) => setManualAnim(dancing ? 'dance' : null)}
          onRecordProgress={async (payload) => {
            if (!user) {
              await queueOfflineProgress(payload);
              showToast('Log masuk untuk menyegerakkan markah ke Dashboard Guru (disimpan sementara).');
              return;
            }
            try {
              const res = await recordStudentProgress(payload);
              setUser((prev) =>
                prev
                  ? { ...prev, badges: res.badges, totalStars: res.totalStars }
                  : prev
              );
            } catch {
              await queueOfflineProgress(payload);
              showToast('Rekod disimpan luar talian dan akan disegerakkan apabila pulih.');
            }
          }}
          onClose={() => setActiveLearningModal(null)}
        />
      )}

      {activeDialogue && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div>
              <div className="text-xs font-bold text-teal-700">{activeDialogue.subtitle}</div>
              <h3 className="font-display text-xl font-bold text-slate-900">
                {activeDialogue.title}
              </h3>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{activeDialogue.body}</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              {activeDialogue.stationId && (
                <button
                  type="button"
                  onClick={() => {
                    const st = activeWorld.stations.find(
                      (s) => s.id === activeDialogue.stationId
                    );
                    setActiveDialogue(null);
                    if (st) setActiveLearningModal({ station: st });
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
                >
                  Buka Cabaran Berkaitan
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveDialogue(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {contentEditorState && user?.role === 'guru' && (
        <TeacherContentEditor
          mode={contentEditorState.mode}
          initialPos={contentEditorState.pos}
          teacherName={user.name}
          onSaveStation={(st) => {
            pushWorldChange((prev) => ({
              ...prev,
              stations: [...prev.stations, st],
            }));
            showToast(`Stesen "${st.title}" ditambah! Klik Simpan / Terbitkan untuk menyegerak.`);
          }}
          onSaveMusic={(mz) => {
            pushWorldChange((prev) => ({
              ...prev,
              musicZones: [...prev.musicZones, mz],
            }));
            showToast(`Zon Lagu "${mz.title}" ditambah! Klik Simpan / Terbitkan untuk menyegerak.`);
          }}
          onClose={() => setContentEditorState(null)}
        />
      )}

      {showTeacherDashboard && user?.role === 'guru' && (
        <TeacherDashboard
          user={user}
          activeWorld={activeWorld}
          onOpenWorldForBuild={(w) => {
            setActiveWorld(w);
            setDayTimeMode(w.dayTimeMode || 'siang');
            setCreatorActive(true);
            setScreenMode('play');
          }}
          onWorldUpdated={(w) => {
            if (w.id === activeWorld.id) setActiveWorld(w);
            listWorlds().then(setWorldsList).catch(() => {});
          }}
          onClose={() => setShowTeacherDashboard(false)}
        />
      )}

      {badgesSettingsModal && (
        <BadgesAndSettingsModal
          mode={badgesSettingsModal}
          user={user}
          activeWorld={activeWorld}
          cameraMode={cameraMode}
          dayTimeMode={dayTimeMode}
          onChangeCameraMode={setCameraMode}
          onChangeDayTimeMode={setDayTimeMode}
          onLogout={handleLogout}
          onOpenAuth={() => setAuthModalTab('login')}
          onClose={() => setBadgesSettingsModal(null)}
        />
      )}
    </div>
  );
}
