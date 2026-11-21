// Your own voice on a card: the editor records with the platform's MediaRecorder (Opus, compressed)
// and the bytes are checked here before they are kept in media/ like any other audio file.
import { UserError } from './errors';
import { host } from './host';

/** The editor stops recording after this many seconds. */
export const RECORDING_MAX_SECONDS = 60;
/** 60 s of Opus at the editor's 64 kbit/s is about 480 KB; anything far bigger is not a recording. */
export const RECORDING_MAX_BYTES = 2 * 1024 * 1024;

const WEBM = [0x1a, 0x45, 0xdf, 0xa3];
const OGG = [0x4f, 0x67, 0x67, 0x53]; // OggS
const starts = (b: Uint8Array, sig: number[]) => sig.every((x, i) => b[i] === x);

/** Keep a recording (WebM or Ogg, as browsers record it) under a new name; returns the file name. */
export function saveRecording(data: Uint8Array): string {
  const ext = starts(data, WEBM) ? '.weba' : starts(data, OGG) ? '.ogg' : null;
  if (!ext) throw new UserError('unsupported_media', 'Not an audio recording');
  if (data.length > RECORDING_MAX_BYTES)
    throw new UserError('recording_too_long', 'Recording too long', { seconds: RECORDING_MAX_SECONDS });
  const file = `recording-${host().randomId()}${ext}`;
  host().media.write(file, data);
  return file;
}
