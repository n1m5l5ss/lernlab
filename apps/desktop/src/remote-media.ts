// Pictures, video and sound that a deck links from the internet (#177). Loading one tells that website the
// learner's IP address and when they study, so it is blocked until they turn on Settings → Privacy →
// "Allow pictures and sounds from the internet". Media stored with the deck always works.
import { mediaUrl } from './bridge';

export const isRemoteMedia = (file: string) => /^https?:\/\//i.test(file.trim());

let allowed = false;
/** Called with the saved setting whenever the app state loads or Settings change. */
export const allowRemoteMedia = (on: boolean) => {
  allowed = on === true;
};
export const remoteMediaAllowed = () => allowed;

/** Where to load a deck's media file from, or null when it is an internet link that is blocked. */
export function mediaSrc(file: string): string | null {
  if (!isRemoteMedia(file)) return mediaUrl(file);
  return allowed ? file.trim() : null;
}
