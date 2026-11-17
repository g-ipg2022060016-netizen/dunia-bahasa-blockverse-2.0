import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileText,
  Music,
  Pause,
  Play,
  RotateCcw,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import {
  MusicZonePlayer,
  playBlockSound,
  speakMalayText,
  stopMalaySpeech,
} from '../services/audioSynth';
import {
  LearningStation,
  MusicZone,
  QuizQuestion,
  StudentProgressRecord,
} from '../types/blockverse';

interface LearningStationModalProps {
  station?: LearningStation;
  musicZone?: MusicZone;
  worldId: string;
  onCelebrate: () => void;
  onDanceToggle: (dancing: boolean) => void;
  onRecordProgress: (payload: {
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
    historyEntry: StudentProgressRecord['history'][0];
    badgeUnlocked?: string;
  }) => Promise<void>;
  onClose: () => void;
}

export const LearningStationModal: React.FC<LearningStationModalProps> = ({
  station,
  musicZone,
  worldId,
  onCelebrate,
  onDanceToggle,
  onRecordProgress,
  onClose,
}) => {
  const isMusic = Boolean(musicZone);
  const questions: QuizQuestion[] = station?.questions || musicZone?.questions || [];

  const [tab, setTab] = useState<'nota' | 'aktiviti'>(isMusic ? 'nota' : 'nota');
  const [qIndex, setQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [arrangedWords, setArrangedWords] = useState<string[]>([]);
  const [wrongStreak, setWrongStreak] = useState(0);
  const [totalWrong, setTotalWrong] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [earnedScore, setEarnedScore] = useState(0);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [forcedNoteReview, setForcedNoteReview] = useState(false);
  const [completedAll, setCompletedAll] = useState(false);

  // Music state
  const playerRef = useRef<MusicZonePlayer | null>(null);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [musicEnded, setMusicEnded] = useState(false);
  const [activeLyricIdx, setActiveLyricIdx] = useState(0);
  const [musicVol, setMusicVol] = useState(musicZone?.volume ?? 0.75);

  const startedAtRef = useRef<number>(Date.now());
  const currentQuestion = questions[qIndex];
  const maxScore = questions.reduce((acc, q) => acc + (q.points || 20), 0) || 20;

  useEffect(() => {
    playerRef.current = new MusicZonePlayer();
    return () => {
      playerRef.current?.stop();
      stopMalaySpeech();
      onDanceToggle(false);
    };
  }, []);

  const handlePlayAudioExplanation = () => {
    if (station?.audioUrl) {
      const a = new Audio(station.audioUrl);
      a.play().catch(() => {
        speakMalayText(
          `${station.expression}. Maksudnya, ${station.meaning}. Contoh ayat: ${station.exampleSentence}`
        );
      });
    } else if (station) {
      speakMalayText(
        `${station.expression}. Maksudnya, ${station.meaning}. Contoh ayat: ${station.exampleSentence}`
      );
    }
  };

  const handleStartMusic = () => {
    if (!musicZone || !playerRef.current) return;
    setIsPlayingMusic(true);
    setMusicEnded(false);
    onDanceToggle(true);
    playerRef.current.play({
      audioUrl: musicZone.audioUrl,
      synthMelodyId: musicZone.synthMelodyId,
      volume: musicVol,
      lyricsCount: musicZone.lyrics.length,
      onLyricTick: (idx) => setActiveLyricIdx(idx),
      onEnded: () => {
        setIsPlayingMusic(false);
        setMusicEnded(true);
        onDanceToggle(false);
      },
    });
  };

  const handlePauseMusic = () => {
    playerRef.current?.pause();
    setIsPlayingMusic(false);
    onDanceToggle(false);
  };

  const handleStopMusic = () => {
    playerRef.current?.stop();
    setIsPlayingMusic(false);
    setActiveLyricIdx(0);
    onDanceToggle(false);
  };

  const handleSubmitAnswer = async () => {
    if (!currentQuestion) return;
    const userAnswer =
      currentQuestion.activityType === 'susun_ayat'
        ? arrangedWords.join(' ').trim()
        : selectedOption.trim();

    if (!userAnswer) return;

    const isCorrect =
      userAnswer.toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();
    const nextAttempts = totalAttempts + 1;
    setTotalAttempts(nextAttempts);

    const timeSpent = Math.max(5, Math.round((Date.now() - startedAtRef.current) / 1000));
    const targetId = station?.id || musicZone?.id || 'st_unknown';
    const targetTitle = station?.title || musicZone?.title || 'Aktiviti Bahasa';
    const targetExpr = station?.expression || musicZone?.title || 'Muzik Bahasa';
    const targetCat = station?.category || 'Simpulan Bahasa';

    if (isCorrect) {
      playBlockSound('success');
      onCelebrate();
      const nextScore = earnedScore + (currentQuestion.points || 20);
      setEarnedScore(nextScore);
      setWrongStreak(0);
      setFeedback({
        ok: true,
        text: `Tahniah! Jawapan tepat. ${currentQuestion.explanation}`,
      });

      const isLast = qIndex >= questions.length - 1;
      const unmastered = isLast
        ? []
        : questions.slice(qIndex + 1).map((q) => q.prompt);

      await onRecordProgress({
        worldId,
        stationId: targetId,
        stationTitle: targetTitle,
        expression: targetExpr,
        category: targetCat,
        score: nextScore,
        maxScore,
        attempts: 1,
        wrongAttempts: 0,
        completed: isLast,
        timeSpentSeconds: timeSpent,
        unmasteredQuestions: unmastered,
        historyEntry: {
          questionId: currentQuestion.id,
          questionPrompt: currentQuestion.prompt,
          selectedAnswer: userAnswer,
          isCorrect: true,
          timestamp: new Date().toISOString(),
        },
        ...(isMusic && isLast ? { badgeUnlocked: 'bintang_muzik' } : {}),
      });

      if (isLast) {
        setCompletedAll(true);
      }
    } else {
      playBlockSound('wrong');
      const nextStreak = wrongStreak + 1;
      const nextWrong = totalWrong + 1;
      setWrongStreak(nextStreak);
      setTotalWrong(nextWrong);

      await onRecordProgress({
        worldId,
        stationId: targetId,
        stationTitle: targetTitle,
        expression: targetExpr,
        category: targetCat,
        score: earnedScore,
        maxScore,
        attempts: 1,
        wrongAttempts: 1,
        completed: false,
        timeSpentSeconds: timeSpent,
        unmasteredQuestions: [currentQuestion.prompt],
        historyEntry: {
          questionId: currentQuestion.id,
          questionPrompt: currentQuestion.prompt,
          selectedAnswer: userAnswer,
          isCorrect: false,
          timestamp: new Date().toISOString(),
        },
      });

      if (nextStreak >= 3) {
        setForcedNoteReview(true);
        setTab('nota');
        setFeedback({
          ok: false,
          text: 'Anda telah mencuba 3 kali. Mari ulang kaji nota penerangan terlebih dahulu sebelum mencuba semula!',
        });
      } else {
        setFeedback({
          ok: false,
          text: `Belum tepat (Percubaan ${nextStreak}/3). Cuba baca situasi dengan teliti dan cuba lagi!`,
        });
      }
    }
  };

  const handleNextQuestion = () => {
    setQIndex((i) => i + 1);
    setSelectedOption('');
    setArrangedWords([]);
    setFeedback(null);
    setWrongStreak(0);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-medium text-amber-300">
              {isMusic ? 'Zon Lagu Interaktif' : station?.category} · {station?.title || musicZone?.title}
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold truncate">
              {station?.expression || musicZone?.title}
            </h2>
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

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 pb-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('nota')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap ${
                tab === 'nota'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {isMusic ? <Music className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
              {isMusic ? 'Pemain Lagu & Lirik' : 'Nota & Penerangan'}
            </button>

            {questions.length > 0 && (
              <button
                type="button"
                disabled={forcedNoteReview}
                onClick={() => setTab('aktiviti')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap ${
                  tab === 'aktiviti'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                } disabled:opacity-50`}
              >
                <Award className="w-4 h-4" />
                Cabaran Bahasa ({questions.length})
              </button>
            )}
          </div>

          <div className="text-xs font-mono-nums font-semibold text-slate-600">
            Skor: {earnedScore}/{maxScore}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {tab === 'nota' && station && (
            <>
              {forcedNoteReview && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-sm space-y-2">
                  <div className="font-bold">Panduan Ulang Kaji Berpandu</div>
                  <p>
                    Anda telah membuat 3 percubaan kurang tepat. Sila baca maksud dan contoh ayat
                    di bawah atau dengar penerangan audio sebelum kembali ke soalan yang sama.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-sky-50 border border-sky-200">
                  <div className="text-xs font-semibold text-sky-800 mb-1">Maksud {station.category}:</div>
                  <div className="text-base sm:text-lg font-bold text-slate-900">{station.meaning}</div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-xs font-semibold text-emerald-800 mb-1">Contoh Ayat:</div>
                  <p className="text-sm sm:text-base text-slate-900 italic">"{station.exampleSentence}"</p>
                </div>

                {station.teacherNotes && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs font-semibold text-slate-700 mb-1">Nota Pedagogi Guru:</div>
                    <p className="text-sm text-slate-800">{station.teacherNotes}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handlePlayAudioExplanation}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700"
                  >
                    <Volume2 className="w-4 h-4" />
                    Dengar Penerangan Audio
                  </button>

                  {station.pdfUrl && (
                    <a
                      href={station.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-900 text-sm font-semibold hover:bg-slate-200"
                    >
                      <FileText className="w-4 h-4" />
                      Buka Fail PDF Guru
                    </a>
                  )}

                  {station.videoUrl && (
                    <a
                      href={station.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-900 text-sm font-semibold hover:bg-slate-200"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Tonton Video Pembelajaran
                    </a>
                  )}

                  {station.externalLink && (
                    <a
                      href={station.externalLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-900 text-sm font-semibold hover:bg-slate-200"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Pautan Bahan Tambahan
                    </a>
                  )}
                </div>

                {station.imageUrl && (
                  <img
                    src={station.imageUrl}
                    alt={station.expression}
                    className="w-full max-h-60 object-cover rounded-xl border border-slate-200"
                  />
                )}
              </div>

              {questions.length > 0 && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForcedNoteReview(false);
                      setWrongStreak(0);
                      setTab('aktiviti');
                    }}
                    className="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm hover:bg-amber-400"
                  >
                    {forcedNoteReview
                      ? 'Saya Sudah Faham — Kembali ke Soalan'
                      : 'Mulakan Cabaran & Kuiz Bahasa'}
                  </button>
                </div>
              )}
            </>
          )}

          {tab === 'nota' && musicZone && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-violet-950 text-white space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-violet-300">Disusun oleh {musicZone.artistOrTeacher}</div>
                    <h3 className="font-display text-xl font-bold">{musicZone.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isPlayingMusic ? (
                      <button
                        type="button"
                        onClick={handleStartMusic}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold hover:bg-emerald-400"
                      >
                        <Play className="w-4 h-4" />
                        Mainkan Lagu
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePauseMusic}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 text-sm font-bold hover:bg-amber-300"
                      >
                        <Pause className="w-4 h-4" />
                        Jeda
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleStopMusic}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 text-white text-sm font-semibold hover:bg-white/25"
                    >
                      <Square className="w-4 h-4" />
                      Berhenti
                    </button>
                  </div>
                </div>

                {/* Volume Control */}
                <div className="flex items-center gap-3 text-xs text-violet-200">
                  <Volume2 className="w-4 h-4" />
                  <span>Kelantangan:</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={musicVol}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setMusicVol(v);
                      playerRef.current?.setVolume(v);
                    }}
                    className="w-36 accent-amber-400"
                  />
                  <span className="font-mono-nums">{Math.round(musicVol * 100)}%</span>
                </div>

                {/* Lyrics Display */}
                <div className="p-4 rounded-xl bg-white/10 space-y-2">
                  <div className="text-xs font-semibold text-violet-200">Lirik Lagu:</div>
                  {musicZone.lyrics.map((line, i) => (
                    <p
                      key={i}
                      className={`text-sm sm:text-base transition-colors ${
                        isPlayingMusic && i === activeLyricIdx
                          ? 'text-amber-300 font-bold'
                          : 'text-violet-100/80'
                      }`}
                    >
                      {line}
                    </p>
                  ))}
                </div>

                {isPlayingMusic && (
                  <p className="text-xs text-emerald-300 font-medium">
                    Avatar anda sedang menari mengikut rentak lagu di dunia 3D!
                  </p>
                )}
              </div>

              {questions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTab('aktiviti')}
                  className="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm hover:bg-amber-400"
                >
                  {musicEnded
                    ? 'Lagu Tamat — Jawab Soalan Simpulan Bahasa'
                    : 'Jawab Soalan Berkaitan Lagu'}
                </button>
              )}
            </div>
          )}

          {tab === 'aktiviti' && currentQuestion && !completedAll && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>
                  Soalan {qIndex + 1} daripada {questions.length} ·{' '}
                  {currentQuestion.activityType === 'susun_ayat'
                    ? 'Aktiviti Susun Ayat'
                    : currentQuestion.activityType === 'padanan'
                    ? 'Aktiviti Padanan'
                    : currentQuestion.activityType === 'teka_teki'
                    ? 'Teka-Teki Bahasa'
                    : 'Soalan Kefahaman & Situasi'}
                </span>
                <span>{currentQuestion.points} Bintang</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-base font-semibold text-slate-900">
                {currentQuestion.prompt}
              </div>

              {currentQuestion.activityType === 'susun_ayat' && currentQuestion.scrambledWords ? (
                <div className="space-y-3">
                  <div className="min-h-14 p-3 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50 flex flex-wrap gap-2 items-center">
                    {arrangedWords.length === 0 ? (
                      <span className="text-xs text-slate-500">
                        Klik perkataan di bawah mengikut susunan ayat yang betul...
                      </span>
                    ) : (
                      arrangedWords.map((w, idx) => (
                        <button
                          key={`${w}_${idx}`}
                          type="button"
                          onClick={() =>
                            setArrangedWords((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-sm font-semibold"
                        >
                          {w}
                        </button>
                      ))
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {currentQuestion.scrambledWords.map((w, idx) => {
                      const usedCount = arrangedWords.filter((x) => x === w).length;
                      const availCount = currentQuestion.scrambledWords!.filter((x) => x === w).length;
                      const disabled = usedCount >= availCount;
                      return (
                        <button
                          key={`${w}_src_${idx}`}
                          type="button"
                          disabled={disabled}
                          onClick={() => setArrangedWords((prev) => [...prev, w])}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-100 disabled:opacity-35"
                        >
                          {w}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setArrangedWords([])}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Set Semula
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {currentQuestion.options.map((opt) => {
                    const active = selectedOption === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setSelectedOption(opt)}
                        className={`w-full text-left p-3.5 rounded-xl border text-sm font-medium transition-all ${
                          active
                            ? 'border-sky-600 bg-sky-50 text-sky-950 ring-2 ring-sky-200'
                            : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {feedback && (
                <div
                  className={`p-3.5 rounded-xl border text-sm font-medium ${
                    feedback.ok
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : 'bg-rose-50 border-rose-300 text-rose-950'
                  }`}
                >
                  {feedback.text}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                {feedback?.ok && qIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
                  >
                    Soalan Seterusnya
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmitAnswer}
                    disabled={
                      currentQuestion.activityType === 'susun_ayat'
                        ? arrangedWords.length === 0
                        : !selectedOption
                    }
                    className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-40"
                  >
                    Semak Jawapan
                  </button>
                )}
              </div>
            </div>
          )}

          {completedAll && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="font-display text-2xl font-bold text-slate-900">
                Syabas! Misi Selesai!
              </h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Anda berjaya menguasai <strong>{station?.expression || musicZone?.title}</strong> dengan
                markah <span className="font-mono-nums font-bold">{earnedScore}/{maxScore}</span> dalam{' '}
                {totalAttempts} percubaan. Rekod kemajuan telah disimpan ke pelayan guru.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
              >
                Teruskan Pengembaraan 3D
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
