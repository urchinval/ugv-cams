import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Write via temp file + rename so readers (incl. MediaMTX's config watcher) never see a partial file. */
export async function writeFileAtomic(file: string, data: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, data, 'utf8');
  await rename(tmp, file);
}

export async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await writeFileAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

/** Returns undefined if the file does not exist; throws on other errors / invalid JSON. */
export async function readJson(file: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw err;
  }
}
