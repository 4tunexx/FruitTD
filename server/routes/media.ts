import { Router, type Request } from 'express';
import { ObjectId, type Binary, type Collection } from 'mongodb';
import { getCollection } from '../db';
import { resolveRequestUser } from '../auth';

const MAX_IMAGE_BYTES = 1_000_000;
const MAX_GIF_BYTES = 2_500_000;
const TYPES: Record<string, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

export function decodeSpriteImage(value: unknown): { contentType: string; bytes: Buffer } | null {
  if (typeof value !== 'string') return null;
  const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length > Math.ceil((match[1] === 'gif' ? MAX_GIF_BYTES : MAX_IMAGE_BYTES) / 3) * 4 + 4) return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > (match[1] === 'gif' ? MAX_GIF_BYTES : MAX_IMAGE_BYTES) || bytes.toString('base64') !== match[2]) return null;
  const type = match[1];
  const valid = type === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : type === 'jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9
    : type === 'webp' ? bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
    : ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString());
  return valid ? { contentType: TYPES[type], bytes } : null;
}

export function decodeSound(value:unknown):{contentType:string;bytes:Buffer}|null {
  if(typeof value!=='string')return null;
  const match=/^data:audio\/(wav|x-wav|wave|mpeg|mp3|ogg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if(!match||match[2].length>1_400_000)return null;
  const bytes=Buffer.from(match[2],'base64');if(!bytes.length||bytes.length>1_000_000||bytes.toString('base64')!==match[2])return null;
  const type=match[1];
  const valid=['wav','x-wav','wave'].includes(type)?bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WAVE'
    :type==='ogg'?bytes.subarray(0,4).toString()==='OggS':bytes.subarray(0,3).toString()==='ID3'||bytes[0]===255&&(bytes[1]&224)===224;
  return valid?{contentType:type==='ogg'?'audio/ogg':['mpeg','mp3'].includes(type)?'audio/mpeg':'audio/wav',bytes}:null;
}

type MediaDoc = { contentType: string; bytes: Buffer | Binary; createdAt: Date };

export interface MediaRouteDependencies {
 authorize:(req:Request)=>Promise<boolean>;
 collection:()=>Promise<Pick<Collection<MediaDoc>,'findOne'|'insertOne'>>;
}
export function createMediaRouters(dependencies:Partial<MediaRouteDependencies>={}){
 const mediaRouter=Router(),adminMediaRouter=Router();
 const authorize=dependencies.authorize??(async(req:Request)=>{const user=await resolveRequestUser(req);return Boolean(process.env.ADMIN_STEAM_ID&&user?.steamId===process.env.ADMIN_STEAM_ID);});
 const collection=dependencies.collection??(()=>getCollection<MediaDoc>('media_assets'));
adminMediaRouter.post('/', async (req, res) => {
  if (!(await authorize(req))) return res.status(403).json({ success: false, error: 'Admin access required.' });
  const image = req.body?.audio ? decodeSound(req.body.audio) : decodeSpriteImage(req.body?.image);
  if (!image) return res.status(400).json({ success: false, error: 'Upload an image or WAV, MP3 or OGG under 1 MB (GIF under 2.5 MB).' });
  try {
    const col = await collection();
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
    const col = await collection();
    const image = await col.findOne({ _id: new ObjectId(req.params.id) });
    if (!image || ![...Object.values(TYPES),'audio/wav','audio/mpeg','audio/ogg'].includes(image.contentType)) return res.status(404).end();
    res.set('Content-Type', image.contentType);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(Buffer.isBuffer(image.bytes) ? image.bytes : Buffer.from(image.bytes.buffer));
  } catch (error) {
    console.error('Media read failed:', error);
    return res.status(503).end();
  }
});

 return {mediaRouter,adminMediaRouter};
}
export const {mediaRouter,adminMediaRouter}=createMediaRouters();
