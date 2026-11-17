// Procedural Web Audio API synthesizer + Teacher uploaded MP3/audio controller + Malay Speech

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      audioCtx = new Ctx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playBlockSound(type: 'place' | 'break' | 'jump' | 'success' | 'wrong' | 'click') {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const playTone = (freq: number, dur: number, wave: OscillatorType = 'triangle', gainVal = 0.14, delay = 0) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, now + delay);
    gain.gain.setValueAtTime(0.001, now + delay);
    gain.gain.exponentialRampToValueAtTime(gainVal, now + delay + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + dur + 0.02);
  };

  switch (type) {
    case 'place':
      playTone(260, 0.08, 'square', 0.07);
      playTone(390, 0.08, 'triangle', 0.08, 0.03);
      break;
    case 'break':
      playTone(210, 0.07, 'sawtooth', 0.06);
      playTone(130, 0.09, 'triangle', 0.07, 0.03);
      break;
    case 'jump':
      playTone(300, 0.09, 'sine', 0.08);
      playTone(460, 0.1, 'sine', 0.06, 0.04);
      break;
    case 'success':
      playTone(523.25, 0.14, 'triangle', 0.14, 0);
      playTone(659.25, 0.14, 'triangle', 0.14, 0.1);
      playTone(783.99, 0.22, 'triangle', 0.16, 0.2);
      playTone(1046.5, 0.35, 'sine', 0.18, 0.32);
      break;
    case 'wrong':
      playTone(240, 0.16, 'sawtooth', 0.08, 0);
      playTone(185, 0.22, 'sawtooth', 0.08, 0.14);
      break;
    case 'click':
      playTone(540, 0.05, 'sine', 0.06);
      break;
  }
}

export function speakMalayText(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const msVoice = voices.find((v) => v.lang.startsWith('ms') || v.lang.startsWith('id'));
    if (msVoice) utter.voice = msVoice;
    utter.lang = 'ms-MY';
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
  } catch {
    // Ignore speech synthesis failures
  }
}

export function stopMalaySpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// Melody definitions for built-in educational songs (zero external MP3 dependency)
const MELODIES: Record<string, number[]> = {
  lagu_ringan_tulang: [523.25, 587.33, 659.25, 523.25, 659.25, 783.99, 659.25, 587.33, 523.25, 587.33, 659.25, 523.25],
  irama_pantun: [440, 493.88, 523.25, 587.33, 659.25, 587.33, 523.25, 440, 392, 440, 493.88, 440],
  ceria_kampung: [392, 493.88, 587.33, 659.25, 783.99, 659.25, 587.33, 493.88, 523.25, 587.33, 659.25, 392],
};

export class MusicZonePlayer {
  private audioEl: HTMLAudioElement | null = null;
  private synthTimer: number | null = null;
  private stepIdx = 0;
  private volume = 0.75;
  private onEndedCb?: () => void;
  private onLyricTickCb?: (idx: number) => void;

  play(options: {
    audioUrl?: string;
    synthMelodyId?: string;
    volume?: number;
    lyricsCount: number;
    onLyricTick?: (idx: number) => void;
    onEnded?: () => void;
  }) {
    this.stop();
    this.volume = options.volume ?? 0.75;
    this.onEndedCb = options.onEnded;
    this.onLyricTickCb = options.onLyricTick;

    if (options.audioUrl) {
      this.audioEl = new Audio(options.audioUrl);
      this.audioEl.volume = this.volume;
      this.audioEl.onended = () => {
        this.stop();
        this.onEndedCb?.();
      };
      this.audioEl.play().catch(() => {
        // Fallback to synth if browser rejects or file missing
        this.startSynth(options.synthMelodyId || 'lagu_ringan_tulang', options.lyricsCount);
      });
      // Advance lyrics every 3 seconds during audio playback
      let lyricIdx = 0;
      this.synthTimer = window.setInterval(() => {
        lyricIdx = (lyricIdx + 1) % Math.max(1, options.lyricsCount);
        this.onLyricTickCb?.(lyricIdx);
      }, 3000);
      return;
    }

    this.startSynth(options.synthMelodyId || 'lagu_ringan_tulang', options.lyricsCount);
  }

  private startSynth(melodyId: string, lyricsCount: number) {
    const ctx = getAudioContext();
    const notes = MELODIES[melodyId] || MELODIES.lagu_ringan_tulang;
    this.stepIdx = 0;

    const tick = () => {
      if (!ctx) return;
      const freq = notes[this.stepIdx % notes.length];
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.16 * this.volume, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.44);

      if (lyricsCount > 0) {
        const lyricIdx = Math.floor((this.stepIdx / notes.length) * lyricsCount) % lyricsCount;
        this.onLyricTickCb?.(lyricIdx);
      }

      this.stepIdx++;
      if (this.stepIdx >= notes.length) {
        this.stop();
        this.onEndedCb?.();
      }
    };

    tick();
    this.synthTimer = window.setInterval(tick, 480);
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audioEl) {
      this.audioEl.volume = this.volume;
    }
  }

  pause() {
    if (this.audioEl && !this.audioEl.paused) {
      this.audioEl.pause();
    }
    if (this.synthTimer !== null) {
      clearInterval(this.synthTimer);
      this.synthTimer = null;
    }
  }

  stop() {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
      this.audioEl = null;
    }
    if (this.synthTimer !== null) {
      clearInterval(this.synthTimer);
      this.synthTimer = null;
    }
  }
}
