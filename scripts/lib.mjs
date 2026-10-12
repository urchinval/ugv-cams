// Shared helpers for build scripts (plain Node, no TS step needed).
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function readJson(rel) {
  return JSON.parse(await readFile(join(ROOT, rel), 'utf8'));
}

export async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export async function download(url, dest) {
  console.log(`  GET ${url}`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status} ${url}`);
  await mkdir(dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  return dest;
}

/** Newest vN.x from the official index (CI has internet; pin a version to skip this). */
export async function resolveNodeVersion(spec) {
  const m = /^latest-(\d+)$/.exec(spec);
  if (!m) return spec;
  const res = await fetch('https://nodejs.org/dist/index.json');
  if (!res.ok) throw new Error(`nodejs.org index: HTTP ${res.status}`);
  const list = await res.json();
  const hit = list.find((r) => r.version.startsWith(`v${m[1]}.`) && r.files.includes('win-x64-zip'));
  if (!hit) throw new Error(`No Node ${m[1]}.x with a win-x64 zip`);
  return hit.version.slice(1);
}

export async function clean(dir) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}
