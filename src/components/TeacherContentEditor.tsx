import React, { useRef, useState } from 'react';
import {
  FileUp,
  Mic,
  Music,
  Plus,
  Save,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { uploadMediaFile } from '../services/api';
import {
  ActivityType,
  LanguageCategory,
  LearningStation,
  MusicZone,
  QuizQuestion,
} from '../types/blockverse';

interface TeacherContentEditorProps {
  mode: 'station' | 'music';
  initialPos?: { x: number; y: number; z: number };
  existingStation?: LearningStation;
  existingMusic?: MusicZone;
  teacherName: string;
  onSaveStation?: (station: LearningStation) => void;
  onSaveMusic?: (music: MusicZone) => void;
  onClose: () => void;
}

export const TeacherContentEditor: React.FC<TeacherContentEditorProps> = ({
  mode,
  initialPos = { x: 4, y: 0, z: 4 },
  existingStation,
  existingMusic,
  teacherName,
  onSaveStation,
  onSaveMusic,
  onClose,
}) => {
  // Station form state
  const [title, setTitle] = useState(
    existingStation?.title || existingMusic?.title || ''
  );
  const [expression, setExpression] = useState(existingStation?.expression || '');
  const [category, setCategory] = useState<LanguageCategory>(
    existingStation?.category || 'Simpulan Bahasa'
  );
  const [meaning, setMeaning] = useState(existingStation?.meaning || '');
  const [exampleSentence, setExampleSentence] = useState(
    existingStation?.exampleSentence || ''
  );
  const [teacherNotes, setTeacherNotes] = useState(
    existingStation?.teacherNotes || ''
  );
  const [audioUrl, setAudioUrl] = useState(
    existingStation?.audioUrl || existingMusic?.audioUrl || ''
  );
  const [videoUrl, setVideoUrl] = useState(existingStation?.videoUrl || '');
  const [imageUrl, setImageUrl] = useState(existingStation?.imageUrl || '');
  const [pdfUrl, setPdfUrl] = useState(existingStation?.pdfUrl || '');
  const [externalLink, setExternalLink] = useState(
    existingStation?.externalLink || ''
  );

  // Music Builder specific state
  const [lyricsText, setLyricsText] = useState(
    existingMusic?.lyrics.join('\n') ||
      'Mari kawan belajar bahasa,\nRingan tulang setiap masa!'
  );
  const [synthMelodyId, setSynthMelodyId] = useState<
    NonNullable<MusicZone['synthMelodyId']>
  >(existingMusic?.synthMelodyId || 'lagu_ringan_tulang');
  const [isBgMusic, setIsBgMusic] = useState(
    existingMusic?.isBackgroundMusic ?? false
  );
  const [volume, setVolume] = useState(existingMusic?.volume ?? 0.75);

  // Quiz Questions state
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    existingStation?.questions || existingMusic?.questions || []
  );
  const [qPrompt, setQPrompt] = useState('');
  const [qType, setQType] = useState<ActivityType>('situasi_kefahaman');
  const [qOpt1, setQOpt1] = useState('');
  const [qOpt2, setQOpt2] = useState('');
  const [qOpt3, setQOpt3] = useState('');
  const [qOpt4, setQOpt4] = useState('');
  const [qCorrect, setQCorrect] = useState('');
  const [qExplain, setQExplain] = useState('');

  // Upload & Voice Recording
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const handleFileUpload = async (
    file: File | undefined,
    target: 'audio' | 'image' | 'pdf'
  ) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await uploadMediaFile(file);
      if (target === 'audio') setAudioUrl(res.url);
      else if (target === 'image') setImageUrl(res.url);
      else if (target === 'pdf') setPdfUrl(res.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Muat naik gagal.');
    } finally {
      setUploading(false);
    }
  };

  const toggleRecordVoice = async () => {
    if (recording && mediaRecRef.current) {
      mediaRecRef.current.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `rakaman_${Date.now()}.webm`, {
          type: 'audio/webm',
        });
        await handleFileUpload(file, 'audio');
      };
      rec.start();
      mediaRecRef.current = rec;
      setRecording(true);
    } catch {
      setUploadError('Mikrofon tidak dapat diakses pada pelayar ini.');
    }
  };

  const handleAddQuestion = () => {
    if (!qPrompt.trim()) return;
    if (qType === 'susun_ayat') {
      const answer = qCorrect.trim();
      if (!answer) return;
      const words = answer.split(/\s+/);
      const scrambled = [...words].sort(() => Math.random() - 0.5);
      setQuestions((prev) => [
        ...prev,
        {
          id: `q_${Date.now()}`,
          activityType: 'susun_ayat',
          prompt: qPrompt.trim(),
          options: [],
          scrambledWords: scrambled,
          correctAnswer: answer,
          explanation: qExplain.trim() || 'Susunan ayat yang betul.',
          points: 25,
        },
      ]);
    } else {
      const opts = [qOpt1, qOpt2, qOpt3, qOpt4].map((o) => o.trim()).filter(Boolean);
      const correct = qCorrect.trim() || opts[0] || '';
      if (opts.length < 2 || !correct) return;
      setQuestions((prev) => [
        ...prev,
        {
          id: `q_${Date.now()}`,
          activityType: qType,
          prompt: qPrompt.trim(),
          options: opts,
          correctAnswer: correct,
          explanation: qExplain.trim() || 'Jawapan tepat!',
          points: 20,
        },
      ]);
    }
    setQPrompt('');
    setQOpt1('');
    setQOpt2('');
    setQOpt3('');
    setQOpt4('');
    setQCorrect('');
    setQExplain('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'station' && onSaveStation) {
      onSaveStation({
        id: existingStation?.id || `st_${Date.now()}`,
        title: title.trim() || `Rumah ${expression.trim()}`,
        expression: expression.trim() || title.trim(),
        category,
        meaning: meaning.trim(),
        exampleSentence: exampleSentence.trim(),
        teacherNotes: teacherNotes.trim(),
        audioUrl: audioUrl.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        pdfUrl: pdfUrl.trim() || undefined,
        externalLink: externalLink.trim() || undefined,
        x: existingStation?.x ?? initialPos.x,
        y: existingStation?.y ?? initialPos.y,
        z: existingStation?.z ?? initialPos.z,
        questions,
      });
    } else if (mode === 'music' && onSaveMusic) {
      onSaveMusic({
        id: existingMusic?.id || `mz_${Date.now()}`,
        title: title.trim() || 'Taman Lagu Bahasa',
        artistOrTeacher: teacherName,
        x: existingMusic?.x ?? initialPos.x,
        y: existingMusic?.y ?? initialPos.y,
        z: existingMusic?.z ?? initialPos.z,
        radius: existingMusic?.radius ?? 5,
        audioUrl: audioUrl.trim() || undefined,
        synthMelodyId,
        lyrics: lyricsText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
        isBackgroundMusic: isBgMusic,
        volume,
        questions,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <form
        onSubmit={handleSave}
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {mode === 'music' && <Music className="w-5 h-5 text-amber-400" />}
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold">
                {mode === 'music'
                  ? 'Music Builder — Bina Zon Lagu Interaktif'
                  : 'Editor Kandungan Pembelajaran Guru'}
              </h2>
              <p className="text-xs text-slate-300">
                Lokasi 3D: ({initialPos.x}, {initialPos.y}, {initialPos.z})
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

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {uploadError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold">
              {uploadError}
            </div>
          )}

          {mode === 'station' ? (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Stesen / Rumah
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: Rumah Hati Emas"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenis Peribahasa
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as LanguageCategory)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  >
                    <option value="Simpulan Bahasa">Simpulan Bahasa</option>
                    <option value="Perumpamaan">Perumpamaan</option>
                    <option value="Pepatah">Pepatah</option>
                    <option value="Bidalan">Bidalan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ungkapan {category}
                </label>
                <input
                  type="text"
                  required
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  placeholder="Contoh: Hati emas"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Maksud
                </label>
                <textarea
                  required
                  rows={2}
                  value={meaning}
                  onChange={(e) => setMeaning(e.target.value)}
                  placeholder="Contoh: Orang yang sangat baik hati dan suka menolong."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contoh Ayat
                </label>
                <textarea
                  required
                  rows={2}
                  value={exampleSentence}
                  onChange={(e) => setExampleSentence(e.target.value)}
                  placeholder="Contoh: Cikgu Aini berhati emas kerana sentiasa membantu murid yang susah."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nota Guru & Buku Digital
                </label>
                <textarea
                  rows={2}
                  value={teacherNotes}
                  onChange={(e) => setTeacherNotes(e.target.value)}
                  placeholder="Nota tambahan untuk murid selepas 3 percubaan salah..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              {/* Multimedia Attachments */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-800">
                  Lampiran Multimedia (Audio / Rakaman Suara / Gambar / PDF / Video)
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold cursor-pointer hover:bg-slate-100">
                    <FileUp className="w-3.5 h-3.5" />
                    Muat Naik Audio
                    <input
                      type="file"
                      accept=".mp3,.wav,.ogg,.webm,.m4a"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e.target.files?.[0], 'audio')}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={toggleRecordVoice}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold ${
                      recording
                        ? 'bg-rose-600 text-white'
                        : 'bg-white border border-slate-300 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {recording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    {recording ? 'Henti Rakam Suara' : 'Rakam Suara Guru'}
                  </button>

                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold cursor-pointer hover:bg-slate-100">
                    <FileUp className="w-3.5 h-3.5" />
                    Muat Naik Gambar
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e.target.files?.[0], 'image')}
                    />
                  </label>

                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold cursor-pointer hover:bg-slate-100">
                    <FileUp className="w-3.5 h-3.5" />
                    Muat Naik PDF
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e.target.files?.[0], 'pdf')}
                    />
                  </label>
                </div>

                {uploading && <div className="text-xs text-sky-700 font-semibold">Sedang memuat naik fail...</div>}
                {audioUrl && <div className="text-xs text-emerald-700">Audio tersedia: {audioUrl}</div>}
                {imageUrl && <div className="text-xs text-emerald-700">Gambar tersedia: {imageUrl}</div>}
                {pdfUrl && <div className="text-xs text-emerald-700">PDF tersedia: {pdfUrl}</div>}

                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="Pautan Video Pembelajaran (https://...)"
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                  <input
                    type="url"
                    value={externalLink}
                    onChange={(e) => setExternalLink(e.target.value)}
                    placeholder="Pautan Nota / Buku Digital (https://...)"
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Zon / Tajuk Lagu Pembelajaran
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Taman Lagu Simpulan Bahasa"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="p-4 rounded-xl bg-violet-50 border border-violet-200 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-700 text-white text-xs font-semibold cursor-pointer hover:bg-violet-800">
                    <FileUp className="w-4 h-4" />
                    Muat Naik Fail MP3 / Audio
                    <input
                      type="file"
                      accept=".mp3,.wav,.ogg,.webm,.m4a"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e.target.files?.[0], 'audio')}
                    />
                  </label>
                  <span className="text-xs text-violet-800">
                    {audioUrl ? `Fail dimuat naik: ${audioUrl}` : 'Atau pilih melodi terbina di bawah:'}
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Melodi Terbina (Jika tiada MP3)
                    </label>
                    <select
                      value={synthMelodyId}
                      onChange={(e) =>
                        setSynthMelodyId(e.target.value as NonNullable<MusicZone['synthMelodyId']>)
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    >
                      <option value="lagu_ringan_tulang">Melodi Ringan Tulang</option>
                      <option value="irama_pantun">Irama Pantun Rimba</option>
                      <option value="ceria_kampung">Ceria Kampung Melayu</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-end gap-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={isBgMusic}
                        onChange={(e) => setIsBgMusic(e.target.checked)}
                      />
                      Gunakan sebagai muzik latar zon
                    </label>
                    <div className="flex items-center gap-2 text-xs">
                      <span>Kelantangan:</span>
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lirik Lagu (Satu baris bagi setiap rangkap)
                </label>
                <textarea
                  rows={5}
                  value={lyricsText}
                  onChange={(e) => setLyricsText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </>
          )}

          {/* Quiz Builder Section */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-amber-950">
                Soalan & Aktiviti Interaktif ({questions.length} soalan ditambah)
              </div>
            </div>

            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="p-2.5 rounded-lg bg-white border border-amber-200 flex items-start justify-between gap-2 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900">
                    {idx + 1}. {q.prompt}
                  </div>
                  <div className="text-emerald-700 mt-0.5">Jawapan: {q.correctAnswer}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setQuestions((prev) => prev.filter((item) => item.id !== q.id))}
                  className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-amber-200">
              <select
                value={qType}
                onChange={(e) => setQType(e.target.value as ActivityType)}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
              >
                <option value="situasi_kefahaman">Soalan Situasi & Kefahaman</option>
                <option value="padanan">Aktiviti Padanan</option>
                <option value="teka_teki">Teka-Teki Bahasa</option>
                <option value="susun_ayat">Aktiviti Susun Ayat</option>
              </select>
              <input
                type="text"
                value={qPrompt}
                onChange={(e) => setQPrompt(e.target.value)}
                placeholder="Tulis soalan atau situasi..."
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
              />
            </div>

            {qType !== 'susun_ayat' && (
              <div className="grid sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={qOpt1}
                  onChange={(e) => setQOpt1(e.target.value)}
                  placeholder="Pilihan 1 (cth: Ringan tulang)"
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                />
                <input
                  type="text"
                  value={qOpt2}
                  onChange={(e) => setQOpt2(e.target.value)}
                  placeholder="Pilihan 2"
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                />
                <input
                  type="text"
                  value={qOpt3}
                  onChange={(e) => setQOpt3(e.target.value)}
                  placeholder="Pilihan 3"
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                />
                <input
                  type="text"
                  value={qOpt4}
                  onChange={(e) => setQOpt4(e.target.value)}
                  placeholder="Pilihan 4"
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={qCorrect}
                onChange={(e) => setQCorrect(e.target.value)}
                placeholder={
                  qType === 'susun_ayat'
                    ? 'Ayat penuh yang betul'
                    : 'Jawapan tepat (sama seperti salah satu pilihan)'
                }
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
              />
              <input
                type="text"
                value={qExplain}
                onChange={(e) => setQExplain(e.target.value)}
                placeholder="Penerangan apabila betul"
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
              />
            </div>

            <button
              type="button"
              onClick={handleAddQuestion}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Soalan ke Stesen Ini
            </button>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700"
          >
            Batal
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
          >
            <Save className="w-4 h-4" />
            Simpan ke Dunia 3D
          </button>
        </div>
      </form>
    </div>
  );
};
