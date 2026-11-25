import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { supabaseStorage } from '../services/supabaseStorage.js';
// Deux modes : Supabase Storage (production sur Vercel : dépôt direct du navigateur) ou disque privé (développement / serveur unique).
export const remote = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? supabaseStorage({ url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY, bucket: env.SUPABASE_BUCKET }) : null;
export const isRemote = !!remote;
const DIR = path.resolve(env.STORAGE_DIR, 'submissions');
const KEY_RE = /^[0-9a-f-]{36}\.[a-z0-9]{2,5}$/;
export const validKey = (k) => KEY_RE.test(String(k));
export async function saveFile(buf, ext) {
  await fs.mkdir(DIR, { recursive: true });
  const key = `${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(path.join(DIR, key), buf, { mode: 0o600 });
  return key;
}
export const openFile = (key) => (KEY_RE.test(key) ? createReadStream(path.join(DIR, key)) : null);
const mac = (key, exp) => crypto.createHmac('sha256', env.FILE_SIGNING_SECRET).update(`${key}.${exp}`).digest('hex');
/** URL signée à durée limitée (10 min), identique dans les deux modes : /api/files/:key?exp&sig. */
export const signedUrl = (key, ttl = 600) => { const exp = Math.floor(Date.now() / 1000) + ttl; return `/api/files/${key}?exp=${exp}&sig=${mac(key, exp)}`; };
export function verifySigned(key, exp, sig) {
  if (!KEY_RE.test(key) || !exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const a = Buffer.from(mac(key, exp)), b = Buffer.from(String(sig));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
