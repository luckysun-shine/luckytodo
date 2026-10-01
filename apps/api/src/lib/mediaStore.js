import fs from 'node:fs';
import path from 'node:path';
import { MEDIA_DIR } from './db.js';

/**
 * Local media by default. When LUCKYTODO_OBJECT_STORE=s3-compatible is set,
 * callers should upload via signed URL flow (S2). This module keeps a single
 * writeMedia/readMedia API so the HTTP layer does not branch everywhere.
 */
const MODE = process.env.LUCKYTODO_OBJECT_STORE || 'local';

export function mediaMode() {
  return MODE;
}

export function writeMedia(relPath, buffer) {
  if (MODE !== 'local') {
    // Placeholder: write locally and log intent for object store sync workers.
    console.warn(`[media] OBJECT_STORE=${MODE} not fully wired; writing local mirror ${relPath}`);
  }
  const abs = path.join(MEDIA_DIR, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buffer);
  return { storage: MODE === 'local' ? 'local' : 'local-mirror', path: relPath };
}

export function readMedia(relPath) {
  const abs = path.join(MEDIA_DIR, relPath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs);
}

export function deleteMedia(relPath) {
  try {
    fs.unlinkSync(path.join(MEDIA_DIR, relPath));
  } catch {
    /* ignore */
  }
}
