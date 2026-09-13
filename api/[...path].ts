import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../server/app';

const app = createApp();

/**
 * Vercel catch-all may pass `/steam/login` (without `/api`) or the full `/api/...` path.
 * Normalize so Express routes under `/api/*` always match.
 */
function normalizeApiUrl(req: IncomingMessage): void {
  const raw = req.url || '/';
  const qIndex = raw.indexOf('?');
  const pathOnly = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const query = qIndex >= 0 ? raw.slice(qIndex) : '';

  if (pathOnly === '/api' || pathOnly.startsWith('/api/')) return;

  // `/steam/login` → `/api/steam/login`
  const nextPath = pathOnly.startsWith('/') ? `/api${pathOnly}` : `/api/${pathOnly}`;
  req.url = `${nextPath}${query}`;
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  normalizeApiUrl(req);
  return app(req, res);
}
