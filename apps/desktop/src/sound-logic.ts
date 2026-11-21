// The sound set (issue #2, docs/design/style.md): short, soft tones synthesised with Web Audio, so there are
// no sound files and no licences. Each sound is a list of tones within the `sound` tokens in
// docs/design/tokens.json, and the Sound setting mutes them all. audio.ts plays them.
import tokens from '../../../docs/design/tokens.json';

export type Wave = 'sine' | 'triangle' | 'square' | 'sawtooth';

/** One tone: its pitch, length, waveform, peak gain (0–1) and start after the sound begins. */
export type Tone = { freq: number; ms: number; wave: Wave; gain: number; at: number };

export const SOUND = tokens.sound;
/** The loudest gain a tone may start at: the `levelDbfs` token as a linear gain. */
export const MAX_GAIN = 10 ** (SOUND.levelDbfs / 20);

const tone = (freq: number, ms: number, wave: Wave = 'triangle', gain = 0.12, at = 0): Tone => ({
  freq,
  ms,
  wave,
  gain,
  at,
});

/** The combo stops raising the pitch here, so a long run never turns shrill. */
export const COMBO_CAP = 12;

export const SOUNDS = {
  /** A right answer: two rising notes. The pitch climbs with the combo, which is the combo sound. */
  right: (combo = 1) => {
    const base = 520 + Math.min(Math.max(combo, 1), COMBO_CAP) * 30;
    return [tone(base, 90), tone(base * 1.5, 120, 'triangle', 0.1, 70)];
  },
  /** A wrong answer: two soft falling notes. Never a buzzer (design rule 2). */
  wrong: () => [tone(262, 120, 'triangle', 0.08), tone(208, 150, 'triangle', 0.07, 90)],
  /** Almost right (a typo or a missing accent). */
  near: () => [tone(440, 120)],
  /** A tile or option picked in an exercise. */
  tap: () => [tone(700, 40, 'square', 0.04)],
  /** A hit on the boss in the boss game. */
  hit: () => [tone(90, 150, 'square', 0.12), tone(60, 150, 'sawtooth', 0.08, 50)],
  /** The end of a block or a won game: four rising notes (C, E, G, C). */
  win: () => [523, 659, 784, 1047].map((f, i) => tone(f, 150, 'triangle', 0.12, i * 100)),
  /** A new level, at the end of a block: a quicker run up to a two-note chord (G, C, E, G + C). */
  levelUp: () => [
    ...[392, 523, 659].map((f, i) => tone(f, 110, 'triangle', 0.1, i * 80)),
    tone(784, 150, 'triangle', 0.1, 240),
    tone(1047, 150, 'sine', 0.06, 240),
  ],
  /** The last seconds of a timer. */
  tick: () => [tone(1200, 20, 'square', 0.03)],
} satisfies Record<string, (combo?: number) => Tone[]>;

export type SoundName = keyof typeof SOUNDS;

/** The sound effects, each playing its tones through `play` only while `isOn()` (the Sound setting). */
export function createSfx(play: (tones: Tone[]) => void, isOn: () => boolean) {
  const out = {} as { [K in SoundName]: (...args: Parameters<(typeof SOUNDS)[K]>) => void };
  for (const name of Object.keys(SOUNDS) as SoundName[]) {
    const make = SOUNDS[name] as (combo?: number) => Tone[];
    out[name] = (combo?: number) => {
      if (isOn()) play(make(combo));
    };
  }
  return out;
}
