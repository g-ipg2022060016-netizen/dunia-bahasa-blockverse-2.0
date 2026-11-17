import React, { useState } from 'react';
import { Globe, KeyRound, LogIn, UserPlus, X } from 'lucide-react';
import { isSupabaseEnabled } from '../services/supabaseClient';
import { UserProfile, UserRole, WorldSummary } from '../types/blockverse';

interface AuthAndWorldModalProps {
  initialTab: 'login' | 'world';
  currentUser: UserProfile | null;
  worlds: WorldSummary[];
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }) => Promise<void>;
  onEnterWorldCode: (code: string) => Promise<void>;
  onClose: () => void;
}

export const AuthAndWorldModal: React.FC<AuthAndWorldModalProps> = ({
  initialTab,
  currentUser,
  worlds,
  onLogin,
  onRegister,
  onEnterWorldCode,
  onClose,
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'world'>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('murid');
  const [worldCodeInput, setWorldCodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (tab === 'login') {
        await onLogin(email, password);
      } else {
        await onRegister({ name, email, password, role });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pengesahan gagal.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoinCode = async (code: string) => {
    setError(null);
    setBusy(true);
    try {
      await onEnterWorldCode(code);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kod Dunia tidak dijumpai.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">
              {tab === 'world' ? 'Masuk Dunia Pembelajaran' : 'Akaun Guru & Murid Blockverse'}
            </h2>
            <p className="text-xs text-slate-300">
              {tab === 'world'
                ? 'Pilih dunia utama atau masukkan Kod Dunia daripada guru anda'
                : 'Log masuk untuk menyegerakkan avatar, dunia binaan, dan markah merentas peranti'}
            </p>
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

        {/* Mode Tabs */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-200 bg-slate-50 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setTab('world');
              setError(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap ${
              tab === 'world'
                ? 'bg-sky-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Pilih / Kod Dunia
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap ${
              tab === 'login'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Log Masuk Akaun
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap ${
              tab === 'register'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Daftar Akaun Baharu
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold">
              {error}
            </div>
          )}

          {tab === 'world' ? (
            <div className="space-y-5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (worldCodeInput.trim()) handleJoinCode(worldCodeInput.trim());
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={worldCodeInput}
                  onChange={(e) => setWorldCodeInput(e.target.value.toUpperCase())}
                  placeholder="Masukkan Kod Dunia (cth: KAMPUNG01)"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono-nums uppercase"
                />
                <button
                  type="submit"
                  disabled={busy || !worldCodeInput.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-sm font-bold hover:bg-amber-400 disabled:opacity-50 whitespace-nowrap"
                >
                  <KeyRound className="w-4 h-4" />
                  Sertai
                </button>
              </form>

              <div>
                <h3 className="text-xs font-bold text-slate-600 mb-2.5">
                  Dunia Pembelajaran Tersedia:
                </h3>
                <div className="space-y-2.5">
                  {worlds.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      disabled={busy}
                      onClick={() => handleJoinCode(w.worldCode)}
                      className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50 transition-all flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-sky-600 shrink-0" />
                          <span className="font-bold text-sm text-slate-900 truncate">{w.title}</span>
                          <span className="font-mono-nums text-xs text-slate-500">
                            · {w.worldCode}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-1">{w.description}</p>
                        <div className="text-xs text-slate-500 mt-1">
                          Guru: {w.ownerName} · {w.stationCount} Stesen · {w.musicCount} Zon Muzik
                        </div>
                      </div>
                      <span className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold shrink-0">
                        Masuk
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {currentUser && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                  Anda sedang log masuk sebagai <strong>{currentUser.name}</strong> ({currentUser.role === 'guru' ? 'Guru' : 'Murid'}).
                </div>
              )}

              {tab === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Penuh
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Contoh: Cikgu Farhana / Aiman Danish"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Peranan Akaun
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRole('murid')}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold ${
                          role === 'murid'
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        Akaun Murid (Peneroka)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('guru')}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold ${
                          role === 'guru'
                            ? 'bg-amber-500 text-slate-950 border-amber-500'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        Akaun Guru (Pencipta Dunia)
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-mel</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@sekolah.edu.my"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kata Laluan
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sekurang-kurangnya 6 aksara"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50"
              >
                {tab === 'login' ? (
                  <>
                    <LogIn className="w-4 h-4" />
                    Log Masuk Selamat
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Daftar Akaun
                  </>
                )}
              </button>

              {tab === 'login' && (
                isSupabaseEnabled() ? (
                  <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 space-y-2">
                    <div className="text-xs font-bold text-sky-950">
                      Akaun Awan Supabase Aktif
                    </div>
                    <p className="text-xs text-sky-900 leading-relaxed">
                      Jika anda baru kali pertama menggunakan pangkalan data Supabase ini, sila daftar akaun Guru atau Murid baharu dahulu untuk menyegerakkan avatar dan dunia binaan anda.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setTab('register');
                        setError(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Daftar Akaun Baharu Sekarang
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="text-xs font-bold text-slate-700">
                      Akaun Ujian Pantas (Uji Guru & Murid Merentas Peranti):
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('cikgu.aminah@sekolah.edu.my');
                          setPassword('BlokBahasa2026!');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-950 text-xs font-semibold hover:bg-amber-200"
                      >
                        Isi Akaun Guru (Cikgu Aminah)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('amir@murid.edu.my');
                          setPassword('Murid123!');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-sky-100 text-sky-950 text-xs font-semibold hover:bg-sky-200"
                      >
                        Isi Akaun Murid (Amir)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('aisyah@murid.edu.my');
                          setPassword('Murid123!');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-950 text-xs font-semibold hover:bg-emerald-200"
                      >
                        Isi Akaun Murid (Aisyah)
                      </button>
                    </div>
                  </div>
                )
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
