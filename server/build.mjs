// Bundles the server (+ @ugv/shared + deps) into a single CommonJS file
// that runs on the portable node.exe shipped in the release zip.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/server.cjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: 'linked',
  legalComments: 'none',
  define: { __APP_VERSION__: JSON.stringify(version) },
  logLevel: 'info',
});
