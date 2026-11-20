// JSON with file data, for the web dev server only (the desktop bridge sends bytes as they are).
// A Uint8Array travels as { $bytes: "<base64>" }.

function toBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const toWire = (value: unknown): string =>
  JSON.stringify(value ?? null, (_k, x) => (x instanceof Uint8Array ? { $bytes: toBase64(x) } : x));

export const fromWire = (text: string): unknown =>
  JSON.parse(text, (_k, x) =>
    x && typeof x === 'object' && typeof x.$bytes === 'string' && Object.keys(x).length === 1
      ? fromBase64(x.$bytes)
      : x,
  );
