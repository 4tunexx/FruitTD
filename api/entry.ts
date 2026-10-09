import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../server/app';

const app = createApp();

export function normalizeApiUrl(req: Pick<IncomingMessage, 'url'>): void {
  const raw = req.url || '/';
  // Vercel can supply an absolute-form request target for rewritten requests.
  // Express's legacy parseurl fast path calls deprecated url.parse() for those;
  // normalize to an origin-form path before Express sees it.
  const requestTarget = raw.startsWith('/') ? raw : (() => {
    try {
      const parsed = new URL(raw, 'https://fruit-td.invalid');
      return `${parsed.pathname}${parsed.search}`;
    } catch {
      return '/';
    }
  })();
  const qIndex = requestTarget.indexOf('?');
  const pathOnly = qIndex >= 0 ? requestTarget.slice(0, qIndex) : requestTarget;
  const query = qIndex >= 0 ? requestTarget.slice(qIndex) : '';

  if (pathOnly === '/api' || pathOnly.startsWith('/api/')) return;

  const nextPath = pathOnly.startsWith('/') ? `/api${pathOnly}` : `/api/${pathOnly}`;
  req.url = `${nextPath}${query}`;
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  normalizeApiUrl(req);
  return app(req, res);
}
