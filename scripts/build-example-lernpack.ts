// Build the example .lernpack files in examples/ from their folders in examples/decks/, with the real
// importer and exporter, so each package is exactly what LernLab writes. Run from the repo root:
//   npx tsx scripts/build-example-lernpack.ts
// Only the manifest's `created` time and the zip timestamps change between runs.
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { zipSync, type Zippable } from 'fflate';

/** The decks in examples/decks/ that ship as a .lernpack in examples/ (example-decks.test.ts lists them too). */
const EXAMPLE_PACKS = [
  'german-colours-with-pictures',
  'spanish-first-conversations',
  'networking-essentials',
  'chemistry-first-20-elements',
];

process.env.LERNLAB_DATA = mkdtempSync(join(tmpdir(), 'lernlab-example-'));
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('@lernlab/core/importer');
const { exportDeck } = await import('@lernlab/core/exporter');

function walk(source: string, dir = source, files: Zippable = {}): Zippable {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(source, path, files);
    else files[relative(source, path).split('\\').join('/')] = new Uint8Array(readFileSync(path));
  }
  return files;
}

for (const name of EXAMPLE_PACKS) {
  const target = `examples/${name}.lernpack`;
  const { deck } = importFile(`${name}.zip`, zipSync(walk(`examples/decks/${name}`)));
  const pack = exportDeck(deck.id, 'lernpack');
  writeFileSync(target, pack.data);
  console.log(`Wrote ${target} (${pack.data.length} bytes)`);
}
