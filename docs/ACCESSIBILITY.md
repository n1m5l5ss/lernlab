# Accessibility audit (WCAG 2.2 AA)

LernLab targets WCAG 2.2 level AA (`docs/PLAN.md`, issue #35). This page records the last audit: what was checked, what was fixed, and what is still open. Update it when a screen changes.

**Last audit:** November 2026, v0.3 (issue #35). **Screens:** Welcome, What's new, Home, the session (every exercise and game), the summary, Decks and the import panel, Cards and the card editor, Progress, Settings.

## How it was checked

- **Keyboard only:** every screen was walked with Tab, Shift+Tab, Enter, Space, the arrow keys and Esc in Chromium (Playwright), on the web dev build.
- **Scripted checks:** for each screen in light and dark, a Playwright script listed controls without an accessible name, targets under 24 × 24 px, tab stops without a visible focus ring, duplicate ids, missing `h1`/`main`, skipped heading levels, and sideways scrolling at 640 px wide (1280 px at 200% zoom).
- **Contrast:** `packages/ui/src/contrast.test.ts` computes every text, large-text and UI token pair that the screens use, in both themes, from `docs/design/tokens.json`. It runs with `npm test`.
- **Not done here:** NVDA, JAWS, VoiceOver and Orca, Windows high-contrast mode, and the packaged Electron app. See [Still open](#still-open).

## Status by criterion

Status: **Pass**, **Partial** (works, with a known gap), **Open** (fails or untested), **N/A**.

| Criterion | Status | Notes |
|---|---|---|
| 1.1.1 Non-text content | Pass | Icons are `aria-hidden` next to visible text, and icon buttons have a label (sound, replay). The study calendar is an image whose label gives the number of study days. **Fixed:** cards have an optional image description (`imageAlt` in `.lernpack` and JSON, `image_alt` in CSV; see `docs/FORMAT.md`), set in the card editor under "Image description" once a card has an image. It is the image's alt text everywhere a card image is shown (exercises, the picture quiz, games, the editor preview), so the picture quiz ("What is this?") can be answered with a screen reader. An image without a description keeps `alt=""`. |
| 1.2.1–1.2.5 Audio and video | N/A | Recordings and videos come from users' decks; the card's text is shown with them. |
| 1.3.1 Info and relationships | Pass | Landmarks (`nav`, `main`), one `h1` per screen (the session's block title is now an `h1`), labelled fields, fieldsets for radio groups, `role="radiogroup"` and `role="tablist"`. The import tabs have no `tabpanel` wrapper yet (see below). |
| 1.3.2 Meaningful sequence | Pass | DOM order matches reading order, also right to left. |
| 1.3.3 Sensory characteristics | Pass | Instructions name the key or the word, never only a colour or position. |
| 1.3.4 Orientation | Pass | No locked orientation. |
| 1.3.5 Identify input purpose | N/A | No fields ask for personal data. |
| 1.4.1 Use of colour | Pass | **Fixed:** multiple choice now says "Right" or "Not quite. It's …" with an icon; before, only the option colours showed it. Other feedback already had a word and an icon. |
| 1.4.2 Audio control | Pass | Sound is off by default; a sound button is always in the session bar; teacher voice is a setting. |
| 1.4.3 Contrast (minimum) | Pass | **Fixed:** the der/die/das and true/false buttons used white text (2:1 in dark mode) and the "Known" chip in Cards was 1.8:1 in dark mode. Every pair is now tested (see above). |
| 1.4.4 Resize text | Pass | **Fixed:** at 200% zoom the Settings language list pushed the page sideways. No other screen scrolls sideways at 200%. A text-size setting is also available. |
| 1.4.5 Images of text | Pass | None. |
| 1.4.10 Reflow | Pass | The desktop window's minimum is 720 × 560 px. Checked at 640 px wide (200% of 1280). Word rain needs a fixed-height play area, which the exception for games allows. |
| 1.4.11 Non-text contrast | Partial | **Fixed:** text fields and selects used `--color-border` (1.3:1). A new token, `borderStrong` (3.2:1 or more on every background), now outlines them; typed answer and gap fields keep a focus outline as well as the border colour. Decorative card borders keep the soft colour. **Gap:** the study calendar's lightest cells are below 3:1 against empty days. |
| 1.4.12 Text spacing | Pass | Text boxes have no fixed heights. Not tested separately with a text-spacing bookmarklet. |
| 1.4.13 Content on hover or focus | Pass | Only native `title` tooltips. |
| 2.1.1 Keyboard | Pass | **Fixed:** Home's session length and the import tabs are now one tab stop each, with the arrow keys, Home and End (mirrored right to left). All exercises and games work by keyboard, including Match pairs (Tab and Enter). |
| 2.1.2 No keyboard trap | Pass | Dialogs are native `<dialog>`: focus stays inside while open, Esc closes them, and focus returns to where it was. |
| 2.1.4 Character key shortcuts | Partial | In a session, 1–4, J/K/L and Space answer or replay. They only work during a session, and they never change the FSRS schedule from a game, but there is no setting yet to turn them off. **Proposal:** add "Single-key shortcuts" to Settings. |
| 2.2.1 Timing adjustable | Pass | Timers are opt-in and can be relaxed or turned off (Settings → Timers). With timers off, timed rounds such as word rain leave the session plan. The leave dialog pauses the clock. |
| 2.2.2 Pause, stop, hide | Pass | **Fixed:** card videos autoplay muted on a loop and now show controls, so they can be paused. Word rain moves while it runs because that is the game; the leave dialog (Esc) pauses it, and with timers off it isn't scheduled. |
| 2.3.1 Three flashes | Pass | Nothing flashes. Confetti only at a milestone, and never when reduced motion is on. |
| 2.4.1 Bypass blocks | Pass | "Skip to content" link. |
| 2.4.2 Page titled | Pass | **Fixed:** the window title now names the screen ("Decks – LernLab"). |
| 2.4.3 Focus order | Pass | **Fixed:** focus moves to the heading on every screen change, to the summary's result when the session ends, and to the block title when a new block starts. In the category sprint the answered button kept focus but was disabled, which dropped focus to the page; in Match pairs focus was lost when a pair disappeared. Both keep focus now. |
| 2.4.4 Link purpose | Pass | |
| 2.4.5 Multiple ways | Pass | Sidebar on every screen; few screens. |
| 2.4.6 Headings and labels | Pass | |
| 2.4.7 Focus visible | Pass | A 2 px accent outline on every control (`:focus-visible`), 5.4:1 or more against the backgrounds. |
| 2.4.11 Focus not obscured | Pass | The only sticky element (the card editor preview) sits in its own column. |
| 2.5.1 Pointer gestures | Pass | No path or multi-finger gestures. |
| 2.5.2 Pointer cancellation | Pass | Actions run on click (pointer up). |
| 2.5.3 Label in name | Pass | Labelled icon buttons use the word shown in the tooltip. |
| 2.5.4 Motion actuation | N/A | |
| 2.5.7 Dragging movements | Pass | The deck drop zone also has a "Choose a file" button. No exercise needs dragging. |
| 2.5.8 Target size (minimum) | Pass | **Fixed:** the Settings switches were 20 px; they are 24 px now. Buttons are 44 px; the Welcome radios sit inside large clickable labels. |
| 3.1.1 Language of page | Pass | `<html lang>` follows the interface language. |
| 3.1.2 Language of parts | Partial | The category sprint, word rain and a few other prompts carry the deck's `lang`, so screen readers switch voice. **Gap:** most exercise prompts (multiple choice, typed answers, gaps) and the Cards list don't set `lang` yet. |
| 3.2.1 On focus | Pass | |
| 3.2.2 On input | Pass | Settings save on change without moving focus or the screen. |
| 3.2.3 Consistent navigation | Pass | |
| 3.2.4 Consistent identification | Pass | |
| 3.2.6 Consistent help | N/A | No help mechanism yet. |
| 3.3.1 Error identification | Pass | Import and data errors use `role="alert"` with text. |
| 3.3.2 Labels or instructions | Pass | |
| 3.3.3 Error suggestion | Pass | Import and settings errors say what went wrong in words. |
| 3.3.4 Error prevention | Pass | Deleting a deck or cards and restoring a backup ask first; backups run before migrations. |
| 3.3.7 Redundant entry | N/A | |
| 3.3.8 Accessible authentication | N/A | No account. |
| 4.1.2 Name, role, value | Pass | **Fixed:** the summary's Enter and Space shortcuts overrode focused buttons (Space on "Done" started another round). A focused control now keeps those keys. |
| 4.1.3 Status messages | Pass | **Fixed:** the word in the category sprint and each new word in word rain are announced (word rain is drawn for the eyes and was hidden from screen readers). Exercise cards, feedback, the teacher line and Settings' "Saved" are live regions. |

## Reduced motion

The system setting and Settings → Reduce motion both turn movement into short fades (`--motion-*` tokens), stop looping animations and turn off confetti. Word rain still falls, because the falling is the game; turn timers off to remove it from sessions.

## Still open

- **Screen-reader testing** with NVDA (Windows), VoiceOver (macOS) and Orca (Linux) on the packaged app. It needs real machines and is not possible in CI here. The issue's acceptance box stays open until someone runs it. Focus on the exercise cards (`aria-live` regions may be chatty), the games, and the import preview table.
- **Automated axe checks in the end-to-end tests.** `@axe-core/playwright` is not a dependency yet (`docs/TESTING.md` plans it). Adding it needs approval in the issue; once added, run it on every screen in both themes.
- **Single-key shortcuts setting** (2.1.4), proposed above.
- **`lang` on every card field** (3.1.2): exercise prompts, answers and the Cards list.
- **Import tabs:** wrap the tab content in a `role="tabpanel"` linked with `aria-controls`.
- **Windows high-contrast (`forced-colors`)** is not checked. Native controls adapt; custom outlines, the progress bars and the heat map need a look.
- **Design tokens:** `borderStrong` is a new token (light `#8A847B`, dark `#807B73`). The mockups in `docs/design/` still show the soft border on fields and should be updated to match.
