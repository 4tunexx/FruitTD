import * as esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('api', { recursive: true });

await esbuild.build({
  entryPoints: ['api/entry.ts'],
  outfile: 'api/[...path].js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  // package.json has "type": "module" — emit ESM so Vercel can load the function
  format: 'esm',
  packages: 'external',
  logLevel: 'info',
  banner: {
    js: '// Bundled Fruit TD API for Vercel\n',
  },
});

console.log('Bundled Vercel API → api/[...path].js');
