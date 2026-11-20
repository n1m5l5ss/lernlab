// Game feel: tiny synthesized sound effects (no files), Anki audio playback and reading cards aloud.
import { mediaUrl } from './bridge';
import { clampRate, localeFor, pickVoice, prefFor, type SpeechPref } from './voice-logic';

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

// Reading aloud: system voices (Web Speech), chosen by the card's language and its deck's voice and speed.
const synth = () => (typeof speechSynthesis === 'undefined' ? null : speechSynthesis);
let warmedAt = 0;
let voicesArrived = false;

/** Installed system voices. Chromium fills the list a moment after start, so call warmVoices() early. */
export function systemVoices(): SpeechSynthesisVoice[] {
  return synth()?.getVoices() ?? [];
}

/** True once the voice list is final: some arrived, or a moment has passed and there are none. */
const voicesKnown = () => voicesArrived || systemVoices().length > 0 || (warmedAt > 0 && Date.now() - warmedAt > 2000);

/** Ask for the voice list early so hasVoice() is right by the time a session starts. */
export function warmVoices() {
  const s = synth();
  if (!s) return;
  warmedAt = Date.now();
  s.getVoices();
  s.addEventListener?.('voiceschanged', () => {
    voicesArrived = true;
    s.getVoices();
  });
}

/** Call `fn` whenever the installed voices change. Returns the unsubscribe function. */
export function onVoicesChanged(fn: () => void): () => void {
  const s = synth();
  s?.addEventListener?.('voiceschanged', fn);
  return () => s?.removeEventListener?.('voiceschanged', fn);
}

let prefs: Record<number, SpeechPref> = {};
/** Each deck's chosen voice and speed for this session (from the session plan). */
export function setSpeechPrefs(p: Record<number, SpeechPref> | undefined) {
  prefs = p ?? {};
}

const noVoiceListeners = new Set<(lang: string) => void>();
/** Hear about a card that should have been read aloud but has no voice for its language. */
export function onNoVoice(fn: (lang: string) => void): () => void {
  noVoiceListeners.add(fn);
  return () => noVoiceListeners.delete(fn);
}

/** Is there a system voice for this language? */
export function hasVoice(lang: string | null | undefined): boolean {
  return pickVoice(lang, systemVoices()) !== null;
}

type Hearable = { audio: string | null; lang: string | null; deckId?: number };

/**
 * Play a card aloud: its own recording, or `text` in the system voice for its language.
 * `preferVoice` reads `text` even when there is a recording (the recording may be the word, not the sentence).
 */
export function hear(
  item: Hearable,
  text: string,
  { rate = 1, preferVoice = false }: { rate?: number; preferVoice?: boolean } = {},
): Promise<void> {
  if (item.audio && !(preferVoice && hasVoice(item.lang))) return playMedia(item.audio, rate);
  if (item.lang) say(text, 0.95 * rate, item.lang, item.deckId);
  return Promise.resolve();
}

/**
 * Text-to-speech in the deck's language, in the deck's chosen voice and speed. When the computer has no voice
 * for that language it stays silent (never a voice in another language) and tells onNoVoice listeners.
 */
export function say(text: string, rate = 0.95, lang = 'de', deckId?: number | null) {
  const s = synth();
  if (!s || !text) return;
  const pref = prefFor(prefs, deckId);
  const voice = pickVoice(lang, s.getVoices(), pref.voice);
  const tellNoVoice = () => noVoiceListeners.forEach((fn) => fn(lang));
  if (!voice && voicesKnown()) return tellNoVoice();
  // Voices may still be loading: try the engine's own pick now, and check again once the list is final.
  if (!voice) setTimeout(() => !pickVoice(lang, s.getVoices()) && tellNoVoice(), 2100);
  speakWith(text, lang, voice as SpeechSynthesisVoice | null, rate * clampRate(pref.rate ?? 1));
}

/** "Try it" in the deck settings: read `text` in exactly this voice and speed. */
export function tryVoice(text: string, lang: string, voiceURI: string, rate: number) {
  const s = synth();
  if (!s) return;
  speakWith(text, lang, pickVoice(lang, s.getVoices(), voiceURI) as SpeechSynthesisVoice | null, clampRate(rate));
}

function speakWith(text: string, lang: string, voice: SpeechSynthesisVoice | null, rate: number) {
  // A speech engine that fails must never stop a session, so errors here are swallowed.
  try {
    const s = synth()!;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/<[^>]+>/g, ''));
    u.lang = voice?.lang ?? localeFor(lang);
    if (voice) u.voice = voice;
    u.rate = rate;
    s.speak(u);
  } catch {
    /* no sound this time */
  }
}

/** Speech recognition (Chrome, Edge, Safari). Returns null if the browser has none. */
export function recognizer(lang = 'de'): any | null {
  const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = localeFor(lang);
  r.interimResults = false;
  r.maxAlternatives = 4;
  return r;
}
