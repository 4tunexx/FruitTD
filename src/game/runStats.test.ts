import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recordRun, runHistory, type RunRecord } from './runStats';
test('run history records each match once, retains mode and accuracy, and bounds storage', () => {
  let stored = '';
  (globalThis as any).localStorage = { getItem: () => stored, setItem: (_: string, value: string) => { stored = value; } };
  const row: RunRecord = { id:'run-1', mode:'horde', score:50, wave:3, combo:2, kills:4, strokes:5, hits:3, completed:true, date:1234 };
  recordRun(row); recordRun(row); assert.equal(runHistory().length, 1); assert.equal(runHistory()[0].hits / runHistory()[0].strokes, .6);
  for (let index=0; index<105; index++) recordRun({...row,id:`later-${index}`,mode:'casual'});
  assert.equal(runHistory().length,100); assert.equal(runHistory()[99].id,'later-104');
  stored='broken'; assert.deepEqual(runHistory(),[]);
  stored=JSON.stringify([{...row,score:-1},{...row,mode:'invalid'},row]); assert.deepEqual(runHistory(),[row]);
});
