// After SignPath signs the Windows installer (#39, docs/CODE_SIGNING.md), the file differs from the one
// electron-builder described in latest.yml: signing adds the signature to the .exe. Auto-update checks the
// download against latest.yml's sha512 and size, so this puts the signed installer in place and rewrites
// its sha512, size and .blockmap. Run by .github/workflows/release.yml:
//
//   npx tsx apps/desktop/electron/signed-installer.ts <folder with the signed .exe> <release folder>
import { copyFileSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface FileInfo {
  sha512: string;
  size: number;
}

/**
 * Gives `file` new checksums in an electron-builder latest.yml: its entry under `files:` and, when it is
 * the main `path:`, the top-level `sha512:`. Throws when latest.yml doesn't list the file.
 */
export function updateLatestYml(yml: string, file: string, info: FileInfo): string {
  const lines = yml.split('\n');
  const value = (line: string) =>
    line
      .slice(line.indexOf(':') + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  const topPath = lines.find((l) => l.startsWith('path:'));
  const isMain = topPath !== undefined && value(topPath) === file;
  let inEntry = false;
  let found = false;
  const out = lines.map((line) => {
    const entry = /^\s*- url:/.exec(line);
    if (entry) {
      inEntry = value(line) === file;
      found ||= inEntry;
      return line;
    }
    if (!/^\s/.test(line)) inEntry = false;
    if (inEntry && /^\s+sha512:/.test(line)) return line.replace(/sha512:.*/, `sha512: ${info.sha512}`);
    if (inEntry && /^\s+size:/.test(line)) return line.replace(/size:.*/, `size: ${info.size}`);
    if (isMain && line.startsWith('sha512:')) return `sha512: ${info.sha512}`;
    return line;
  });
  if (!found) throw new Error(`latest.yml does not list ${file}`);
  return out.join('\n');
}

async function main(signedDir: string, releaseDir: string) {
  // electron-builder's own block map writer, so differential updates keep working after signing.
  const { buildBlockMap } = await import('app-builder-lib/out/targets/blockmap/blockmap.js');
  const ymlPath = join(releaseDir, 'latest.yml');
  let yml = readFileSync(ymlPath, 'utf8');
  const signed = readdirSync(signedDir).filter((f) => f.toLowerCase().endsWith('.exe'));
  if (signed.length === 0) throw new Error(`No signed .exe in ${signedDir}`);
  for (const name of signed) {
    const target = join(releaseDir, basename(name));
    copyFileSync(join(signedDir, name), target);
    const info = await buildBlockMap(target, 'gzip', `${target}.blockmap`);
    const size = statSync(target).size;
    yml = updateLatestYml(yml, basename(name), { sha512: info.sha512, size });
    console.log(`Signed installer in place: ${basename(name)} (${size} bytes)`);
  }
  writeFileSync(ymlPath, yml);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [signedDir, releaseDir] = process.argv.slice(2);
  if (!signedDir || !releaseDir) {
    console.error('Usage: signed-installer.ts <signed folder> <release folder>');
    process.exit(2);
  }
  main(signedDir, releaseDir).catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
