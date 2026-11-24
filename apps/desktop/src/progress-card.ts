// The progress card (#214): a summary of your week that you can print, save as a PDF or save as a picture to show
// a teacher, a parent or a friend. It is made on this computer; nothing is sent anywhere. The card holds
// progress only (cards, days, goals), never XP or levels, so it reads the same in calm mode.
// Pure: the facts, and the picture as an SVG string. The screen turns the SVG into a PNG.

/** Most decks listed on the card. */
export const CARD_DECKS = 3;
export const CARD_WIDTH = 1200;

type Part = { target: number; done: number };
type JourneyLike = {
  decks: { id: number; name: string; learned: number; cards: number; examDate: string | null }[];
  totals: { learned: number };
  week: {
    start: string;
    cards: Part;
    sessions: Part;
    days: number;
    minutes: number;
    exam: { deck: string; date: string; days: number } | null;
  };
  retention: { reviews: number; recalled: number };
};

export type CardFacts = {
  /** The Monday of the week. */
  week: string;
  learned: number;
  cards: Part;
  sessions: Part;
  days: number;
  minutes: number;
  /** Share of reviews recalled, or null before any review. */
  recalled: number | null;
  exam: JourneyLike['week']['exam'];
  /** The decks with the most cards learned. */
  decks: JourneyLike['decks'];
  /** Decks with cards that are not listed. */
  moreDecks: number;
};

export function cardFacts(p: JourneyLike): CardFacts {
  const decks = p.decks.filter((d) => d.cards > 0).sort((a, b) => b.learned - a.learned || a.id - b.id);
  return {
    week: p.week.start,
    learned: p.totals.learned,
    cards: p.week.cards,
    sessions: p.week.sessions,
    days: p.week.days,
    minutes: p.week.minutes,
    recalled: p.retention.reviews > 0 ? p.retention.recalled / p.retention.reviews : null,
    exam: p.week.exam,
    decks: decks.slice(0, CARD_DECKS),
    moreDecks: Math.max(0, decks.length - CARD_DECKS),
  };
}

/** How full a goal's bar is, 0 to 1. */
export const goalShare = (done: number, target: number) => (target > 0 ? Math.min(1, Math.max(0, done / target)) : 0);

/** Cut text to `max` characters (whole ones, so no emoji is split), ending in an ellipsis. */
export function clip(s: string, max: number): string {
  const chars = [...s];
  return chars.length <= max ? s : `${chars.slice(0, max - 1).join('')}…`;
}

export const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Every word on the card, already translated and formatted by the screen. */
export type CardText = {
  title: string;
  subtitle: string;
  stats: { value: string; label: string }[];
  goalsTitle: string;
  goals: { label: string; value: string; share: number }[];
  /** One extra line under the goals (the next exam), or ''. */
  note: string;
  decksTitle: string;
  decks: { name: string; detail: string; share: number }[];
  footer: string;
};
/** Colours from the design tokens, read by the screen (the picture can't see CSS variables). */
export type CardColors = { bg: string; surface: string; text: string; muted: string; accent: string; border: string };

export const cardFileName = (day: string) => `lernlab-progress-${day}.png`;

/** The card as a picture: plain SVG shapes and text only (no links, images or scripts), every string escaped. */
export function cardSvg(
  text: CardText,
  colors: CardColors,
  { rtl = false }: { rtl?: boolean } = {},
): { svg: string; width: number; height: number } {
  const c = Object.fromEntries(Object.entries(colors).map(([k, v]) => [k, xml(v)])) as CardColors;
  const W = CARD_WIDTH;
  const pad = 64;
  const inner = W - 2 * pad;
  const start = rtl ? W - pad : pad;
  const end = rtl ? pad : W - pad;
  const out: string[] = [];
  const line = (x: number, y: number, s: string, size: number, fill: string, weight = 400, anchor = 'start') =>
    out.push(
      `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${xml(s)}</text>`,
    );
  /** A bar across the card, filled from the start side. */
  const bar = (y: number, share: number) => {
    const w = Math.round(inner * goalShare(share, 1));
    out.push(`<rect x="${pad}" y="${y}" width="${inner}" height="12" rx="6" fill="${c.border}"/>`);
    if (w > 0)
      out.push(`<rect x="${rtl ? W - pad - w : pad}" y="${y}" width="${w}" height="12" rx="6" fill="${c.accent}"/>`);
  };
  /** A row: label at the start, value at the end, a bar underneath. Returns the next y. */
  const row = (y: number, label: string, value: string, share: number) => {
    line(start, y, clip(label, 48), 26, c.text, 600);
    line(end, y, clip(value, 28), 26, c.muted, 400, 'end');
    bar(y + 16, share);
    return y + 72;
  };

  let y = pad + 44;
  line(start, y, clip(text.title, 44), 48, c.text, 700);
  y += 44;
  line(start, y, clip(text.subtitle, 70), 26, c.muted);
  y += 40;

  const n = Math.max(1, text.stats.length);
  const gap = 20;
  const tile = (inner - gap * (n - 1)) / n;
  text.stats.forEach((s, i) => {
    const x = pad + (rtl ? n - 1 - i : i) * (tile + gap);
    out.push(`<rect x="${x}" y="${y}" width="${tile}" height="132" rx="16" fill="${c.surface}" stroke="${c.border}"/>`);
    const tx = rtl ? x + tile - 24 : x + 24;
    line(tx, y + 60, clip(s.value, 12), 40, c.text, 700);
    line(tx, y + 100, clip(s.label, Math.floor((tile - 48) / 9)), 18, c.muted);
  });
  y += 132 + 64;

  if (text.goals.length) {
    line(start, y, clip(text.goalsTitle, 60), 22, c.muted, 600);
    y += 48;
    for (const g of text.goals) y = row(y, g.label, g.value, g.share);
  }
  if (text.note) {
    line(start, y, clip(text.note, 80), 22, c.muted);
    y += 48;
  }
  if (text.decks.length) {
    y += 16;
    line(start, y, clip(text.decksTitle, 60), 22, c.muted, 600);
    y += 48;
    for (const d of text.decks) y = row(y, d.name, d.detail, d.share);
  }
  y += 8;
  line(start, y, clip(text.footer, 90), 20, c.muted);
  const H = y + pad;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"` +
    ` font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"${rtl ? ' direction="rtl"' : ''}>` +
    `<rect width="${W}" height="${H}" fill="${c.bg}"/>${out.join('')}</svg>`;
  return { svg, width: W, height: H };
}
