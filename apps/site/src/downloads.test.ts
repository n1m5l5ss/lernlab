import { test } from 'node:test';
import assert from 'node:assert/strict';
import desktop from '../../desktop/package.json';
import {
  DOWNLOAD_KEYS,
  expandArtifactName,
  injectDownloads,
  installerNames,
  pickFromAssets,
  resolveDownloads,
  type BuilderConfig,
} from './downloads';

const config = desktop.build as BuilderConfig;

test('the download names follow the installer names in docs/RELEASING.md', () => {
  assert.deepEqual(installerNames('1.2.3', config, desktop.name), {
    windows: 'LernLab-Setup-1.2.3.exe',
    'mac-arm64': 'LernLab-1.2.3-arm64.dmg',
    'mac-x64': 'LernLab-1.2.3-x64.dmg',
    'linux-appimage': 'LernLab-1.2.3.AppImage',
    'linux-deb': 'lernlab_1.2.3_amd64.deb',
  });
});

test('every download name matches the artifactName in the electron-builder config', () => {
  const names = installerNames('2.0.0', config, desktop.name);
  const vars = { productName: config.productName, version: '2.0.0' };
  assert.equal(names.windows, expandArtifactName(config.nsis!.artifactName!, { ...vars, ext: 'exe' }));
  for (const arch of ['arm64', 'x64'] as const) {
    assert.equal(names[`mac-${arch}`], expandArtifactName(config.mac!.artifactName!, { ...vars, arch, ext: 'dmg' }));
  }
  // The Linux names are electron-builder's defaults; a new artifactName would be picked up too.
  const custom = installerNames(
    '2.0.0',
    { ...config, linux: { artifactName: '${productName}-${version}.${ext}' } },
    'x',
  );
  assert.equal(custom['linux-appimage'], 'LernLab-2.0.0.AppImage');
  assert.equal(custom['linux-deb'], 'LernLab-2.0.0.deb');
});

test("electron-builder's default Windows name becomes dots on GitHub", () => {
  const names = installerNames('0.3.0', { productName: 'LernLab' }, 'lernlab');
  assert.equal(names.windows, 'LernLab.Setup.0.3.0.exe');
});

test('picks each installer from a release, skipping update files', () => {
  // The real v0.3.0 release, built before the file names were set.
  const assets = [
    'latest-linux.yml',
    'latest-mac.yml',
    'latest.yml',
    'LernLab-0.3.0-arm64.dmg',
    'LernLab-0.3.0-arm64.dmg.blockmap',
    'LernLab-0.3.0.AppImage',
    'LernLab-0.3.0.dmg',
    'LernLab-0.3.0.dmg.blockmap',
    'LernLab.Setup.0.3.0.exe',
    'LernLab.Setup.0.3.0.exe.blockmap',
    'lernlab_0.3.0_amd64.deb',
  ];
  assert.deepEqual(pickFromAssets(assets), {
    windows: 'LernLab.Setup.0.3.0.exe',
    'mac-arm64': 'LernLab-0.3.0-arm64.dmg',
    'mac-x64': 'LernLab-0.3.0.dmg',
    'linux-appimage': 'LernLab-0.3.0.AppImage',
    'linux-deb': 'lernlab_0.3.0_amd64.deb',
  });
  assert.deepEqual(pickFromAssets(['LernLab-1.0.0-x64.dmg', 'LernLab-1.0.0-arm64.dmg']), {
    'mac-arm64': 'LernLab-1.0.0-arm64.dmg',
    'mac-x64': 'LernLab-1.0.0-x64.dmg',
  });
});

test('links point at the release on GitHub; the release wins over package.json', () => {
  const fromConfig = resolveDownloads({ version: '1.0.0', config, name: desktop.name });
  assert.equal(fromConfig.version, '1.0.0');
  assert.equal(
    fromConfig.files.windows.url,
    'https://github.com/n1m5l5ss/lernlab/releases/download/v1.0.0/LernLab-Setup-1.0.0.exe',
  );

  const release = { tagName: 'v1.1.0', assets: [{ name: 'LernLab.Setup.1.1.0.exe' }] };
  const fromRelease = resolveDownloads({ version: '1.0.0', config, name: desktop.name, release });
  assert.equal(fromRelease.version, '1.1.0');
  assert.equal(fromRelease.files.windows.name, 'LernLab.Setup.1.1.0.exe');
  // A file missing from the release falls back to the configured name for that version.
  assert.equal(fromRelease.files['linux-deb'].name, 'lernlab_1.1.0_amd64.deb');
  for (const key of DOWNLOAD_KEYS) assert.match(fromRelease.files[key].url, /\/releases\/download\/v1\.1\.0\//);
});

test('writes the links, file names and version into the page', () => {
  const downloads = resolveDownloads({ version: '1.0.0', config, name: desktop.name });
  const html = injectDownloads(
    `<a class="btn" data-download="mac-x64"
        href="https://github.com/n1m5l5ss/lernlab/releases/latest">Intel</a>
     <code data-file="mac-x64">LernLab.dmg</code> <span data-version>latest</span>
     <a data-download="unknown" href="#keep">?</a>`,
    downloads,
  );
  assert.match(
    html,
    /href="https:\/\/github\.com\/n1m5l5ss\/lernlab\/releases\/download\/v1\.0\.0\/LernLab-1\.0\.0-x64\.dmg"/,
  );
  assert.match(html, /data-file="mac-x64">LernLab-1\.0\.0-x64\.dmg</);
  assert.match(html, /data-version>1\.0\.0</);
  assert.match(html, /href="#keep"/);
});
