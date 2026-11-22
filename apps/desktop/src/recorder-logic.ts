// Recording your own audio on a card (the card editor's Record button). Pure: the browser parts are passed in.
import { RECORDING_MAX_SECONDS } from '@lernlab/core/recording';

/** Opus is small and every Chromium (WebM) or Firefox (Ogg) records it; no new dependency is needed. */
export const RECORDING_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus'];

/** The first Opus format this browser can record, or null when it can't (then there is no Record button). */
export function recordingType(isTypeSupported?: (type: string) => boolean): string | null {
  if (!isTypeSupported) return null;
  return RECORDING_TYPES.find((type) => isTypeSupported(type)) ?? null;
}

/** Ask for the microphone only, never the camera. */
export const MIC_ONLY = { audio: true, video: false } as const;

/** 64 kbit/s Opus is clear for speech: a full minute is about 480 KB. */
export const recorderOptions = (mimeType: string) => ({ mimeType, audioBitsPerSecond: 64_000 });

/** Whole seconds left before the recorder stops by itself. */
export const secondsLeft = (startedAt: number, now: number) =>
  Math.max(0, RECORDING_MAX_SECONDS - Math.floor((now - startedAt) / 1000));

/** Why the microphone could not be used, as a key under browse.editor.record.problem. */
export function micProblem(e: unknown): 'denied' | 'noMic' | 'failed' {
  const name = e instanceof Error || (typeof e === 'object' && e !== null) ? (e as { name?: unknown }).name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError') return 'noMic';
  return 'failed';
}

/** Seconds as m:ss, for a recording that counts up (teach-back). */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
