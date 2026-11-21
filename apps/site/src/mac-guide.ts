// The Mac first-open guide (#39). The Mac app isn't signed with a paid Apple certificate, so macOS warns
// the first time it opens. A Mac download button first explains why and asks: "Continue" starts the
// download and shows the steps; "No thanks" downloads nothing. Without JavaScript the guide is a plain
// section on the page and the buttons download straight away.

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

/** What each part of the guide shows at a stage. */
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

/** Mac downloads (Apple silicon or Intel) go through the guide; the others download at once. */
export function isMacDownload(key: string | undefined): boolean {
  return key === 'mac-arm64' || key === 'mac-x64';
}

/** Wires the guide into the page. Called by main.ts. */
export function setupMacGuide(doc: Document) {
  const guide = doc.querySelector<HTMLElement>('[data-mac-guide]');
  if (!guide) return;
  const part = (name: string) => guide.querySelector<HTMLElement>(`[data-mac-${name}]`);
  const why = part('why');
  const choice = part('choice');
  const steps = part('steps');
  const cancelled = part('cancelled');
  const proceed = part('continue') as HTMLAnchorElement | null;

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

  // Someone who followed a link to the guide (or has no Mac download pending) sees the steps.
  show(doc.location.hash === '#mac-guide' ? 'steps' : 'closed');

  doc.addEventListener('click', (event) => {
    const link = (event.target as Element | null)?.closest?.('a');
    if (!link) return;
    if (link === proceed) {
      // The link's own download starts; show the steps beside it.
      show('steps');
      return;
    }
    if (link.getAttribute('href') === '#mac-guide') {
      event.preventDefault();
      show('steps');
      return;
    }
    if (isMacDownload(link.dataset.download ?? link.dataset.downloadKey)) {
      event.preventDefault();
      if (proceed) proceed.href = link.href;
      show('ask');
    }
  });
  part('cancel')?.addEventListener('click', () => show('cancelled'));
}
