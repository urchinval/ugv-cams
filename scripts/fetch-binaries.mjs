// Downloads the pinned Windows binaries into bin/ (mediamtx.exe, ffmpeg.exe) and
// .cache/runtime/node.exe for packaging. Run on any OS; CI runs it on ubuntu.
//
//   node scripts/fetch-binaries.mjs            all three
//   node scripts/fetch-binaries.mjs --no-ffmpeg
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import AdmZip from 'adm-zip';
import { ROOT, clean, download, exists, readJson, resolveNodeVersion } from './lib.mjs';

const args = new Set(process.argv.slice(2));
const versions = await readJson('scripts/versions.json');
const CACHE = join(ROOT, '.cache');
const BIN = join(ROOT, 'bin');

/** Extract the single file named `entry` from anywhere inside the archive. */
function extractEntry(zipPath, entry, destDir) {
  const zip = new AdmZip(zipPath);
  const hit = zip
    .getEntries()
    .find((e) => !e.isDirectory && basename(e.entryName).toLowerCase() === entry.toLowerCase());
  if (!hit) throw new Error(`${entry} not found in ${zipPath}`);
  zip.extractEntryTo(hit, destDir, false, true);
  return join(destDir, entry);
}

async function fetchOne(name, { url, entry }, destDir, version) {
  const finalUrl = version ? url.replaceAll('{version}', version) : url;
  console.log(`${name}${version ? ` ${version}` : ''}`);
  const zipPath = join(CACHE, 'downloads', basename(new URL(finalUrl).pathname));
  if (!(await exists(zipPath))) await download(finalUrl, zipPath);
  else console.log(`  cached ${zipPath}`);
  const out = extractEntry(zipPath, entry, destDir);
  console.log(`  -> ${out}`);
  return { name, version: version ?? null, url: finalUrl };
}

await mkdir(join(CACHE, 'downloads'), { recursive: true });
await mkdir(BIN, { recursive: true });
const runtimeDir = join(CACHE, 'runtime');
await clean(runtimeDir);

const manifest = [];
manifest.push(await fetchOne('mediamtx', versions.mediamtx, BIN, versions.mediamtx.version));
if (!args.has('--no-ffmpeg'))
  manifest.push(await fetchOne('ffmpeg', versions.ffmpeg, BIN, versions.ffmpeg.version));
const nodeVersion = await resolveNodeVersion(versions.node.version);
manifest.push(await fetchOne('node', versions.node, runtimeDir, nodeVersion));

// what exactly went into the build — copied into the release zip by package.mjs
await writeFile(join(CACHE, 'binaries.json'), JSON.stringify(manifest, null, 2));
console.log('done');
