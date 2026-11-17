import React, { useEffect, useState } from 'react';
import {
  Award,
  CheckCircle2,
  CloudOff,
  DownloadCloud,
  LogOut,
  RefreshCw,
  Settings,
  Star,
  X,
} from 'lucide-react';
import { BADGE_CATALOG } from '../data/curriculumDefaults';
import {
  cacheWorldForOffline,
  countPendingOfflineProgress,
  flushOfflineProgressQueue,
  listOfflineCachedWorlds,
} from '../services/offlineSync';
import { UserProfile, WorldData } from '../types/blockverse';

interface BadgesAndSettingsModalProps {
  mode: 'badges' | 'settings';
  user: UserProfile | null;
  activeWorld: WorldData;
  cameraMode: 'third' | 'first';
  dayTimeMode: 'siang' | 'senja' | 'malam' | 'kitaran';
  onChangeCameraMode: (m: 'third' | 'first') => void;
  onChangeDayTimeMode: (d: 'siang' | 'senja' | 'malam' | 'kitaran') => void;
  onLogout: () => Promise<void>;
  onOpenAuth: () => void;
  onClose: () => void;
}

export const BadgesAndSettingsModal: React.FC<BadgesAndSettingsModalProps> = ({
  mode,
  user,
  activeWorld,
  cameraMode,
  dayTimeMode,
  onChangeCameraMode,
  onChangeDayTimeMode,
  onLogout,
  onOpenAuth,
  onClose,
}) => {
  const [cachedWorlds, setCachedWorlds] = useState<(WorldData & { cachedAt?: string })[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const refreshOfflineStatus = async () => {
    setCachedWorlds(await listOfflineCachedWorlds());
    setPendingCount(await countPendingOfflineProgress());
  };

  useEffect(() => {
    if (mode === 'settings') {
      refreshOfflineStatus();
    }
  }, [mode]);

  const handleDownloadOffline = async () => {
    await cacheWorldForOffline(activeWorld);
    await refreshOfflineStatus();
    setSyncMsg(`Dunia "${activeWorld.title}" disimpan untuk akses luar talian!`);
  };

  const handleFlushQueue = async () => {
    const synced = await flushOfflineProgressQueue();
    await refreshOfflineStatus();
    setSyncMsg(
      synced > 0
        ? `${synced} rekod luar talian berjaya disegerakkan ke pelayan!`
        : 'Tiada rekod tertunda atau sambungan belum pulih.'
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {mode === 'badges' ? (
              <Award className="w-5 h-5 text-amber-400" />
            ) : (
              <Settings className="w-5 h-5 text-sky-400" />
            )}
            <div>
              <h2 className="font-display text-xl font-bold">
                {mode === 'badges' ? 'Koleksi Lencana Bahasa' : 'Tetapan & Mod Luar Talian'}
              </h2>
              <p className="text-xs text-slate-300">
                {mode === 'badges'
                  ? `Jumlah Bintang Terkumpul: ${user?.totalStars ?? 0} Bintang`
                  : 'Kamera, pencahayaan siang/malam, dan penyegerakan luar talian'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {mode === 'badges' ? (
            <>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-amber-900">Pencapaian Anda</div>
                  <div className="text-lg font-bold text-slate-900">
                    {user?.badges.length ?? 0} / {BADGE_CATALOG.length} Lencana Dibuka
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-sm font-mono-nums">
                  <Star className="w-4 h-4 fill-slate-950" />
                  {user?.totalStars ?? 0} Bintang
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {BADGE_CATALOG.map((b) => {
                  const unlocked = user?.badges.includes(b.id);
                  return (
                    <div
                      key={b.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        unlocked
                          ? 'border-emerald-300 bg-emerald-50/70'
                          : 'border-slate-200 bg-slate-50 opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: unlocked ? b.color : '#94a3b8' }}
                        >
                          <Award className="w-5 h-5" />
                        </div>
                        {unlocked && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                            <CheckCircle2 className="w-4 h-4" />
                            Diperoleh
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 mt-3">{b.title}</h3>
                      <p className="text-xs text-slate-600 mt-1">{b.description}</p>
                      <div className="text-xs text-slate-500 mt-2 font-medium">
                        Syarat: {b.criteria}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {syncMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
                  {syncMsg}
                </div>
              )}

              {/* Camera & Atmosphere */}
              <div className="p-4 rounded-2xl border border-slate-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Kamera & Suasana Dunia 3D</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Mod Kamera (Kekunci V)
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onChangeCameraMode('third')}
                        className={`flex-1 py-2 rounded-xl border text-xs font-bold ${
                          cameraMode === 'third'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        Orang Ketiga
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeCameraMode('first')}
                        className={`flex-1 py-2 rounded-xl border text-xs font-bold ${
                          cameraMode === 'first'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        Orang Pertama
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Pencahayaan Langit
                    </label>
                    <select
                      value={dayTimeMode}
                      onChange={(e) =>
                        onChangeDayTimeMode(
                          e.target.value as 'siang' | 'senja' | 'malam' | 'kitaran'
                        )
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                    >
                      <option value="siang">Siang Cerah</option>
                      <option value="senja">Senja Keemasan</option>
                      <option value="malam">Suasana Malam Berbintang</option>
                      <option value="kitaran">Kitaran Siang & Malam Automatik</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Offline Cache & Resync */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CloudOff className="w-4 h-4 text-sky-600" />
                    Akses Luar Talian & Penyegerakan Semula
                  </h3>
                  <span className="text-xs font-mono-nums font-semibold text-slate-600">
                    Rekod tertunda: {pendingCount}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Muat turun dunia aktif terlebih dahulu ke peranti anda supaya murid boleh terus
                  belajar walaupun sambungan Internet terputus. Rekod akan disegerakkan apabila
                  sambungan pulih.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadOffline}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700"
                  >
                    <DownloadCloud className="w-4 h-4" />
                    Muat Turun "{activeWorld.title}"
                  </button>
                  <button
                    type="button"
                    onClick={handleFlushQueue}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-bold hover:bg-slate-100"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Segerak Rekod Tertunda
                  </button>
                </div>
                {cachedWorlds.length > 0 && (
                  <div className="text-xs text-slate-600">
                    Dunia tersimpan luar talian:{' '}
                    {cachedWorlds.map((cw) => `${cw.title} (${cw.worldCode})`).join(', ')}
                  </div>
                )}
              </div>

              {/* Account Status */}
              <div className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                {user ? (
                  <>
                    <div className="text-xs">
                      <div className="font-bold text-slate-900">{user.name}</div>
                      <div className="text-slate-600">
                        {user.email} · Peranan: {user.role === 'guru' ? 'Guru' : 'Murid'}
                        {user.teacherCode ? ` · ID Guru: ${user.teacherCode}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onLogout}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-bold hover:bg-rose-100"
                    >
                      <LogOut className="w-4 h-4" />
                      Log Keluar
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-slate-600">
                      Anda sedang meneroka sebagai tetamu. Log masuk untuk menyimpan avatar & rekod
                      merentas peranti.
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAuth();
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                    >
                      Log Masuk
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
