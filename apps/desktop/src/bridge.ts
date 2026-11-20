// How the window reaches the app. In the desktop app that is `window.lernlab` (preload + IPC, no network).
// In web dev mode (`npm start`) it is a small HTTP call to the local dev server.
import type { Channel, InputOf, OutputOf, Result } from '../backend/handlers';
import { fromWire, toWire } from '../backend/wire';
import i18next from './i18n';

type Bridge = { invoke(channel: string, input?: unknown): Promise<Result<unknown>> };

declare global {
  interface Window {
    lernlab?: Bridge;
  }
}

export const isDesktop = () => typeof window !== 'undefined' && !!window.lernlab;

const http: Bridge = {
  async invoke(channel, input) {
    const res = await fetch(`/api/invoke/${channel}`, { method: 'POST', body: toWire(input) });
    return fromWire(await res.text()) as Result<unknown>;
  },
};

/** An error from the app, with its message in the interface language (locales: errors.<code>). */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Call the app. Rejects with an AppError, translated from its code, if the request fails. */
export async function call<C extends Channel>(
  channel: C,
  ...input: InputOf<C> extends void ? [] : [InputOf<C>]
): Promise<OutputOf<C>> {
  const res = await (window.lernlab ?? http).invoke(channel, input[0]);
  if (!res.ok) {
    const { code, message, params } = res.error;
    throw new AppError(code, i18next.t(`errors.${code}`, { ...params, defaultValue: message }));
  }
  return res.value as OutputOf<C>;
}

/** URL for a media file in the user's library. */
export const mediaUrl = (file: string) =>
  `${isDesktop() ? 'lernlab-media://media' : '/media'}/${encodeURIComponent(file)}`;

/** Let the user save bytes as a file (deck exports, the daily summary). */
export function saveFile(name: string, data: Uint8Array | string, type: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
