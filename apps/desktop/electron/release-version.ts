// The version the installers carry, taken from the release tag (run by .github/workflows/release.yml).
//   tsx apps/desktop/electron/release-version.ts v1.2.3   → prints 1.2.3, or explains and exits 1
// A stable tag must equal the version in package.json (release-please bumps it before tagging).
// A pre-release tag (a beta from dev) must lead up to a newer version than package.json.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type ReleaseVersion = { ok: true; version: string } | { ok: false; error: string };

const num = '(0|[1-9]\\d*)';
const TAG = new RegExp(`^v(${num}\\.${num}\\.${num})(?:-([0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*))?$`);

const parts = (v: string) => v.split('.').map(Number);
const compare = (a: string, b: string) => {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

export function releaseVersion(tag: string, packageVersion: string): ReleaseVersion {
  const m = TAG.exec(tag);
  if (!m) return { ok: false, error: `Tag "${tag}" is not vX.Y.Z or vX.Y.Z-beta.N.` };
  const [, base, , , , pre] = m;
  if (!pre) {
    if (base !== packageVersion)
      return { ok: false, error: `Tag ${tag} does not match package.json version ${packageVersion}.` };
    return { ok: true, version: base };
  }
  if (compare(base, packageVersion) <= 0)
    return { ok: false, error: `Pre-release ${tag} must lead up to a version newer than ${packageVersion}.` };
  return { ok: true, version: `${base}-${pre}` };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pkg = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  const r = releaseVersion(process.argv[2] ?? '', pkg.version);
  if (r.ok) console.log(r.version);
  else {
    console.error(r.error);
    process.exit(1);
  }
}
