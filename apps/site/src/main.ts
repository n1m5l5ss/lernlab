// The website's only script: highlight the download for this computer and point the main button at it.
// Without JavaScript the page still works: the main button jumps to the list of all downloads.
// A Mac or Windows download first explains the one-time system warning (first-open-guide.ts).
import { detectSystem, recommendedDownloads, type BrowserInfo } from './detect.js';
import { setupGuides } from './first-open-guide.js';

interface UserAgentData {
  platform?: string;
  mobile?: boolean;
  getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>;
}

async function browserInfo(): Promise<BrowserInfo> {
  const data = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
  const info: BrowserInfo = {
    userAgent: navigator.userAgent,
    platform: data?.platform || navigator.platform,
    mobile: data?.mobile,
    maxTouchPoints: navigator.maxTouchPoints,
  };
  try {
    info.architecture = (await data?.getHighEntropyValues?.(['architecture']))?.architecture;
  } catch {
    // The browser declined; we just don't know the chip.
  }
  return info;
}

async function highlightDownload() {
  const detected = detectSystem(await browserInfo());
  const keys = recommendedDownloads(detected);
  document.documentElement.dataset.system = detected.system;

  for (const key of keys) {
    const option = document.querySelector<HTMLElement>(`[data-option="${key}"]`);
    option?.classList.add('is-recommended');
    option?.querySelector<HTMLElement>('.badge')?.removeAttribute('hidden');
  }
  const card = document.querySelector<HTMLElement>(`[data-system-card="${detected.system}"]`);
  card?.classList.add('is-recommended');

  const primary = document.getElementById('primary-download') as HTMLAnchorElement | null;
  const first = keys[0] && document.querySelector<HTMLAnchorElement>(`a[data-download="${keys[0]}"]`);
  if (primary && first) {
    primary.href = first.href;
    primary.dataset.downloadKey = keys[0];
    const label = primary.dataset[`label${keys[0].replace(/(^|-)(\w)/g, (_, _d, c: string) => c.toUpperCase())}`];
    if (label) primary.querySelector('.label')!.textContent = label;
  }
  const note = document.querySelector<HTMLElement>(`[data-note="${detected.system}"]`);
  note?.removeAttribute('hidden');
}

/** Plays the demo video only for visitors who haven't asked for less motion; it always has controls. */
function startDemo() {
  const video = document.querySelector<HTMLVideoElement>('video[data-autoplay]');
  if (!video || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  video.muted = true;
  video.play().catch(() => {});
}

highlightDownload();
startDemo();
setupGuides(document);
