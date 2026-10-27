import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankedPenaltyMinutes } from './rankedPenalty';

test('Ranked abandonment escalates after the third match and caps at one day', () => {
  assert.deepEqual([1,2,3,4,5,8].map(rankedPenaltyMinutes), [20,20,60,120,240,1440]);
});
