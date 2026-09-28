import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliverVerifyCode } from './auth';

test('verification previews are available in development and withheld in production', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousApiKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;

  try {
    process.env.NODE_ENV = 'development';
    assert.deepEqual(await deliverVerifyCode('new@example.com', '123456'), {
      previewCode: '123456',
      emailed: false,
    });

    process.env.NODE_ENV = 'production';
    assert.deepEqual(await deliverVerifyCode('new@example.com', '654321'), {
      emailed: false,
      error: 'Email delivery is not configured.',
    });
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousApiKey;
  }
});

test('production email failures do not log verification response content', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousApiKey = process.env.RESEND_API_KEY;
  const previousFetch = globalThis.fetch;
  const previousError = console.error;
  const code = '839201';
  const logged: unknown[][] = [];
  process.env.NODE_ENV = 'production';
  process.env.RESEND_API_KEY = 'test-key';
  globalThis.fetch = async () => new Response(`rejected ${code}`, { status: 500 });
  console.error = (...args: unknown[]) => { logged.push(args); };

  try {
    const result = await deliverVerifyCode('new@example.com', code);
    assert.equal(result.previewCode, undefined);
    assert.equal(JSON.stringify(logged).includes(code), false);
  } finally {
    globalThis.fetch = previousFetch;
    console.error = previousError;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousApiKey;
  }
});
