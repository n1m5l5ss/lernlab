// Guesses the visitor's system from what the browser says about itself, to highlight the right download.
// Pure: the page passes in navigator's values, and the tests pass in real user-agent strings.
import type { DownloadKey } from './downloads';

export type System = 'windows' | 'mac' | 'linux' | 'mobile' | 'other';

export interface BrowserInfo {
  /** navigator.userAgent */
  userAgent: string;
  /** navigator.userAgentData.platform, or navigator.platform where that is missing. */
  platform?: string;
  /** navigator.userAgentData.mobile */
  mobile?: boolean;
  /** navigator.maxTouchPoints: an iPad says it is a Mac, but has a touch screen. */
  maxTouchPoints?: number;
  /** userAgentData.getHighEntropyValues(['architecture']): "arm" or "x86" (Chromium browsers only). */
  architecture?: string;
}

export interface Detected {
  system: System;
  /** Only when the browser tells us (Chromium on a Mac); Safari and Firefox never do. */
  arch?: 'arm64' | 'x64';
}

export function detectSystem(info: BrowserInfo): Detected {
  const ua = info.userAgent.toLowerCase();
  const platform = (info.platform ?? '').toLowerCase();
  const arch = info.architecture === 'arm' ? 'arm64' : info.architecture === 'x86' ? 'x64' : undefined;
  const says = (word: string) => ua.includes(word) || platform.includes(word);

  if (info.mobile || /android|iphone|ipod|ipad/.test(ua) || platform === 'android' || platform === 'ios') {
    return { system: 'mobile' };
  }
  if (says('mac') && (info.maxTouchPoints ?? 0) > 1) return { system: 'mobile' }; // iPad in desktop mode
  if (says('cros') || platform === 'chrome os' || platform === 'chromeos') return { system: 'other' };
  // Mac first: "Darwin" in some user agents contains "win".
  if (says('mac') || says('darwin')) return arch ? { system: 'mac', arch } : { system: 'mac' };
  if (says('win')) return { system: 'windows' };
  if (says('linux') || says('x11')) return { system: 'linux' };
  return { system: 'other' };
}

/**
 * The downloads to highlight, best first. On a Mac whose chip the browser won't tell, both are
 * highlighted and Apple silicon comes first, since every Mac sold since 2021 has it.
 */
export function recommendedDownloads(detected: Detected): DownloadKey[] {
  switch (detected.system) {
    case 'windows':
      return ['windows'];
    case 'mac':
      if (detected.arch === 'arm64') return ['mac-arm64'];
      if (detected.arch === 'x64') return ['mac-x64'];
      return ['mac-arm64', 'mac-x64'];
    case 'linux':
      return ['linux-appimage', 'linux-deb'];
    default:
      return [];
  }
}
