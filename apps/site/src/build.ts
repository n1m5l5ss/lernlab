// Builds the website into apps/site/dist: the static files, the design tokens, the script compiled to
// plain JavaScript, and the download links for the newest version.
//
//   npm run build -w @lernlab/site                          links from package.json's version
//   npm run build -w @lernlab/site -- --release release.json   links from `gh release view --json tagName,assets`
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { injectDownloads, resolveDownloads, type BuilderConfig, type Release } from './downloads';

const SITE = join(import.meta.dirname, '..');
const ROOT = join(SITE, '..', '..');
const OUT = join(SITE, 'dist');
/** The TypeScript files that run in the browser. */
const BROWSER = ['detect.ts', 'mac-guide.ts', 'main.ts'];

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

function build(releasePath?: string) {
  const root = readJson<{ version: string }>(join(ROOT, 'package.json'));
  const desktop = readJson<{ name: string; build: BuilderConfig }>(join(ROOT, 'apps', 'desktop', 'package.json'));
  const release = releasePath && existsSync(releasePath) ? readJson<Release>(releasePath) : undefined;
  const downloads = resolveDownloads({ version: root.version, config: desktop.build, name: desktop.name, release });

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, 'js'), { recursive: true });
  cpSync(join(SITE, 'public'), OUT, { recursive: true });
  cpSync(join(ROOT, 'packages', 'ui', 'tokens.css'), join(OUT, 'tokens.css'));
  for (const file of BROWSER) {
    const source = readFileSync(join(SITE, 'src', file), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
    });
    writeFileSync(join(OUT, 'js', file.replace(/\.ts$/, '.js')), outputText);
  }
  const index = join(OUT, 'index.html');
  writeFileSync(index, injectDownloads(readFileSync(index, 'utf8'), downloads));
  console.log(`Website built in ${OUT} for LernLab ${downloads.version}${release ? ' (from the release)' : ''}.`);
}

const at = process.argv.indexOf('--release');
build(at > 0 ? process.argv[at + 1] : undefined);
