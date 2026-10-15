import { Router } from 'express';
import { ObjectId, type Binary } from 'mongodb';
import { getCollection } from '../db';
import { resolveRequestUser } from '../auth';

export const mediaRouter = Router();
export const adminMediaRouter = Router();
const MAX_IMAGE_BYTES = 1_000_000;
const TYPES: Record<string, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };

export function decodeSpriteImage(value: unknown): { contentType: string; bytes: Buffer } | null {
  if (typeof value !== 'string') return null;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 4) return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== match[2]) return null;
  const type = match[1];
  const valid = type === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : type === 'jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9
    : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  return valid ? { contentType: TYPES[type], bytes } : null;
}

type MediaDoc = { contentType: string; bytes: Buffer | Binary; createdAt: Date };

adminMediaRouter.post('/', async (req, res) => {
  const user = await resolveRequestUser(req);
  if (!process.env.ADMIN_STEAM_ID || user?.steamId !== process.env.ADMIN_STEAM_ID) return res.status(403).json({ success: false, error: 'Admin access required.' });
  const image = decodeSpriteImage(req.body?.image);
  if (!image) return res.status(400).json({ success: false, error: 'Upload a PNG, JPEG or WebP image under 1 MB.' });
  try {
    const col = await getCollection<MediaDoc>('media_assets');
    const result = await col.insertOne({ contentType: image.contentType, bytes: image.bytes, createdAt: new Date() });
    return res.json({ success: true, url: `/api/media/${result.insertedId.toHexString()}` });
  } catch (error) {
    console.error('Media upload failed:', error);
    return res.status(503).json({ success: false, error: 'Media storage is unavailable.' });
  }
});

mediaRouter.get('/:id', async (req, res) => {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).end();
  try {
    const col = await getCollection<MediaDoc>('media_assets');
    const image = await col.findOne({ _id: new ObjectId(req.params.id) });
    if (!image || !Object.values(TYPES).includes(image.contentType)) return res.status(404).end();
    res.set('Content-Type', image.contentType);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(Buffer.isBuffer(image.bytes) ? image.bytes : Buffer.from(image.bytes.buffer));
  } catch (error) {
    console.error('Media read failed:', error);
    return res.status(503).end();
  }
});
