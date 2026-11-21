# Visual style

How LernLab looks and sounds, for contributors. The owner approved this style with the mockups on 2026-11-20 (issues #1 and #2); the "Visual style" sheet is `images/Style.png` (source: `canvas/project/Style.dc.html`).

Every value here comes from [`tokens.json`](tokens.json). `packages/ui` turns it into CSS variables (`packages/ui/tokens.css`), and screens use only those variables: no raw colours, sizes in tokens where one exists. The colour and contrast tables below are written by a script from the tokens, so they are always the real values.

## Principles

1. **Recall over recognition, in the visuals too.** The study screen shows one card, one primary action and a 4 px progress bar. No mascots or decoration on it, and celebrations only at the end of a block, never between cards. A game may look playful, but it never shows a card as "known".
2. **Colour is never the only signal.** Right and wrong are always colour + icon + word ("Correct", "Not quite"), in green and vermillion, which stay distinct for colour-blind people (never red against green). The current place in the sidebar is bold on a tint, not just coloured.
3. **Calm.** Warm neutral surfaces, one blue accent, short motion, no shaking, no buzzers, sound off until the learner turns it on.
4. **No guilt.** Errors are neutral and about the task ("Not quite — here's the answer"). A missed day is a gap, never a reset, and nothing nags.
5. **Accessible.** WCAG 2.2 AA: text at least 4.5:1, focus rings and control borders at least 3:1, targets at least 44 px, a visible focus ring on everything, full keyboard use.

The research behind these is summarised in [`README.md`](README.md#rules-the-design-follows) and `docs/research.md`.

## Colours

Light is the design reference. Dark is a warm near-black (`#1A1917`), never pure black. The app follows the system theme unless Settings → Theme picks light or dark (`data-theme` on the root element).

<!-- generated:colours -->
| Token | CSS variable | Light | Dark | Used for |
| --- | --- | --- | --- | --- |
| `bg` | `--color-bg` | `#FAF8F5` | `#1A1917` | Window background |
| `surface` | `--color-surface` | `#FFFFFF` | `#24221F` | Cards, panels, inputs |
| `subtle` | `--color-subtle` | `#F1EDE7` | `#2D2B27` | Quiet fills: chips, table headers, hover |
| `border` | `--color-border` | `#E4DED6` | `#3A3732` | Hairline dividers and card edges (decorative) |
| `borderStrong` | `--color-border-strong` | `#8A847B` | `#807B73` | Form-control borders, unselected outlines |
| `text` | `--color-text` | `#1F1D1A` | `#ECE9E4` | Body text and headings |
| `textMuted` | `--color-text-muted` | `#5C574F` | `#A8A39B` | Secondary text, hints, captions |
| `accent` | `--color-accent` | `#2F5BB7` | `#8FA8F0` | Primary buttons, links, focus ring, current place |
| `onAccent` | `--color-on-accent` | `#FFFFFF` | `#1A1917` | Text and icons on `accent` |
| `accentTint` | `--color-accent-tint` | `rgba(47,91,183,0.10)` | `rgba(143,168,240,0.14)` | Selected or current background |
| `correct` | `--color-correct` | `#007A5E` | `#4FC4A0` | Right-answer text, icon and outline |
| `correctFill` | `--color-correct-fill` | `#009E73` | `#4FC4A0` | Right-answer fills (tints, the large der/die/das button) |
| `incorrect` | `--color-incorrect` | `#B04A00` | `#F0A070` | Wrong-answer text, icon and outline |
| `incorrectFill` | `--color-incorrect-fill` | `#D55E00` | `#F0A070` | Wrong-answer fills (tints, the large button) |
<!-- /generated:colours -->

`accentTint` is translucent and sits on `surface`. Right and wrong answer options use `correctFill` or `incorrectFill` mixed 12% (or 20% for "known" in the card list) into `surface` with `color-mix()`.

### Measured contrast

Measured with the WCAG 2.2 formula (`packages/ui/src/contrast.ts`) for every pair the app draws (`packages/ui/src/contrast-pairs.ts`). `packages/ui/src/contrast.test.ts` fails if any pair falls below its minimum.

<!-- generated:contrast -->
**Text pairs**: at least 4.5:1. Lowest: 4.56:1.

| Pair | Light | Dark |
| --- | --- | --- |
| `text` on `bg` | 15.86:1 | 14.51:1 |
| `text` on `surface` | 16.81:1 | 13.10:1 |
| `text` on `subtle` | 14.42:1 | 11.67:1 |
| `textMuted` on `bg` | 6.76:1 | 7.01:1 |
| `textMuted` on `surface` | 7.16:1 | 6.33:1 |
| `textMuted` on `subtle` | 6.14:1 | 5.64:1 |
| `accent` on `bg` | 6.00:1 | 7.55:1 |
| `accent` on `surface` | 6.36:1 | 6.82:1 |
| `accent` on `subtle` | 5.46:1 | 6.07:1 |
| `correct` on `bg` | 5.02:1 | 8.14:1 |
| `correct` on `surface` | 5.32:1 | 7.36:1 |
| `correct` on `subtle` | 4.56:1 | 6.55:1 |
| `incorrect` on `bg` | 5.18:1 | 8.34:1 |
| `incorrect` on `surface` | 5.49:1 | 7.53:1 |
| `incorrect` on `subtle` | 4.71:1 | 6.71:1 |
| `onAccent` on `accent` | 6.36:1 | 7.55:1 |
| `text` on `accentTint` | 14.57:1 | 10.11:1 |
| `accent` on `accentTint` | 5.51:1 | 5.26:1 |
| `text` on `correctFill` 12% over `surface` | 14.59:1 | 10.56:1 |
| `text` on `incorrectFill` 12% over `surface` | 14.52:1 | 10.43:1 |
| `text` on `correctFill` 20% over `surface` | 13.35:1 | 8.89:1 |

**Large text pairs**: at least 3:1. Lowest: 3.42:1.

| Pair | Light | Dark |
| --- | --- | --- |
| `onAccent` on `accent` | 6.36:1 | 7.55:1 |
| `onAccent` on `correctFill` | 3.42:1 | 8.14:1 |
| `onAccent` on `incorrectFill` | 3.87:1 | 8.34:1 |

**Focus rings, control borders and answer outlines**: at least 3:1. Lowest: 3.18:1.

| Pair | Light | Dark |
| --- | --- | --- |
| `accent` on `bg` | 6.00:1 | 7.55:1 |
| `accent` on `surface` | 6.36:1 | 6.82:1 |
| `accent` on `subtle` | 5.46:1 | 6.07:1 |
| `borderStrong` on `bg` | 3.50:1 | 4.18:1 |
| `borderStrong` on `surface` | 3.71:1 | 3.78:1 |
| `borderStrong` on `subtle` | 3.18:1 | 3.36:1 |
| `correct` on `bg` | 5.02:1 | 8.14:1 |
| `correct` on `surface` | 5.32:1 | 7.36:1 |
| `correct` on `subtle` | 4.56:1 | 6.55:1 |
| `incorrect` on `bg` | 5.18:1 | 8.34:1 |
| `incorrect` on `surface` | 5.49:1 | 7.53:1 |
| `incorrect` on `subtle` | 4.71:1 | 6.71:1 |
<!-- /generated:contrast -->

## Type

- **Interface font: Atkinson Hyperlegible Next**, designed for low-vision readers. It is bundled (`packages/ui/fonts/`, woff2, SIL Open Font License), with **Noto Sans Telugu, Devanagari and Arabic** for those scripts. Each file loads only when its script is on screen; about 460 KB in all. Chinese, Japanese and Korean use the computer's own fonts. The fallback list is `--font-ui`; see [`packages/ui/fonts/README.md`](../../packages/ui/fonts/README.md).
- **Other families:** `--font-reading` (Noto Serif, then Georgia) for long reading text, `--font-mono` for code.
- **Weights:** 400 and 700 only. No italics.
- **Language tags:** every card field carries `lang`, so the right glyphs are used.

| Token | Size | Use |
| --- | --- | --- |
| `--text-caption` | 13 px | Captions and labels only |
| `--text-body` | 16 px | Body and interface: the minimum for reading text |
| `--text-subhead` | 20 px | Subheads and buttons |
| `--text-title` | 25 px | Answer text |
| `--text-prompt` | 31 px | Card prompt |
| `--text-prompt-large` | 39 px | Single-word prompt |
| `--text-display` | 49 px | Boss header |

Line height: `--line-body` 1.5, `--line-heading` 1.25. `--line-complex-scripts` (1.7) is for Telugu, Devanagari and Arabic text; no stylesheet applies it yet.

**Text size setting.** Settings → Text size offers normal, large (115%) and larger (130%), from `textSize` in the tokens. It sets `data-text-size` on the root (`apps/desktop/src/display.ts`), which changes `--text-scale`; every `--text-*` token is `calc(N px * var(--text-scale))`. Spacing and layout stay the same. For a size that has no token, use `textPx(n)` in code or `calc(Npx * var(--text-scale))` in CSS, never a bare `px` font size.

## Spacing

One 4 px based scale: use `--space-1` … `--space-8`.

| Token | `--space-1` | `--space-2` | `--space-3` | `--space-4` | `--space-5` | `--space-6` | `--space-7` | `--space-8` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| px | 4 | 8 | 12 | 16 | 24 | 32 | 48 | 64 |

At least 48 px (`--space-7`) of space around the study card. Sizes: `--size-min-target` 44 px (every button and control), `--size-progress-bar` 4 px, `--size-card-max-width` 720 px.

## Radius

`--radius-control` 6 px (buttons, inputs), `--radius-card` 12 px (cards, panels), `--radius-pill` 999 px (chips, round buttons).

## Motion

| Token | Normal | Reduced | Use |
| --- | --- | --- | --- |
| `--motion-press` | 120 ms | 0 ms | Button press |
| `--motion-feedback` | 200 ms | 200 ms | Feedback appearing after an answer |
| `--motion-card` | 280 ms | 200 ms | Card change, progress bar, end-of-block moments |
| `--motion-summary` | 400 ms | 200 ms | The block summary |

Easing: `--motion-ease-enter` (`cubic-bezier(0.2, 0, 0, 1)`) for things arriving, `--motion-ease-exit` (`cubic-bezier(0.3, 0, 1, 1)`) for things leaving.

**Reduced motion.** When the computer asks for less motion (`prefers-reduced-motion`) or Settings → Reduce motion is on (`data-motion="reduce"`), the `motionReduced` values apply: movement becomes an instant change and fades stay short. `styles.css` also cuts every older raw animation and transition to 1 ms, and confetti is skipped (`motionReduced()` in `display.ts`). Never animate without a token, so the setting reaches it.

## Icons

**Style:** 24 × 24 outline icons, `fill="none"`, `stroke="currentColor"`, round caps and joins, stroke 1.8 (navigation and buttons) or 2 (small icons in discs and feedback). Drawn at 20 px next to text, larger only for the speak and microphone buttons. They take the colour of their text, are `aria-hidden="true"` and always sit next to a word or an accessible name. An icon that points the way text runs gets `className="icon-dir"` so it mirrors right to left.

**Set: [Lucide](https://lucide.dev)** (ISC licence). It uses the same grid, stroke and caps, so it matches. Today's icons were drawn for the mockups and are not copied from any set, so nothing is bundled and no third-party licence applies. For a new icon, take it from Lucide:

1. Copy the icon's SVG children inline (no npm package). Keep our `<svg>` attributes and stroke width.
2. Add a comment with its Lucide name, e.g. `// Lucide "star" (ISC)`.
3. With the first copied icon, add Lucide's `LICENSE` file as `docs/design/icons/LICENSE-lucide.txt` (the ISC licence asks for its notice to be kept) and list the icon in the table below.

| Where | Icons | File |
| --- | --- | --- |
| Sidebar | home, decks, cards (mirrors), progress, settings | `apps/desktop/src/Shell.tsx` (drawn by `components/Sidebar.tsx`) |
| Study session header | end session (×), sound on / sound off | `apps/desktop/src/Session.tsx` |
| Listening and speaking exercises | speaker, microphone | `apps/desktop/src/modes/Exercises.tsx` |
| Summary moments, Progress → Streak | level, badge, freeze, repair, goal, boss | `apps/desktop/src/Motivation.tsx` |
| Feedback | right (circled tick), wrong (circled ×), near (circled !) | `.feedback::before` masks in `apps/desktop/src/styles.css` |

Some places still use text characters instead of icons: ★ (starred card, `Browse.tsx`), ✕ (remove, `CardEditor.tsx`) and ▸ ▾ ◂ (the "More" disclosure in `styles.css`). Replace them with Lucide icons (`star`, `x`, `chevron-right` / `chevron-down`) when those screens move to the design.

## Sounds

**Off by default** (`sound.defaultOn` in the tokens, and `sound: false` in the default settings). The learner turns them on in Settings → Sound effects, or with the speaker button in the study header; both save the same setting, and it mutes every sound below.

The sounds are **synthesised in code** with Web Audio (`apps/desktop/src/sound-logic.ts`, played by `audio.ts`): no sound files, nothing to bundle and no licence to track. Each is one to five short, soft tones: every tone lasts at most `sound.maxMs` (150 ms) and starts no louder than `sound.levelDbfs` (−18 dBFS). `sound-logic.test.ts` checks these limits, that a wrong answer is never a buzzer, and that muting silences everything.

| Sound | When | Tones |
| --- | --- | --- |
| `right` | A right answer | Two rising triangle notes (550 Hz, then 1.5×) |
| combo | Right answers in a row | The `right` notes climb 30 Hz per answer in the combo, up to 12 (880 Hz) |
| `wrong` | A wrong answer | Two soft falling triangle notes (262 Hz, 208 Hz) |
| `near` | Almost right (a typo or accent) | One 440 Hz note |
| `levelUp` | A new level, at the end of a block | A quick run G4–C5–E5 up to G5 with C6 |
| `win` | The end of a block, a won game | C5–E5–G5–C6 |
| `tap`, `tick`, `hit` | Picking a tile, a timer's last seconds, a hit in the boss game | Very short, quiet clicks and a low thud |

The Sound setting does not cover card content: a card's own recording and reading aloud follow Settings → Teacher speaks aloud and the speak buttons.

To add a sound, add it to `SOUNDS` in `sound-logic.ts` within the limits above, and play it through `sfx` from `audio.ts` (never a new `AudioContext` or an audio file).

## Components

The base components (Button, Card, ProgressBar, Feedback, Input and Select, SegmentedControl, Sidebar) live in `apps/desktop/src/components/`; the table of what each is and its accessibility is in [`README.md`](README.md#components). Browse them with `npm run storybook` (http://localhost:6006, with Theme and Direction switches); `npm run test:visual` checks every story with axe in light and dark, left to right and right to left (issue #55, see `docs/TESTING.md`).

## Changing a token

1. Edit [`tokens.json`](tokens.json). Keep light and dark in step: every colour needs both.
2. Run `npm run tokens -w @lernlab/ui`. It rewrites `packages/ui/tokens.css` and the colour and contrast tables on this page. A test fails if either is out of date.
3. Run `npm test`. `packages/ui/src/contrast.test.ts` fails if any pair drops below 4.5:1 (text) or 3:1 (large text, focus rings, borders, answer outlines). If you add a new colour pair to a screen, add it to `packages/ui/src/contrast-pairs.ts`.
4. Run `npm run test:visual`, and open the pull request with the `visual-change` label so CI commits new baselines and reviewers see each image before and after.
5. A change to the approved look (not just a fix) needs the owner's approval in the pull request; update the mockups in `canvas/` and `images/` with it.
