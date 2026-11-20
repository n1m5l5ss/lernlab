// Build examples/german-colours-with-pictures.lernpack with the real importer and exporter, so the
// example package is exactly what LernLab writes. Run from the repo root:
//   npx tsx scripts/build-example-lernpack.ts
// Only the manifest's `created` time and the zip timestamps change between runs.
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { zipSync, type Zippable } from 'fflate';

const source = 'examples/decks/german-colours-with-pictures';
const target = 'examples/german-colours-with-pictures.lernpack';

process.env.LERNLAB_DATA = mkdtempSync(join(tmpdir(), 'lernlab-example-'));
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('@lernlab/core/importer');
const { exportDeck } = await import('@lernlab/core/exporter');

function walk(dir: string, files: Zippable = {}): Zippable {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, files);
    else files[relative(source, path).split('\\').join('/')] = new Uint8Array(readFileSync(path));
  }
  return files;
}

const { deck } = importFile('german-colours-with-pictures.zip', zipSync(walk(source)));
const pack = exportDeck(deck.id, 'lernpack');
writeFileSync(target, pack.data);
console.log(`Wrote ${target} (${pack.data.length} bytes)`);
