// Assembles the Windows release zip from build outputs + fetched binaries.
// Prereqs: npm run build && npm run fetch-binaries
//
// release/ugv-cams-v<version>-win-x64.zip
//   ugv-cams/
//     ugv-cams.cmd
//     runtime/node.exe
//     app/server.cjs, app/web/...
//     bin/mediamtx.exe, bin/ffmpeg.exe
//     ІНСТРУКЦІЯ.txt, binaries.json
import { cp, copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { ROOT, clean, exists, readJson } from './lib.mjs';

const { version } = await readJson('package.json');
const OUT = join(ROOT, 'release');
const STAGE = join(OUT, 'ugv-cams');

const required = {
  'server bundle': join(ROOT, 'server', 'dist', 'server.cjs'),
  'web build': join(ROOT, 'web', 'dist', 'index.html'),
  'mediamtx.exe': join(ROOT, 'bin', 'mediamtx.exe'),
  'node.exe': join(ROOT, '.cache', 'runtime', 'node.exe'),
};
for (const [what, p] of Object.entries(required)) {
  if (!(await exists(p))) {
    console.error(`Missing ${what}: ${p}\nRun "npm run build" and "npm run fetch-binaries" first.`);
    process.exit(1);
  }
}

await clean(OUT);
await mkdir(join(STAGE, 'app'), { recursive: true });
await mkdir(join(STAGE, 'runtime'), { recursive: true });
await mkdir(join(STAGE, 'bin'), { recursive: true });

await copyFile(required['server bundle'], join(STAGE, 'app', 'server.cjs'));
await cp(join(ROOT, 'web', 'dist'), join(STAGE, 'app', 'web'), { recursive: true });
await copyFile(required['node.exe'], join(STAGE, 'runtime', 'node.exe'));
await copyFile(required['mediamtx.exe'], join(STAGE, 'bin', 'mediamtx.exe'));
const ffmpeg = join(ROOT, 'bin', 'ffmpeg.exe');
if (await exists(ffmpeg)) await copyFile(ffmpeg, join(STAGE, 'bin', 'ffmpeg.exe'));
else console.warn('WARNING: ffmpeg.exe not bundled — transcoded cameras will need ffmpeg in PATH');
const manifest = join(ROOT, '.cache', 'binaries.json');
if (await exists(manifest)) await copyFile(manifest, join(STAGE, 'binaries.json'));

// CRLF: cmd.exe is happiest with Windows line endings
const crlf = (lines) => lines.join('\r\n') + '\r\n';

await writeFile(
  join(STAGE, 'ugv-cams.cmd'),
  crlf([
    '@echo off',
    'setlocal',
    'chcp 65001 >nul',
    'title ugv-cams',
    'cd /d "%~dp0"',
    '"%~dp0runtime\\node.exe" "%~dp0app\\server.cjs"',
    'if errorlevel 1 pause',
  ]),
);

await writeFile(
  join(STAGE, 'ІНСТРУКЦІЯ.txt'),
  crlf([
    `ugv-cams ${version}`,
    '',
    'Запуск: подвійний клік по ugv-cams.cmd. Відкриється браузер з камерами.',
    'Закрити: закрийте чорне вікно ugv-cams (MediaMTX зупиниться разом з ним).',
    '',
    'Оновлення: видаліть стару папку ugv-cams і розпакуйте нову.',
    'Моделі камер і розкладки зберігаються окремо, в %APPDATA%\\ugv-cams, і оновлення їх не зачіпає.',
    '',
    'Камери в QGC: rtsp://127.0.0.1:8554/<id камери>_sub (або _main, _third).',
  ]),
);

const zipName = `ugv-cams-v${version}-win-x64.zip`;
const zip = new AdmZip();
zip.addLocalFolder(STAGE, 'ugv-cams');
zip.writeZip(join(OUT, zipName));
console.log(`release/${zipName}`);
