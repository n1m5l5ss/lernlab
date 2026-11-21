// Windows signing (#39): after SignPath signs the installer, latest.yml must describe the signed file,
// or auto-update would refuse the download (sha512 mismatch).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateLatestYml } from './signed-installer';

const LATEST = `version: 1.2.3
files:
  - url: LernLab-Setup-1.2.3.exe
    sha512: OLDHASH==
    size: 100
path: LernLab-Setup-1.2.3.exe
sha512: OLDHASH==
releaseDate: '2026-11-21T10:00:00.000Z'
`;

test('latest.yml gets the signed installer’s sha512 and size, in the file list and at the top', () => {
  const out = updateLatestYml(LATEST, 'LernLab-Setup-1.2.3.exe', { sha512: 'NEW+/==', size: 123 });
  assert.equal(
    out,
    `version: 1.2.3
files:
  - url: LernLab-Setup-1.2.3.exe
    sha512: NEW+/==
    size: 123
path: LernLab-Setup-1.2.3.exe
sha512: NEW+/==
releaseDate: '2026-11-21T10:00:00.000Z'
`,
  );
});

test('other files in latest.yml are left alone', () => {
  const yml = LATEST.replace('path:', '  - url: other.exe\n    sha512: KEEP\n    size: 7\npath:');
  const out = updateLatestYml(yml, 'LernLab-Setup-1.2.3.exe', { sha512: 'NEW', size: 1 });
  assert.match(out, /- url: other\.exe\n {4}sha512: KEEP\n {4}size: 7/);
});

test('a file latest.yml doesn’t list is an error, not a silent mismatch', () => {
  assert.throws(() => updateLatestYml(LATEST, 'LernLab-Setup-9.9.9.exe', { sha512: 'x', size: 1 }), /9\.9\.9/);
});

test('the script swaps in the signed file and rewrites latest.yml and the block map', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lernlab-sign-'));
  const release = join(dir, 'release');
  const signed = join(dir, 'signed');
  mkdirSync(release);
  mkdirSync(signed);
  writeFileSync(join(release, 'LernLab-Setup-1.2.3.exe'), 'unsigned');
  writeFileSync(join(release, 'latest.yml'), LATEST);
  const body = Buffer.from('signed installer bytes');
  writeFileSync(join(signed, 'LernLab-Setup-1.2.3.exe'), body);

  execFileSync(
    process.execPath,
    ['--import', 'tsx', join(import.meta.dirname, 'signed-installer.ts'), signed, release],
    {
      stdio: 'pipe',
    },
  );

  assert.deepEqual(readFileSync(join(release, 'LernLab-Setup-1.2.3.exe')), body);
  const sha512 = createHash('sha512').update(body).digest('base64');
  const yml = readFileSync(join(release, 'latest.yml'), 'utf8');
  assert.match(yml, new RegExp(`size: ${body.length}\\n`));
  assert.equal(yml.split(`sha512: ${sha512}`).length, 3, 'both sha512 lines updated');
  assert.ok(existsSync(join(release, 'LernLab-Setup-1.2.3.exe.blockmap')));
});
