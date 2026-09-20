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
const isWin = process.platform === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';
const res = spawnSync(npxCmd, ['tsx', '--test', ...tests], { stdio: 'inherit', shell: isWin });
process.exit(res.status ?? 0);
