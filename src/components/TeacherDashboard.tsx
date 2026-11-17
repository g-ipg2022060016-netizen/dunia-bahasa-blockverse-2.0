import React, { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  Copy,
  Download,
  FileText,
  Globe,
  History,
  Lock,
  Palette,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {
  createNewWorld,
  createWorldSnapshot,
  getTeacherAnalytics,
  loadWorldByCode,
  restoreWorldSnapshot,
  updateWorldOnServer,
} from '../services/api';
import {
  StudentProgressRecord,
  UserProfile,
  WorldData,
  WorldSummary,
} from '../types/blockverse';

interface TeacherDashboardProps {
  user: UserProfile;
  activeWorld: WorldData;
  onOpenWorldForBuild: (world: WorldData) => void;
  onWorldUpdated: (world: WorldData) => void;
  onClose: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  user,
  activeWorld,
  onOpenWorldForBuild,
  onWorldUpdated,
  onClose,
}) => {
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [records, setRecords] = useState<StudentProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'analitik' | 'dunia' | 'seragam'>('analitik');

  // New World form
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<WorldData['worldType']>('kreatif');
  const [creating, setCreating] = useState(false);

  // Selected world for snapshots / settings
  const [managedWorld, setManagedWorld] = useState<WorldData>(activeWorld);
  const [uniformName, setUniformName] = useState('');
  const [uniformTop, setUniformTop] = useState('#0284c7');
  const [uniformBottom, setUniformBottom] = useState('#0f172a');
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTeacherAnalytics();
      setWorlds(data.worlds);
      setRecords(data.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuatkan data guru.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const uniqueStudents = new Set(records.map((r) => r.studentId)).size;
  const completedCount = records.filter((r) => r.completed).length;
  const avgScore =
    records.length > 0
      ? Math.round(
          (records.reduce((s, r) => s + r.score / Math.max(1, r.maxScore), 0) /
            records.length) *
            100
        )
      : 0;

  const handleCreateWorld = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const created = await createNewWorld({
        title: newTitle.trim(),
        description: newDesc.trim(),
        worldType: newType,
      });
      setNewTitle('');
      setNewDesc('');
      setStatusNote(`Dunia baharu "${created.title}" dicipta! Kod Dunia: ${created.worldCode}`);
      await fetchAnalytics();
      setManagedWorld(created);
      onWorldUpdated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mencipta dunia.');
    } finally {
      setCreating(false);
    }
  };

  const handleLoadWorldDetails = async (worldCode: string) => {
    try {
      const full = await loadWorldByCode(worldCode);
      setManagedWorld(full);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuatkan dunia.');
    }
  };

  const handleToggleWorldSetting = async (
    w: WorldSummary,
    patch: Partial<Pick<WorldData, 'isPublished' | 'allowStudentBuild' | 'maxPlayers'>>
  ) => {
    try {
      const updated = await updateWorldOnServer(w.id, patch);
      setStatusNote(`Tetapan dunia ${updated.title} dikemas kini & disegerakkan.`);
      if (managedWorld.id === updated.id) setManagedWorld(updated);
      onWorldUpdated(updated);
      await fetchAnalytics();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengemas kini tetapan.');
    }
  };

  const handleCreateSnapshot = async () => {
    try {
      const res = await createWorldSnapshot(
        managedWorld.id,
        `Simpanan Manual (${new Date().toLocaleTimeString('ms-MY')})`
      );
      setManagedWorld((prev) => ({ ...prev, snapshots: res.snapshots }));
      setStatusNote('Titik pemulihan dunia berjaya disimpan.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan titik pemulihan.');
    }
  };

  const handleRestoreSnapshot = async (snapshotId: string) => {
    try {
      const restored = await restoreWorldSnapshot(managedWorld.id, snapshotId);
      setManagedWorld(restored);
      onWorldUpdated(restored);
      setStatusNote('Dunia berjaya dipulihkan ke versi pilihan!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memulihkan dunia.');
    }
  };

  const handleAddCustomUniform = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uniformName.trim()) return;
    const nextUniforms = [
      ...managedWorld.customUniforms,
      {
        id: `cu_${Date.now()}`,
        name: uniformName.trim(),
        topColor: uniformTop,
        bottomColor: uniformBottom,
      },
    ];
    try {
      const updated = await updateWorldOnServer(managedWorld.id, {
        customUniforms: nextUniforms,
      });
      setManagedWorld(updated);
      onWorldUpdated(updated);
      setUniformName('');
      setStatusNote('Pilihan warna seragam khas sekolah ditambah untuk murid!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menambah seragam.');
    }
  };

  const handleDownloadCSV = () => {
    const headers = [
      'Nama Murid',
      'Kod Dunia',
      'Dunia',
      'Stesen',
      'Ungkapan',
      'Kategori',
      'Skor',
      'Skor Maksimum',
      'Bilangan Percubaan',
      'Percubaan Salah',
      'Masa (Saat)',
      'Tahap Penguasaan',
      'Soalan Belum Dikuasai',
    ];
    const rows = records.map((r) => [
      `"${r.studentName.replace(/"/g, '""')}"`,
      r.worldCode,
      `"${r.worldTitle.replace(/"/g, '""')}"`,
      `"${r.stationTitle.replace(/"/g, '""')}"`,
      `"${r.expression.replace(/"/g, '""')}"`,
      r.category,
      r.score,
      r.maxScore,
      r.attempts,
      r.wrongAttempts,
      r.timeSpentSeconds,
      r.masteryLevel,
      `"${r.unmasteredQuestions.join(' | ').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-blockverse-${user.teacherCode || 'guru'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Laporan Kemajuan Dunia Bahasa Blockverse', 14, 18);
    doc.setFontSize(10);
    doc.text(`Guru: ${user.name} (${user.teacherCode || ''})`, 14, 26);
    doc.text(
      `Murid Aktif: ${uniqueStudents} | Rekod Selesai: ${completedCount} | Purata Skor: ${avgScore}%`,
      14,
      32
    );

    let y = 42;
    records.forEach((r, i) => {
      if (y > 275) {
        doc.addPage();
        y = 18;
      }
      doc.setFontSize(9.5);
      doc.text(
        `${i + 1}. ${r.studentName} | ${r.worldCode} - ${r.expression} | Skor: ${r.score}/${r.maxScore} | Percubaan: ${r.attempts} (Salah: ${r.wrongAttempts}) | ${r.masteryLevel}`,
        14,
        y
      );
      y += 7;
    });

    doc.save(`laporan-blockverse-${user.teacherCode || 'guru'}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs text-amber-300 font-semibold">
              Ruang Guru · ID Guru: {user.teacherCode || 'GURU'} · {user.name}
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold">
              Dashboard Analitik & Pengurusan Dunia Guru
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchAnalytics}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold hover:bg-white/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Segerak Data
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('analitik')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap ${
                tab === 'analitik'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              Analitik & Rekod Murid
            </button>
            <button
              type="button"
              onClick={() => setTab('dunia')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap ${
                tab === 'dunia'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              Dunia Saya & Pemulihan ({worlds.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('seragam')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap ${
                tab === 'seragam'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              Seragam Sekolah Khas
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-100"
            >
              <Download className="w-3.5 h-3.5" />
              Muat Turun CSV
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
            >
              <FileText className="w-3.5 h-3.5" />
              Muat Turun PDF
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold">
              {error}
            </div>
          )}
          {statusNote && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
              {statusNote}
            </div>
          )}

          {tab === 'analitik' && (
            <>
              {/* KPI Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-xs text-slate-500 font-semibold">Murid Menyertai</div>
                  <div className="text-2xl font-bold font-mono-nums text-slate-900 mt-1">
                    {uniqueStudents}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-xs text-slate-500 font-semibold">Dunia Milik Anda</div>
                  <div className="text-2xl font-bold font-mono-nums text-slate-900 mt-1">
                    {worlds.length}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-xs text-slate-500 font-semibold">Misi Diselesaikan</div>
                  <div className="text-2xl font-bold font-mono-nums text-emerald-700 mt-1">
                    {completedCount}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-xs text-slate-500 font-semibold">Purata Penguasaan</div>
                  <div className="text-2xl font-bold font-mono-nums text-sky-700 mt-1">
                    {avgScore}%
                  </div>
                </div>
              </div>

              {/* Student Progress Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-sky-600" />
                    Kemajuan Individu Murid & Soalan Belum Dikuasai
                  </h3>
                  <span className="text-xs text-slate-500 font-mono-nums">
                    {records.length} rekod disegerakkan
                  </span>
                </div>

                {loading ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    Memuatkan rekod kemajuan murid...
                  </div>
                ) : records.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    Belum ada rekod kuiz murid untuk dunia anda. Kongsikan Kod Dunia kepada murid!
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Murid & Avatar</th>
                          <th className="px-4 py-3">Dunia</th>
                          <th className="px-4 py-3">Stesen / Ungkapan</th>
                          <th className="px-4 py-3">Skor</th>
                          <th className="px-4 py-3">Percubaan</th>
                          <th className="px-4 py-3">Masa</th>
                          <th className="px-4 py-3">Penguasaan</th>
                          <th className="px-4 py-3">Belum Dikuasai</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {records.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-6 h-6 rounded-md border border-slate-300 shrink-0"
                                  style={{ backgroundColor: r.avatarSummary.skinColor }}
                                  title={`Seragam ${r.avatarSummary.uniformOption}`}
                                />
                                <div>
                                  <div className="font-bold text-slate-900">{r.studentName}</div>
                                  <div className="text-slate-500">
                                    Seragam {r.avatarSummary.uniformOption} · {r.avatarSummary.avatarName}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-800">{r.worldTitle}</div>
                              <div className="font-mono-nums text-slate-500">{r.worldCode}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">{r.expression}</div>
                              <div className="text-slate-500">{r.category}</div>
                            </td>
                            <td className="px-4 py-3 font-mono-nums font-bold text-slate-900">
                              {r.score}/{r.maxScore}
                            </td>
                            <td className="px-4 py-3 font-mono-nums text-slate-700">
                              {r.attempts} ({r.wrongAttempts} salah)
                            </td>
                            <td className="px-4 py-3 font-mono-nums text-slate-700">
                              {r.timeSpentSeconds}s
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`font-semibold ${
                                  r.masteryLevel === 'Cemerlang'
                                    ? 'text-emerald-700'
                                    : r.masteryLevel === 'Menguasai'
                                    ? 'text-sky-700'
                                    : 'text-amber-700'
                                }`}
                              >
                                {r.masteryLevel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 max-w-xs">
                              {r.unmasteredQuestions.length === 0
                                ? 'Semua dikuasai'
                                : r.unmasteredQuestions.join('; ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'dunia' && (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Create Dunia 5, 6... + Manage Existing Worlds */}
              <div className="space-y-5">
                <form
                  onSubmit={handleCreateWorld}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3"
                >
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-sky-600" />
                    Bina Dunia Baharu (Dunia 5, 6 dan seterusnya)
                  </h3>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Nama Dunia (cth: Taman Peribahasa Tahun 4)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                  <input
                    type="text"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Penerangan ringkas untuk murid..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as WorldData['worldType'])}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                    >
                      <option value="kreatif">Templat Creative World (Kosong)</option>
                      <option value="kampung">Tema Kampung Melayu</option>
                      <option value="hutan">Tema Hutan Perumpamaan</option>
                      <option value="istana">Tema Istana Melayu</option>
                    </select>
                    <button
                      type="submit"
                      disabled={creating}
                      className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700"
                    >
                      {creating ? 'Mencipta...' : 'Cipta Dunia'}
                    </button>
                  </div>
                </form>

                <div className="space-y-3">
                  {worlds.map((w) => (
                    <div
                      key={w.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-sky-600" />
                            <span className="font-bold text-sm text-slate-900">{w.title}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                            <span>Kod Dunia:</span>
                            <code className="font-mono-nums font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                              {w.worldCode}
                            </code>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard?.writeText(w.worldCode)}
                              className="inline-flex items-center gap-1 text-sky-700 hover:underline"
                            >
                              <Copy className="w-3 h-3" /> Salin
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={async () => {
                            const full = await loadWorldByCode(w.worldCode);
                            onOpenWorldForBuild(full);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          Buka & Bina
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs pt-2 border-t border-slate-100">
                        <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={w.isPublished}
                            onChange={(e) =>
                              handleToggleWorldSetting(w, { isPublished: e.target.checked })
                            }
                          />
                          Diterbitkan (Murid boleh masuk)
                        </label>
                        <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={w.allowStudentBuild}
                            onChange={(e) =>
                              handleToggleWorldSetting(w, { allowStudentBuild: e.target.checked })
                            }
                          />
                          Benarkan Murid Membina
                        </label>
                        <button
                          type="button"
                          onClick={() => handleLoadWorldDetails(w.worldCode)}
                          className="text-sky-700 font-semibold hover:underline"
                        >
                          Urus Titik Pemulihan
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Snapshot & Restore System */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <History className="w-4 h-4 text-amber-600" />
                      Sistem Pemulihan Dunia: {managedWorld.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Kod: {managedWorld.worldCode} · Versi Semasa: {managedWorld.version}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateSnapshot}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
                  >
                    Simpan Titik Pulih
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center gap-2 text-xs text-slate-700">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Kawalan Keselamatan Aktif: Hanya akaun guru pemilik ({user.teacherCode}) boleh
                    mengubah struktur teras atau mengakses rekod murid dunia ini.
                  </span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {managedWorld.snapshots.length === 0 ? (
                    <div className="text-xs text-slate-500 py-4 text-center">
                      Tiada titik pemulihan lagi. Klik "Simpan Titik Pulih" sebelum membuat ubah suai besar.
                    </div>
                  ) : (
                    managedWorld.snapshots.map((snap) => (
                      <div
                        key={snap.id}
                        className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{snap.note}</div>
                          <div className="text-slate-500">
                            {new Date(snap.savedAt).toLocaleString('ms-MY')} · {snap.blocks.length}{' '}
                            blok · {snap.stations.length} stesen
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRestoreSnapshot(snap.id)}
                          className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-950 font-bold hover:bg-amber-200"
                        >
                          Pulihkan
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'seragam' && (
            <div className="max-w-xl space-y-5">
              <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-950 flex items-start gap-2.5">
                <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Guru boleh menambah pilihan warna pakaian sekolah atau rumah sukan khas untuk dunia{' '}
                  <strong>{managedWorld.title}</strong> tanpa menggunakan logo sekolah sebenar tanpa kebenaran.
                </span>
              </div>

              <form onSubmit={handleAddCustomUniform} className="p-4 rounded-2xl border border-slate-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-sky-600" />
                  Tambah Warna Pakaian Khas Sekolah
                </h3>
                <input
                  type="text"
                  required
                  value={uniformName}
                  onChange={(e) => setUniformName(e.target.value)}
                  placeholder="Contoh: Baju Rumah Sukan Merah / Pengawas Pusat Sumber"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-2 font-semibold">
                    Warna Baju:
                    <input
                      type="color"
                      value={uniformTop}
                      onChange={(e) => setUniformTop(e.target.value)}
                    />
                  </label>
                  <label className="flex items-center gap-2 font-semibold">
                    Warna Seluar/Kain:
                    <input
                      type="color"
                      value={uniformBottom}
                      onChange={(e) => setUniformBottom(e.target.value)}
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
                >
                  Simpan Pilihan Pakaian
                </button>
              </form>

              {managedWorld.customUniforms.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700">Pakaian Tambahan Semasa:</h4>
                  {managedWorld.customUniforms.map((cu) => (
                    <div
                      key={cu.id}
                      className="p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 font-semibold">
                        <span
                          className="w-5 h-5 rounded border border-slate-300"
                          style={{ backgroundColor: cu.topColor }}
                        />
                        <span
                          className="w-5 h-5 rounded border border-slate-300"
                          style={{ backgroundColor: cu.bottomColor }}
                        />
                        {cu.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
