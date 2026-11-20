// Test-only helper: Node's built-in zstd (Node ≥ 22.15) to build "new format" Anki packages.
import { zstdCompressSync } from 'node:zlib';
export const compress = (b: Uint8Array) => new Uint8Array(zstdCompressSync(b));
