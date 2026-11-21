// Marks where a typed answer differs from the right one, so feedback can highlight just those letters.
export type Piece = { text: string; same: boolean };

/** Split `a` into runs that also appear in `b` (in order) and runs that don't, using a longest common subsequence. */
export function diffPieces(a: string, b: string): Piece[] {
  const x = [...a];
  const y = [...b];
  // Long answers (sentences) only need a rough picture; keep the table small.
  if (x.length * y.length > 40_000) return [{ text: a, same: a === b }];
  const lcs = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--)
    for (let j = y.length - 1; j >= 0; j--)
      lcs[i][j] =
        x[i].toLowerCase() === y[j].toLowerCase() ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: Piece[] = [];
  const push = (ch: string, same: boolean) => {
    const last = out[out.length - 1];
    if (last && last.same === same) last.text += ch;
    else out.push({ text: ch, same });
  };
  let i = 0;
  let j = 0;
  while (i < x.length) {
    if (j < y.length && x[i].toLowerCase() === y[j].toLowerCase()) {
      push(x[i++], true);
      j++;
    } else if (j < y.length && lcs[i][j + 1] >= lcs[i + 1][j]) j++;
    else push(x[i++], false);
  }
  return out;
}

/** Like diffPieces, but when the two barely overlap, marks the whole thing: scattered highlights would only be noise. */
export function markDiff(a: string, b: string): Piece[] {
  const pieces = diffPieces(a, b);
  const same = pieces.filter((p) => p.same).reduce((n, p) => n + [...p.text].length, 0);
  return same * 2 < Math.max([...a].length, [...b].length) ? [{ text: a, same: false }] : pieces;
}
