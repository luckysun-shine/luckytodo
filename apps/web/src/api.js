import * as db from './db.js';

const MAX_BYTES = 20 * 1024 * 1024;

/** Official API base — no user-facing NAS URL. Override only via lt_server for advanced/dev. */
export function apiBase() {
  const override = (localStorage.getItem('lt_server') || '').replace(/\/$/, '');
  if (override) return override;
  if (typeof location !== 'undefined') {
    if (location.port === '5173' || location.protocol === 'file:') {
      return 'http://127.0.0.1:8787';
    }
    if (location.origin && location.origin !== 'null') {
      return location.origin.replace(/\/$/, '');
    }
  }
  return 'http://127.0.0.1:8787';
}

export function setApiBase(url) {
  const cleaned = String(url || '').trim().replace(/\/$/, '');
  if (!cleaned) localStorage.removeItem('lt_server');
  else localStorage.setItem('lt_server', cleaned);
}

export function clearApiBase() {
  localStorage.removeItem('lt_server');
}

export function getToken() {
  return localStorage.getItem('lt_token') || '';
}

/** Authenticated media URL for <img src> (token in query). */
export function mediaUrl(id, version) {
  if (!id) return '';
  const params = new URLSearchParams();
  const t = getToken();
  if (t) params.set('token', t);
  if (version) params.set('v', String(version));
  const q = params.toString();
  return `${apiBase()}/api/media/${encodeURIComponent(id)}${q ? `?${q}` : ''}`;
}

export function getMode() {
  if (getToken() && getFamily()?.id) return 'family';
  if (getToken()) return 'cloud';
  if (getMember()) return 'local';
  return null;
}

export function isFamilyMode() {
  return getMode() === 'family' && !!getToken();
}

export function isLoggedIn() {
  return !!getToken() || !!getMember();
}

export function isCloudLoggedIn() {
  return !!getToken() && !!getUser();
}

export function hasFamily() {
  return !!(getFamily()?.id && getMember()?.id && getToken());
}

export function setSession(session) {
  if (!session) {
    localStorage.removeItem('lt_token');
    localStorage.removeItem('lt_member');
    localStorage.removeItem('lt_family');
    localStorage.removeItem('lt_user');
    localStorage.removeItem('lt_mode');
    return;
  }
  localStorage.setItem('lt_token', session.token);
  if (session.user) localStorage.setItem('lt_user', JSON.stringify(session.user));
  if (session.member) {
    localStorage.setItem('lt_member', JSON.stringify(session.member));
  } else {
    localStorage.removeItem('lt_member');
  }
  if (session.family) {
    localStorage.setItem('lt_family', JSON.stringify(session.family));
    localStorage.setItem('lt_mode', 'family');
  } else {
    localStorage.removeItem('lt_family');
    localStorage.setItem('lt_mode', 'cloud');
  }
}

export function setLocalSession(member) {
  localStorage.setItem('lt_mode', 'local');
  localStorage.removeItem('lt_token');
  localStorage.setItem('lt_member', JSON.stringify(member));
  localStorage.setItem(
    'lt_family',
    JSON.stringify({ id: 'local', name: '本机空间', local: true })
  );
}

export function logout() {
  localStorage.removeItem('lt_token');
  localStorage.removeItem('lt_member');
  localStorage.removeItem('lt_family');
  localStorage.removeItem('lt_user');
  localStorage.removeItem('lt_mode');
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('lt_user') || 'null');
  } catch {
    return null;
  }
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

function readLocalAccounts() {
  try {
    return JSON.parse(localStorage.getItem('lt_local_accounts') || '[]');
  } catch {
    return [];
  }
}

function writeLocalAccounts(list) {
  localStorage.setItem('lt_local_accounts', JSON.stringify(list));
}

export function listLocalAccounts() {
  return readLocalAccounts().map(({ passwordHash, ...rest }) => rest);
}

