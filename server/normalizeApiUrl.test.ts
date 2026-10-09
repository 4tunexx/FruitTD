import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeApiUrl } from '../api/entry';

test('normalizes an absolute Vercel rewrite target before Express parses it', () => {
  const request = { url: 'https://fruit-td.vercel.app/auth/me?next=%2Fhub' };
  normalizeApiUrl(request);
  assert.equal(request.url, '/api/auth/me?next=%2Fhub');
});

test('keeps an existing API request path and query unchanged', () => {
  const request = { url: '/api/auth/me?next=%2Fhub' };
  normalizeApiUrl(request);
  assert.equal(request.url, '/api/auth/me?next=%2Fhub');
});
