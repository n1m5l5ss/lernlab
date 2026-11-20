// Game feel: tiny synthesized sound effects (no files), Anki audio playback and German text-to-speech.
import { mediaUrl } from './bridge';

let ctx: AudioContext | null = null;
let enabled = true;
export const setSound = (on: boolean) => {
  enabled = on;
};

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.12, when = 0) {
  if (!enabled) return;
  ctx ??= new AudioContext();
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur);
}

export const sfx = {
  right: (combo = 1) => {
    const base = 520 + Math.min(combo, 12) * 30; // pitch climbs with the combo
    tone(base, 0.09, 'triangle');
    tone(base * 1.5, 0.12, 'triangle', 0.1, 0.07);
  },
  wrong: () => {
    tone(180, 0.18, 'sawtooth', 0.07);
    tone(140, 0.2, 'sawtooth', 0.05, 0.08);
  },
  near: () => tone(440, 0.12, 'triangle'),
  tap: () => tone(700, 0.04, 'square', 0.04),
  hit: () => {
    tone(90, 0.15, 'square', 0.12);
    tone(60, 0.2, 'sawtooth', 0.08, 0.05);
  },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.12, i * 0.1)),
  tick: () => tone(1200, 0.02, 'square', 0.03),
};

let current: HTMLAudioElement | null = null;
export function playMedia(file: string | null | undefined, rate = 1): Promise<void> {
  if (!file) return Promise.resolve();
  current?.pause();
  current = new Audio(mediaUrl(file));
  current.playbackRate = rate;
  return new Promise((resolve) => {
    current!.onended = () => resolve();
    current!.onerror = () => resolve();
    current!.play().catch(() => resolve());
  });
}

const LOCALES: Record<string, string> = {
  de: 'de-DE',
  ja: 'ja-JP',
  ko: 'ko-KR',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  pt: 'pt-BR',
  nl: 'nl-NL',
  sv: 'sv-SE',
  ru: 'ru-RU',
  zh: 'zh-CN',
  ar: 'ar-SA',
  hi: 'hi-IN',
  te: 'te-IN',
  en: 'en-US',
};
const locale = (lang: string) => LOCALES[lang] ?? lang;

function voiceFor(lang: string): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  const voices = speechSynthesis.getVoices();
  const loc = locale(lang);
  return (
    voices.find((v) => v.lang === loc && /Anna|Helena|Google|Premium|Enhanced/i.test(v.name)) ??
    voices.find((v) => v.lang === loc) ??
    voices.find((v) => v.lang.startsWith(lang)) ??
    null
  );
}

/** Is there a system voice for this language? Voices load late in Chromium, so call warmVoices() at start. */
export function hasVoice(lang: string | null | undefined): boolean {
  return !!lang && voiceFor(lang) !== null;
}

/** Ask for the voice list early so hasVoice() is right by the time a session starts. */
export function warmVoices() {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener?.('voiceschanged', () => speechSynthesis.getVoices());
}

/**
 * Play a card aloud: its own recording, or `text` in the system voice for its language.
 * `preferVoice` reads `text` even when there is a recording (the recording may be the word, not the sentence).
 */
export function hear(
  item: { audio: string | null; lang: string | null },
  text: string,
  { rate = 1, preferVoice = false }: { rate?: number; preferVoice?: boolean } = {},
): Promise<void> {
  if (item.audio && !(preferVoice && hasVoice(item.lang))) return playMedia(item.audio, rate);
  if (item.lang) say(text, 0.95 * rate, item.lang);
  return Promise.resolve();
}

/** Text-to-speech in the deck's language (system voices). */
export function say(text: string, rate = 0.95, lang = 'de') {
  if (typeof speechSynthesis === 'undefined' || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/<[^>]+>/g, ''));
  u.lang = locale(lang);
  const v = voiceFor(lang);
  if (v) u.voice = v;
  u.rate = rate;
  speechSynthesis.speak(u);
}

/** Speech recognition (Chrome, Edge, Safari). Returns null if the browser has none. */
export function recognizer(lang = 'de'): any | null {
  const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = locale(lang);
  r.interimResults = false;
  r.maxAlternatives = 4;
  return r;
}
