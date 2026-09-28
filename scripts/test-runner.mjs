import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function findTests(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTests(full));
    } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      results.push(full);
    }
  }
  return results;
}

const tests = [...findTests('server'), ...findTests('src')];
// Running `tsx` through its CLI creates an IPC socket. Launch the Node test
// runner with tsx's loader instead so sandboxed/locked-down environments work.
const res = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...tests], { stdio: 'inherit' });
process.exit(res.status ?? 0);
