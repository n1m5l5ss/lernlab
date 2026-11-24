// Bytes shaped like a PNG for tests and stories: the signature, an IHDR chunk with the size, padding, IEND.
// Not a decodable picture; the engine only reads the header.
export function fakePng(width: number, height: number, padding = 0): Uint8Array {
  const out = new Uint8Array(8 + 25 + padding + 12);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const v = new DataView(out.buffer);
  v.setUint32(8, 13);
  out.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  v.setUint32(16, width);
  v.setUint32(20, height);
  out.set([8, 6, 0, 0, 0], 24);
  out.set([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82], out.length - 8); // IEND and its checksum
  return out;
}
