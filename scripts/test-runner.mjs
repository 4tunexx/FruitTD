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
// Bound Windows worker fan-out: launching one loader process per CPU caused
// intermittent native access violations before test assertions could run.
const concurrency = process.platform === 'win32' ? ['--test-concurrency=4'] : [];
const res = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...concurrency, ...tests], { stdio: 'inherit' });
// A worker launch error or signal termination must never be reported as a pass.
if (res.error) console.error('Could not start the test runner:', res.error.message);
process.exit(res.status ?? 1);