export function hasLocalAccounts() {
  return readLocalAccounts().length > 0;
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(`luckytodo:${password}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createLocalAccount({ displayName, username, password }) {
  const name = String(displayName || '').trim();
  const user = String(username || '').trim().toLowerCase();
  const pass = String(password || '');
  if (name.length < 1 || name.length > 20) throw new Error('显示名需 1–20 字');
  if (!/^[a-z0-9]{3,20}$/.test(user)) throw new Error('用户名为 3–20 位小写字母或数字');
  if (pass.length < 6 || pass.length > 64) throw new Error('密码需 6–64 位');
  const accounts = readLocalAccounts();
  if (accounts.some((a) => a.username === user)) throw new Error('用户名已存在');
  const member = {
    id: db.uuid(),
    displayName: name,
    username: user,
    role: 'admin',
    local: true,
  };
  accounts.push({ ...member, passwordHash: await hashPassword(pass) });
  writeLocalAccounts(accounts);
  setLocalSession(member);
  await db.kvSet('members', [member]);
  return member;
}

export async function loginLocalAccount({ username, password }) {
  const user = String(username || '').trim().toLowerCase();
  const pass = String(password || '');
  const accounts = readLocalAccounts();
  const found = accounts.find((a) => a.username === user);
  if (!found) throw new Error('账号或密码不正确');
  const hash = await hashPassword(pass);
  if (hash !== found.passwordHash) throw new Error('账号或密码不正确');
  const member = {
    id: found.id,
    displayName: found.displayName,
    username: found.username,
    role: found.role || 'admin',
    local: true,
  };
  setLocalSession(member);
  await db.kvSet('members', [member]);
  return member;
}

export async function api(method, path, { body, token, raw } = {}) {
  const base = apiBase();
  const headers = {};
  const t = token === '' ? '' : token ?? getToken();
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

export async function register({ phone, password, displayName, agreed }) {
  const session = await api('POST', '/api/auth/register', {
    token: '',
    body: { phone, password, displayName, agreed, deviceName: 'web' },
  });
  setSession(session);
  return session;
}

export async function login({ phone, password, username }) {
  const session = await api('POST', '/api/auth/login', {
    token: '',
    body: { phone, password, username, deviceName: 'web' },
  });
  setSession(session);
  return session;
}

export async function changePassword({ currentPassword, password }) {
  return api('POST', '/api/auth/password/change', { body: { currentPassword, password } });
}

export async function requestPasswordReset(phone) {
  return api('POST', '/api/auth/password/forgot', { token: '', body: { phone } });
}

export async function confirmPasswordReset({ phone, code, password }) {
  return api('POST', '/api/auth/password/reset', { token: '', body: { phone, code, password } });
}

export async function resetMemberPassword(memberId, password) {
  return api('PATCH', `/api/members/${memberId}`, { body: { password } });
}

export async function otpSend(phone) {
  return api('POST', '/api/auth/otp/send', { token: '', body: { phone } });
}

export async function otpVerify({ phone, code, displayName, agreed }) {
  const session = await api('POST', '/api/auth/otp/verify', {
    token: '',
    body: { phone, code, displayName, agreed, deviceName: 'web' },
  });
  setSession(session);
  return session;
}

export async function createFamily(familyName) {
  const res = await api('POST', '/api/families', { body: { familyName } });
  const cur = {
    token: getToken(),
    user: getUser(),
    member: res.member,
    family: res.family,
    serverRevision: res.serverRevision,
  };
  setSession(cur);
  return res;
}

export async function createInvite(role = 'adult') {
  return api('POST', '/api/invites', { body: { role } });
}

export async function acceptInvite(code) {
  const res = await api('POST', '/api/invites/accept', { body: { code } });
  setSession({
    token: getToken(),
    user: getUser(),
    member: res.member,
    family: res.family,
    serverRevision: res.serverRevision,
  });
  return res;
}

export async function createChild({ displayName, password }) {
  return api('POST', '/api/members/child', { body: { displayName, password } });
}

export async function exportFamily() {
  return api('GET', '/api/families/export');
}

export async function deleteAccount() {
  await api('DELETE', '/api/auth/account');
  logout();
}

export async function registerPushToken(token, platform = 'web') {
  return api('POST', '/api/devices/push-token', { body: { token, platform } });
}

export async function fetchMe() {
  const me = await api('GET', '/api/me');
  if (me.user) localStorage.setItem('lt_user', JSON.stringify(me.user));
  if (me.member) localStorage.setItem('lt_member', JSON.stringify(me.member));
  else localStorage.removeItem('lt_member');
  if (me.family) {
    localStorage.setItem('lt_family', JSON.stringify(me.family));
    localStorage.setItem('lt_mode', 'family');
  } else {
    localStorage.removeItem('lt_family');
    localStorage.setItem('lt_mode', 'cloud');
  }
  if (me.members) await db.kvSet('members', me.members);
  return me;
}

export async function saveLocalEntity(entityType, payload, { id, deletedAt } = {}) {
  const entityId = id || db.uuid();
  const updatedAt = db.nowIso();
  const member = getMember();
  if (!member) throw new Error('请先加入家庭');
  const family = isFamilyMode();
  const entity = {
    id: entityId,
    entityType,
    payload: {
      ...payload,
      createdBy: payload.createdBy || member.id,
    },
    updatedAt,
    revision: 0,
    deletedAt: deletedAt || null,
    syncStatus: family ? 'pending' : 'localOnly',
    guest: false,
  };
  await db.putEntity(entity);
  if (family) {
    await db.enqueue({
      opId: db.uuid(),
      id: entityId,
      entityType,
      payload: entity.payload,
      updatedAt,
      deletedAt: entity.deletedAt,
      attempts: 0,
      createdAt: updatedAt,
    });
  }
  return entity;
}

export async function syncNow() {
  if (!isFamilyMode()) return { skipped: true, reason: 'no-family' };
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
        await db.putEntity({ ...r.entity, syncStatus: 'conflict', guest: false });
        await db.kvSet(`conflict:${r.entity.id}`, {
          at: db.nowIso(),
          entity: r.entity,
        });
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

export async function resolveConflict(entityId, choice) {
  const key = `conflict:${entityId}`;
  const stored = await db.kvGet(key, null);
  if (!stored?.entity) return;
  if (choice === 'server') {
    await db.putEntity({ ...stored.entity, syncStatus: 'synced', guest: false });
  } else if (choice === 'mine') {
    const mine = await db.getEntity(entityId);
    if (mine) {
      mine.updatedAt = db.nowIso();
      mine.syncStatus = 'pending';
      await db.putEntity(mine);
      await db.enqueue({
        opId: db.uuid(),
        id: mine.id,
        entityType: mine.entityType,
        payload: mine.payload,
        updatedAt: mine.updatedAt,
        deletedAt: mine.deletedAt,
        force: true,
        attempts: 0,
        createdAt: mine.updatedAt,
      });
    }
  }
  await db.kvDel(key);
}

export async function listConflicts() {
  const all = await db.allEntities();
  return all.filter((e) => e.syncStatus === 'conflict');
}

export async function mergeLocalDataToFamily() {
  const all = await db.allEntities();
  const member = getMember();
  const locals = all.filter((e) => !e.deletedAt && (e.syncStatus === 'localOnly' || e.guest));
  for (const e of locals) {
    e.guest = false;
    if (e.payload?.createdBy === 'guest' && member) {
      e.payload = { ...e.payload, createdBy: member.id };
    }
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
  return locals.length;
}

export async function mergeGuestData() {
  return mergeLocalDataToFamily();
}

export async function clearGuestData() {
  const all = await db.allEntities();
  for (const e of all.filter((x) => x.guest || x.syncStatus === 'localOnly')) {
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
  return all.filter((e) => !e.deletedAt && (e.guest || e.syncStatus === 'localOnly')).length;
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
  if (!isFamilyMode() || !navigator.onLine) {
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
