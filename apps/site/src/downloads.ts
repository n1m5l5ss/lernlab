// Which installer file the website links to for each system (issue #41).
// The names follow the electron-builder config in apps/desktop/package.json; when the build knows the
// newest GitHub Release, it takes the real asset names from it instead, so the links never break.

export const REPO = 'n1m5l5ss/lernlab';
export const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;

export const DOWNLOAD_KEYS = ['windows', 'mac-arm64', 'mac-x64', 'linux-appimage', 'linux-deb'] as const;
export type DownloadKey = (typeof DOWNLOAD_KEYS)[number];

/** The parts of the electron-builder config (`build` in apps/desktop/package.json) that name files. */
export interface BuilderConfig {
  productName: string;
  mac?: { artifactName?: string };
  nsis?: { artifactName?: string };
  linux?: { artifactName?: string };
  appImage?: { artifactName?: string };
  deb?: { artifactName?: string };
}

/** electron-builder's own defaults, used when the config sets no artifactName. */
const DEFAULTS = {
  nsis: '${productName} Setup ${version}.${ext}',
  mac: '${productName}-${version}-${arch}.${ext}',
  appImage: '${productName}-${version}.${ext}',
  deb: '${name}_${version}_${arch}.${ext}',
};

/** Fills an electron-builder file name template such as `${productName}-${version}.${ext}`. */
export function expandArtifactName(template: string, vars: Record<string, string>): string {
  return template.replace(/\$\{(\w+)\}/g, (whole, key: string) => vars[key] ?? whole);
}

/**
 * The file each system downloads for a version. `name` is the npm package name, which the .deb uses.
 * GitHub turns spaces in uploaded file names into dots, so the names here do the same.
 */
export function installerNames(version: string, config: BuilderConfig, name: string): Record<DownloadKey, string> {
  const base = { productName: config.productName, version, name };
  const fill = (template: string, arch: string, ext: string) =>
    expandArtifactName(template, { ...base, arch, ext }).replace(/ /g, '.');
  const mac = config.mac?.artifactName ?? DEFAULTS.mac;
  const appImage = config.appImage?.artifactName ?? config.linux?.artifactName ?? DEFAULTS.appImage;
  const deb = config.deb?.artifactName ?? config.linux?.artifactName ?? DEFAULTS.deb;
  return {
    windows: fill(config.nsis?.artifactName ?? DEFAULTS.nsis, 'x64', 'exe'),
    'mac-arm64': fill(mac, 'arm64', 'dmg'),
    'mac-x64': fill(mac, 'x64', 'dmg'),
    'linux-appimage': fill(appImage, 'x86_64', 'AppImage'),
    'linux-deb': fill(deb, 'amd64', 'deb'),
  };
}

/** Finds each system's installer among a release's files (update files and blockmaps are skipped). */
export function pickFromAssets(assets: readonly string[]): Partial<Record<DownloadKey, string>> {
  const files = assets.filter((a) => !/\.(blockmap|yml)$/i.test(a));
  const find = (test: (a: string) => boolean) => files.find(test);
  const picked: Partial<Record<DownloadKey, string>> = {
    windows: find((a) => /\.exe$/i.test(a)),
    'mac-arm64': find((a) => /arm64\.dmg$/i.test(a)),
    'mac-x64': find((a) => /\.dmg$/i.test(a) && !/arm64/i.test(a)),
    'linux-appimage': find((a) => /\.AppImage$/i.test(a) && !/arm64|aarch64/i.test(a)),
    'linux-deb': find((a) => /amd64\.deb$/i.test(a)),
  };
  for (const key of DOWNLOAD_KEYS) if (!picked[key]) delete picked[key];
  return picked;
}

export interface Release {
  tagName: string;
  assets: { name: string }[];
}

export interface Downloads {
  version: string;
  files: Record<DownloadKey, { name: string; url: string }>;
}

/**
 * The download for each system. Without a release, the names come from the config and the version in
 * package.json. With the newest release, its version and real file names win.
 */
export function resolveDownloads(opts: {
  version: string;
  config: BuilderConfig;
  name: string;
  release?: Release;
}): Downloads {
  const version = opts.release ? opts.release.tagName.replace(/^v/, '') : opts.version;
  const tag = opts.release ? opts.release.tagName : `v${version}`;
  const names = {
    ...installerNames(version, opts.config, opts.name),
    ...pickFromAssets(opts.release?.assets.map((a) => a.name) ?? []),
  };
  const files = {} as Downloads['files'];
  for (const key of DOWNLOAD_KEYS) {
    files[key] = {
      name: names[key],
      url: `https://github.com/${REPO}/releases/download/${tag}/${encodeURIComponent(names[key])}`,
    };
  }
  return { version, files };
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Writes the downloads into the page: `data-download="KEY" href="…"` gets the file's link,
 * `data-file="KEY">…<` its file name, and `data-version>…<` the version.
 */
export function injectDownloads(html: string, downloads: Downloads): string {
  const known = (key: string): key is DownloadKey => (DOWNLOAD_KEYS as readonly string[]).includes(key);
  return html
    .replace(/data-download="([\w-]+)"\s+href="[^"]*"/g, (whole, key: string) =>
      known(key) ? `data-download="${key}" href="${escapeHtml(downloads.files[key].url)}"` : whole,
    )
    .replace(/data-file="([\w-]+)">\s*[^<]*</g, (whole, key: string) =>
      known(key) ? `data-file="${key}">${escapeHtml(downloads.files[key].name)}<` : whole,
    )
    .replace(/data-version>\s*[^<]*</g, `data-version>${escapeHtml(downloads.version)}<`);
}
