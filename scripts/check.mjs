import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = path.join(projectRoot, 'dist');

async function readDistFile(relativePath) {
  return readFile(path.join(distDirectory, relativePath));
}

const [indexBuffer, appBuffer, stylesheetBuffer, serviceWorkerBuffer, manifestBuffer] = await Promise.all([
  readDistFile('index.html'),
  readDistFile('app.js'),
  readDistFile('style.css'),
  readDistFile('sw.js'),
  readDistFile('manifest.webmanifest'),
]);

const index = indexBuffer.toString('utf8');
const serviceWorker = serviceWorkerBuffer.toString('utf8');
const manifest = JSON.parse(manifestBuffer.toString('utf8'));

assert.ok(appBuffer.length > 0, 'dist/app.js must not be empty');
assert.ok(stylesheetBuffer.length > 0, 'dist/style.css must not be empty');
assert.match(index, /<title>ptimer<\/title>/, 'The document title must be ptimer');
assert.match(index, /href="manifest\.webmanifest"/, 'index.html must link the web app manifest');
const appAsset = index.match(/src="(app\.js(?:\?[^\"]*)?)"/)?.[1];
const stylesheetAsset = index.match(/href="(style\.css(?:\?[^\"]*)?)"/)?.[1];
assert.ok(appAsset, 'index.html must load app.js');
assert.ok(stylesheetAsset, 'index.html must load style.css');

assert.equal(manifest.name, 'ptimer');
assert.equal(manifest.short_name, 'ptimer');
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.equal(manifest.display, 'standalone');
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'The manifest must include icons');

for (const icon of manifest.icons) {
  const iconPath = icon.src.split('?')[0];
  const png = await readDistFile(iconPath);
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG', `${iconPath} must be a PNG`);

  const [expectedWidth, expectedHeight] = icon.sizes.split('x').map(Number);
  assert.equal(png.readUInt32BE(16), expectedWidth, `${iconPath} has the wrong width`);
  assert.equal(png.readUInt32BE(20), expectedHeight, `${iconPath} has the wrong height`);
}

const cachedAssets = [
  './',
  './index.html',
  `./${stylesheetAsset}`,
  `./${appAsset}`,
  './manifest.webmanifest',
  ...manifest.icons.map((icon) => `./${icon.src}`),
  './icons/apple-touch-icon.png?v=6',
];

for (const asset of cachedAssets) {
  assert.ok(serviceWorker.includes(`'${asset}'`), `${asset} must be included in the offline cache`);
}

assert.match(serviceWorker, /CACHE_NAME = `\$\{CACHE_PREFIX\}v\d+`/, 'The service worker needs a versioned cache');

console.log('ptimer checks passed');
