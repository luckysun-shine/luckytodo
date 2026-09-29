import crypto from 'node:crypto';

export function uuid() {
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const next = crypto.scryptSync(password, salt, 64).toString('hex');
  if (hash.length !== next.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(next, 'hex'));
}

export function sessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

export function readBody(req, limit = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function readJson(req) {
  const buf = await readBody(req, 2 * 1024 * 1024);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    const err = new Error('invalid json');
    err.status = 400;
    throw err;
  }
}

export function parseMultipart(buf, boundary) {
  const parts = [];
  const delim = Buffer.from(`--${boundary}`);
  let start = buf.indexOf(delim) + delim.length;
  while (start < buf.length) {
    if (buf[start] === 45 && buf[start + 1] === 45) break; // --
    if (buf[start] === 13 && buf[start + 1] === 10) start += 2;
    const headerEnd = buf.indexOf('\r\n\r\n', start);
    if (headerEnd < 0) break;
    const headers = buf.slice(start, headerEnd).toString('utf8');
    const next = buf.indexOf(delim, headerEnd);
    let end = next > 0 ? next - 2 : buf.length; // strip \r\n
    const content = buf.slice(headerEnd + 4, end);
    const nameMatch = /name="([^"]+)"/.exec(headers);
    const fileMatch = /filename="([^"]*)"/.exec(headers);
    const typeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(headers);
    parts.push({
      name: nameMatch?.[1] || '',
      filename: fileMatch?.[1] || null,
      mimeType: typeMatch?.[1]?.trim() || 'application/octet-stream',
      data: content,
    });
    start = next + delim.length;
  }
  return parts;
}

export const ROLES = ['admin', 'parent', 'adult', 'child'];

export function canSeeEntity(viewer, entity) {
  if (!entity || entity.deleted_at) return false;
  const p = typeof entity.payload === 'string' ? JSON.parse(entity.payload) : entity.payload;
  const type = entity.entity_type;

  if (viewer.role === 'admin' || viewer.role === 'parent') {
    // parents/admins see family shared + own + child plans they supervise
  }

  if (type === 'note') {
    if (p.visibility === 'family') {
      return viewer.role !== 'child';
    }
    if (p.visibility === 'self') {
      return p.createdBy === viewer.id || (viewer.role === 'admin' && false);
    }
    if (p.visibility === 'members') {
      return p.createdBy === viewer.id || (p.memberIds || []).includes(viewer.id);
    }
  }

  if (type === 'todo') {
    const assignees = p.assigneeIds || [];
    if (assignees.includes(viewer.id) || p.createdBy === viewer.id) return true;
    if (viewer.role === 'child') return false;
    // parent can see child's todos they created? PRD: parent cannot open child's private todos
    return viewer.role === 'admin' && p.createdBy === viewer.id;
  }

  if (type === 'event') {
    const participants = p.participantIds || [];
    if (participants.includes(viewer.id) || p.createdBy === viewer.id) return true;
    return viewer.role !== 'child' && participants.some(() => false);
  }

  if (type === 'plan') {
    const executors = p.executorIds || [];
    if (executors.includes(viewer.id) || p.createdBy === viewer.id) return true;
    if (viewer.role === 'parent' || viewer.role === 'admin') {
      // supervise child executors — need child membership check done by caller with member map
      return true; // filtered later with member roles
    }
    return false;
  }

  if (type === 'checkin') {
    if (p.memberId === viewer.id) return true;
    if (viewer.role === 'parent' || viewer.role === 'admin') return true;
    return false;
  }

  if (type === 'attachment_meta') {
    return true; // filtered by parent visibility at pull time
  }

  return p.createdBy === viewer.id;
}
