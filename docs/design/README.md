# Design

- **Mockups (light and dark):** https://claude.ai/artifact/6kaq72rGnUE3vvNLwnoscT. They cover Welcome, Home, Study session, a wrong answer, Block summary, Decks, and the visual style sheet. Status: **waiting for the owner's approval** (issue #1).
- **Source of the mockups:** `canvas/project/*.dc.html`. Each is a plain HTML file; read them for exact sizes, colours and copy.
- **Design tokens:** `tokens.json`, the single source for colours, type, spacing, radius and motion (issue #2; implemented in #59).
- **Why it looks like this:** the design research, summarised below. The full report is in the planning chat; the key numbers are in `docs/research.md` and here.

## Rules the design follows

1. **The study screen is sacred.**
   - **What's on screen:** one centred card, one primary action, and a 4 px progress bar.
   - **What's never on it:** mascots or decoration.
   - **Celebrations:** only at the end of a block, never between cards.
   - **Why:** decoration hurts learning (the "seductive details" effect, g = −0.33 across 58 studies).
2. **Feedback is colour + icon + word**, in green and vermillion (colour-blind safe), never red against green.
   - Errors are neutral and about the task: "Not quite — here's the answer", with the difference highlighted.
   - No shaking and no buzzers.
3. **Themes.** Follow the system theme by default, with first-class light and dark themes.
   - Dark is warm near-black (#1A1917), never pure black.
   - Light reads slightly better, so it is the design reference.
4. **Typography.**
   - **Font:** Atkinson Hyperlegible Next, falling back to system fonts and Noto for Telugu, Devanagari, Arabic and CJK.
   - **Language tags:** every card field carries `lang`.
   - **Sizes:** body at least 16 px; prompts 31–39 px.
   - **Options:** letter spacing, text size up to 150%, and alternative fonts (OpenDyslexic, Lexend) as preferences. The evidence doesn't show they treat dyslexia.
5. **Attention.**
   - Timers are opt-in, adjustable or off.
   - The streak counts weekly consistency ("4 of 7 days"); a missed day is a gap, never a reset.
   - No guilt notifications and no leaderboards.
   - XP rewards effortful recall, not time spent.
6. **Sound** is off by default: two short, soft tones when enabled.
7. **Motion** lasts 120–280 ms and is replaced by fades when the system asks for reduced motion.
8. **Accessibility:** WCAG 2.2 AA.
   - **Contrast:** at least 4.5:1 for text, 3:1 for icons and borders.
   - **Targets:** at least 44 px.
   - **Keyboard and screen readers:** visible focus, full keyboard use, and `aria-live` announcements of feedback.
