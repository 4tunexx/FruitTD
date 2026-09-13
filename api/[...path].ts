import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../server/app';

const app = createApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url || '/';
  if (!url.startsWith('/api')) {
    req.url = `/api${url.startsWith('/') ? url : `/${url}`}`;
  }
  app(req, res);
}
