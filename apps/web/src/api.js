import * as db from './db.js';

const MAX_BYTES = 20 * 1024 * 1024;

export function apiBase() {
  const saved = localStorage.getItem('lt_server');
  if (saved) return saved;
  if (typeof location !== 'undefined' && location.origin && !location.origin.startsWith('file:')) {
    return location.origin;
  }
  return '';
}

export function setApiBase(url) {
  const cleaned = String(url || '').trim().replace(/\/$/, '');
  localStorage.setItem('lt_server', cleaned);
}

export function getToken() {
  return localStorage.getItem('lt_token') || '';
}

export function setSession(session) {
  if (!session) {
    localStorage.removeItem('lt_token');
    localStorage.removeItem('lt_member');
    localStorage.removeItem('lt_family');
    return;
  }
  localStorage.setItem('lt_token', session.token);
  localStorage.setItem('lt_member', JSON.stringify(session.member));
  localStorage.setItem('lt_family', JSON.stringify(session.family));
}

export function getMember() {
  try {
    return JSON.parse(localStorage.getItem('lt_member') || 'null');
  } catch {
    return null;
  }
}

export function getFamily() {
  try {
    return JSON.parse(localStorage.getItem('lt_family') || 'null');
  } catch {
    return null;
  }
}

export async function api(method, path, { body, token, raw } = {}) {
  const base = apiBase();
  if (!base) throw Object.assign(new Error('未配置服务器'), { offline: true });
  const headers = {};
  const t = token ?? getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`${base}${path}`, { method, headers, body: payload });
  } catch (e) {
    throw Object.assign(new Error('网络不可用'), { offline: true, cause: e });
  }
  if (raw) return res;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(json.error || `请求失败 ${res.status}`), {
      status: res.status,
      json,
    });
  }
  return json;
}

export async function health() {
  return api('GET', '/api/health', { token: '' });
}

export async function saveLocalEntity(entityType, payload, { id, deletedAt } = {}) {
  const entityId = id || db.uuid();
  const updatedAt = db.nowIso();
  const member = getMember();
  const entity = {
    id: entityId,
    entityType,
    payload: {
      ...payload,
      createdBy: payload.createdBy || member?.id || 'guest',
    },
    updatedAt,
    revision: 0,
    deletedAt: deletedAt || null,
    syncStatus: getToken() ? 'pending' : 'localOnly',
    guest: !getToken(),
  };
  await db.putEntity(entity);
  const opId = db.uuid();
  await db.enqueue({
    opId,
    id: entityId,
    entityType,
    payload: entity.payload,
    updatedAt,
    deletedAt: entity.deletedAt,
    attempts: 0,
    createdAt: updatedAt,
  });
  return entity;
}

export async function syncNow() {
  if (!getToken()) return { skipped: true, reason: 'not logged in' };
  const queue = await db.listQueue();
  let pushResult = null;
  if (queue.length) {
    pushResult = await api('POST', '/api/sync/push', {
      body: { ops: queue.map(({ attempts, createdAt, ...op }) => op) },
    });
    for (const r of pushResult.results || []) {
      if (r.ok) {
        await db.dequeue(r.opId);
        const ent = await db.getEntity(r.id);
        if (ent) {
          ent.revision = r.revision;
          ent.updatedAt = r.updatedAt;
          ent.syncStatus = 'synced';
          await db.putEntity(ent);
        }
      } else if (r.conflict && r.entity) {
        await db.dequeue(r.opId);
        await db.putEntity({ ...r.entity, syncStatus: 'synced', guest: false });
      }
    }
  }

  const since = Number((await db.kvGet('serverRevision', 0)) || 0);
  const pull = await api('GET', `/api/sync/pull?since=${since}`);
  for (const e of pull.entities || []) {
    await db.putEntity({ ...e, syncStatus: 'synced', guest: false });
  }
  if (pull.members) await db.kvSet('members', pull.members);
  await db.kvSet('serverRevision', pull.serverRevision || since);
  await db.kvSet('lastSyncAt', db.nowIso());
  return { pushResult, pullCount: (pull.entities || []).length, serverRevision: pull.serverRevision };
}

export async function mergeGuestData() {
  const all = await db.allEntities();
  const member = getMember();
  const guests = all.filter((e) => e.guest || e.syncStatus === 'localOnly');
  for (const e of guests) {
    e.guest = false;
    e.payload = { ...e.payload, createdBy: e.payload.createdBy === 'guest' ? member.id : e.payload.createdBy };
    e.syncStatus = 'pending';
    e.updatedAt = db.nowIso();
    await db.putEntity(e);
    await db.enqueue({
      opId: db.uuid(),
      id: e.id,
      entityType: e.entityType,
      payload: e.payload,
      updatedAt: e.updatedAt,
      deletedAt: e.deletedAt,
      attempts: 0,
      createdAt: e.updatedAt,
    });
  }
  return guests.length;
}

export async function clearGuestData() {
  const all = await db.allEntities();
  for (const e of all.filter((x) => x.guest || x.syncStatus === 'localOnly')) {
    await db.putEntity({ ...e, deletedAt: db.nowIso(), syncStatus: 'localOnly' });
  }
  // also wipe guest entities entirely
  for (const e of all.filter((x) => x.guest || x.payload?.createdBy === 'guest')) {
    await txDelete(e.id);
  }
}

async function txDelete(id) {
  const database = await new Promise((resolve, reject) => {
    const req = indexedDB.open('luckytodo-v1', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await new Promise((resolve, reject) => {
    const t = database.transaction(['entities', 'queue'], 'readwrite');
    t.objectStore('entities').delete(id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function countGuestRecords() {
  const all = await db.allEntities();
  const guests = all.filter((e) => !e.deletedAt && (e.guest || e.syncStatus === 'localOnly'));
  return guests.length;
}

export function validateAttachment(file) {
  if (!file) return '未选择文件';
  if (file.size > MAX_BYTES) return '文件超过 20MB';
  return null;
}

export async function uploadMedia(file, { purpose = 'attachment', parentType, parentId, memberId } = {}) {
  const err = validateAttachment(file);
  if (err) throw new Error(err);
  const localId = db.uuid();
  await db.putBlob(localId, file, { fileName: file.name, mimeType: file.type, size: file.size });
  if (!getToken() || !navigator.onLine) {
    return { id: localId, pending: true, fileName: file.name, mimeType: file.type, size: file.size };
  }
  const fd = new FormData();
  fd.append('file', file, file.name);
  fd.append('purpose', purpose);
  if (parentType) fd.append('parentType', parentType);
  if (parentId) fd.append('parentId', parentId);
  if (memberId) fd.append('memberId', memberId);
  fd.append('mediaId', localId);
  const res = await api('POST', '/api/media/upload', { body: fd });
  return res.media;
}

export { db, MAX_BYTES };
