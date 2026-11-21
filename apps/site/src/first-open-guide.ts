// The first-open guides for macOS (#39) and Windows. LernLab isn't signed with a paid certificate, so
// macOS and Windows SmartScreen warn the first time it opens. A Mac or Windows download button first
// explains why and asks: "Continue" starts the download and shows the steps; "No thanks" downloads
// nothing. Without JavaScript each guide is a plain section on the page and the buttons download
// straight away.

/** ask: the reason and the choice. steps: downloading, here's how. cancelled: nothing was downloaded. */
export type GuideStage = 'closed' | 'ask' | 'steps' | 'cancelled';

export interface GuideView {
  guide: boolean;
  why: boolean;
  choice: boolean;
  steps: boolean;
  cancelled: boolean;
  /** Where keyboard focus goes, so screen readers announce what just appeared. */
  focus: 'guide' | 'steps' | 'cancelled' | null;
}

/** What each part of a guide shows at a stage. */
export function guideView(stage: GuideStage): GuideView {
  switch (stage) {
    case 'closed':
      return { guide: false, why: false, choice: false, steps: false, cancelled: false, focus: null };
    case 'ask':
      return { guide: true, why: true, choice: true, steps: false, cancelled: false, focus: 'guide' };
    case 'steps':
      return { guide: true, why: true, choice: false, steps: true, cancelled: false, focus: 'steps' };
    case 'cancelled':
      return { guide: true, why: false, choice: false, steps: false, cancelled: true, focus: 'cancelled' };
  }
}

/** One guide on the page: section `#<prefix>-guide`, its parts marked `data-<prefix>-<part>`. */
export interface GuideConfig {
  prefix: 'mac' | 'win';
  /** Which download buttons (by data-download key) go through this guide. */
  keys: readonly string[];
}

export const GUIDES: readonly GuideConfig[] = [
  { prefix: 'mac', keys: ['mac-arm64', 'mac-x64'] },
  { prefix: 'win', keys: ['windows'] },
];

/** The guide a download goes through, if any. Linux downloads start at once. */
export function guideFor(key: string | undefined): GuideConfig | undefined {
  return GUIDES.find((guide) => key !== undefined && guide.keys.includes(key));
}

/** Mac downloads (Apple silicon or Intel) go through the Mac guide. */
export const isMacDownload = (key: string | undefined) => guideFor(key)?.prefix === 'mac';
/** The Windows installer goes through the Windows guide. */
export const isWindowsDownload = (key: string | undefined) => guideFor(key)?.prefix === 'win';

interface WiredGuide {
  config: GuideConfig;
  proceed: HTMLAnchorElement | null;
  show: (stage: GuideStage) => void;
}

function wire(doc: Document, config: GuideConfig): WiredGuide | undefined {
  const guide = doc.querySelector<HTMLElement>(`[data-${config.prefix}-guide]`);
  if (!guide) return undefined;
  const part = (name: string) => guide.querySelector<HTMLElement>(`[data-${config.prefix}-${name}]`);
  const why = part('why');
  const choice = part('choice');
  const steps = part('steps');
  const cancelled = part('cancelled');

  const show = (stage: GuideStage) => {
    const view = guideView(stage);
    guide.hidden = !view.guide;
    if (why) why.hidden = !view.why;
    if (choice) choice.hidden = !view.choice;
    if (steps) steps.hidden = !view.steps;
    if (cancelled) cancelled.hidden = !view.cancelled;
    const target = { guide, steps: part('steps-title'), cancelled }[view.focus ?? 'guide'];
    if (view.focus) target?.focus();
  };
  part('cancel')?.addEventListener('click', () => show('cancelled'));
  return { config, proceed: part('continue') as HTMLAnchorElement | null, show };
}

/** Wires the guides into the page. Called by main.ts. Only one guide is open at a time. */
export function setupGuides(doc: Document, configs: readonly GuideConfig[] = GUIDES) {
  const guides = configs.map((config) => wire(doc, config)).filter((g): g is WiredGuide => g !== undefined);
  const open = (target: WiredGuide, stage: GuideStage) => {
    for (const other of guides) if (other !== target) other.show('closed');
    target.show(stage);
  };
  const byHash = (href: string | null) => guides.find((g) => href === `#${g.config.prefix}-guide`);

  // Someone who followed a link to a guide sees its steps; the others stay closed.
  for (const g of guides) g.show('closed');
  const linked = byHash(doc.location.hash);
  if (linked) open(linked, 'steps');

  doc.addEventListener('click', (event) => {
    const link = (event.target as Element | null)?.closest?.('a');
    if (!link) return;
    const proceeding = guides.find((g) => g.proceed === link);
    if (proceeding) {
      // The link's own download starts; show the steps beside it.
      proceeding.show('steps');
      return;
    }
    const target = byHash(link.getAttribute('href'));
    if (target) {
      event.preventDefault();
      open(target, 'steps');
      return;
    }
    const config = guideFor(link.dataset.download ?? link.dataset.downloadKey);
    const wired = config && guides.find((g) => g.config === config);
    if (wired) {
      event.preventDefault();
      if (wired.proceed) wired.proceed.href = link.href;
      open(wired, 'ask');
    }
  });
}
