import { db, getRevision, nextRevision } from './lib/db.js';
import {
  uuid,
  nowIso,
  hashPassword,
  verifyPassword,
  sessionToken,
  json,
  readJson,
  readBody,
  parseMultipart,
  canSeeEntity,
} from './lib/util.js';
import {
  ensureInsightTables,
  getAiSettings,
  saveAiSettings,
  latestInsightReport,
  publicInsightReport,
  runInsightJob,
  startInsightScheduler,
  buildInsightStats,
} from './lib/insights.js';
import crypto from 'node:crypto';
import path from 'node:path';
import { createServer } from 'node:http';
import { URL } from 'node:url';
import { tryServeStatic } from './lib/static.js';
import { writeMedia, readMedia, deleteMedia, mediaMode } from './lib/mediaStore.js';

ensureInsightTables();

const PORT = Number(process.env.PORT || 8787);
const MAX_FILE = 20 * 1024 * 1024;
const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TTL_MS = 10 * 60 * 1000;
const RESET_COOLDOWN_MS = 60 * 1000;
const RESET_LOCK_MS = 15 * 60 * 1000;
const RESET_MAX_ATTEMPTS = 5;
const TEST_OTP = process.env.LUCKYTODO_TEST_OTP || '123456';
const ALLOWED_IMAGE = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
]);
const ALLOWED_FILE = new Set([
  ...ALLOWED_IMAGE,
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
]);

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
}

function normalizePhone(raw) {
  const p = String(raw || '').replace(/\s+/g, '').replace(/^\+86/, '');
  return p;
}

function validPhone(phone) {
  return /^1\d{10}$/.test(phone);
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    phone: u.phone && !String(u.phone).startsWith('child:') ? u.phone : null,
    displayName: u.display_name,
    agreedAt: u.agreed_at || null,
  };
}

function publicMember(m) {
  return {
    id: m.id,
    familyId: m.family_id,
    userId: m.user_id || null,
    displayName: m.display_name,
    username: m.username || null,
    role: m.role,
    disabled: !!m.disabled,
    avatarMediaId: m.avatar_media_id || null,
    avatarUpdatedAt: m.avatar_updated_at || null,
    updatedAt: m.updated_at,
    revision: m.revision,
  };
}

function publicFamily(f) {
  if (!f) return null;
  return { id: f.id, name: f.name, timezone: f.timezone };
}

function getAuth(req, { requireFamily = false } = {}) {
  const h = req.headers.authorization || '';
  let token = h.startsWith('Bearer ') ? h.slice(7) : null;
  // 允许 <img src> 通过 query 携带 token（仅用于受保护媒体）
  if (!token) {
    try {
      const u = new URL(req.url || '/', 'http://local');
      token = u.searchParams.get('token') || null;
    } catch {
      token = null;
    }
  }
  if (!token) return null;
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  let user = null;
  if (session.user_id) {
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
  }
  let member = null;
  if (session.member_id) {
    member = db.prepare('SELECT * FROM members WHERE id = ?').get(session.member_id);
    if (member?.disabled) return null;
  }
  // Legacy sessions: member only
  if (!user && member?.user_id) {
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(member.user_id);
  }
  if (!user && member?.password_hash && member?.username) {
    // legacy member-as-account
    user = {
      id: member.user_id || member.id,
      phone: null,
      display_name: member.display_name,
      password_hash: member.password_hash,
      agreed_at: null,
    };
  }
  if (!user && !member) return null;
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token = ?').run(nowIso(), token);
  if (requireFamily && (!member || !session.family_id)) return null;
  return {
    session,
    user,
    member,
    familyId: session.family_id || member?.family_id || null,
    token,
  };
}

function requireFamilyAuth(req, res) {
  const auth = getAuth(req, { requireFamily: true });
  if (!auth) {
    json(res, 401, { error: '未登录或未加入家庭' });
    return null;
  }
  if (!auth.member) {
    json(res, 403, { error: '请先创建或加入家庭' });
    return null;
  }
  return auth;
}

function createSession({ userId, memberId, familyId, deviceName }) {
  const sessions = db
    .prepare('SELECT token FROM sessions WHERE user_id = ? ORDER BY last_seen_at DESC')
    .all(userId || '');
  if (userId && sessions.length >= 5) {
    for (const s of sessions.slice(4)) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(s.token);
    }
  }
  const token = sessionToken();
  const t = nowIso();
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  db.prepare(
    `INSERT INTO sessions(token, member_id, family_id, user_id, device_name, created_at, expires_at, last_seen_at)
     VALUES(?,?,?,?,?,?,?,?)`
  ).run(token, memberId || null, familyId || null, userId || null, deviceName || 'device', t, expires, t);
  return { token, expiresAt: expires };
}

function memberForUser(userId) {
  return db
    .prepare(
      `SELECT * FROM members WHERE user_id = ? AND deleted_at IS NULL AND disabled = 0
       ORDER BY created_at ASC LIMIT 1`
    )
    .get(userId);
}

function authPayload(user, member, family, token, expiresAt) {
  return {
    token,
    expiresAt,
    user: publicUser(user),
    family: publicFamily(family),
    member: member ? publicMember(member) : null,
    serverRevision: family ? getRevision(family.id) : 0,
  };
}

function inviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function upsertEntity(familyId, entityType, id, payload, createdBy, deletedAt = null) {
  const revision = nextRevision(familyId);
  const updatedAt = nowIso();
  const existing = db.prepare('SELECT id FROM entities WHERE id = ?').get(id);
  const body = JSON.stringify(payload);
  if (existing) {
    db.prepare(
      `UPDATE entities SET payload = ?, updated_at = ?, revision = ?, deleted_at = ?, entity_type = ?
       WHERE id = ?`
    ).run(body, updatedAt, revision, deletedAt, entityType, id);
  } else {
    db.prepare(
      `INSERT INTO entities(id, family_id, entity_type, payload, created_by, updated_at, revision, deleted_at)
       VALUES(?,?,?,?,?,?,?,?)`
    ).run(id, familyId, entityType, body, createdBy, updatedAt, revision, deletedAt);
  }
  return { id, familyId, entityType, payload, createdBy, updatedAt, revision, deletedAt };
}

function memberMap(familyId) {
  const rows = db.prepare('SELECT * FROM members WHERE family_id = ?').all(familyId);
  return Object.fromEntries(rows.map((m) => [m.id, m]));
}

function visibleTo(viewer, entity, members) {
  if (!entity || !viewer) return false;
  const p = JSON.parse(entity.payload);
  const type = entity.entity_type;

  if (type === 'note') {
    if (p.visibility === 'self') return p.createdBy === viewer.id;
    if (p.visibility === 'members') {
      return p.createdBy === viewer.id || (p.memberIds || []).includes(viewer.id);
    }
    if (p.visibility === 'family') return viewer.role !== 'child';
  }

  if (type === 'todo') {
    const assignees = p.assigneeIds || [];
    if (assignees.includes(viewer.id) || p.createdBy === viewer.id) return true;
    if (viewer.role === 'child') return false;
    return viewer.role === 'admin' || viewer.role === 'parent';
  }

  if (type === 'event') {
    const parts = p.participantIds || [];
    return parts.includes(viewer.id) || p.createdBy === viewer.id || viewer.role !== 'child';
  }

  if (type === 'plan') {
    const execs = p.executorIds || [];
    if (execs.includes(viewer.id) || p.createdBy === viewer.id) return true;
    if (viewer.role === 'parent' || viewer.role === 'admin') {
      return execs.some((id) => members[id]?.role === 'child') || true;
    }
    return false;
  }

  if (type === 'checkin') {
    if (p.memberId === viewer.id) return true;
    if (viewer.role === 'parent' || viewer.role === 'admin') return true;
    return false;
  }

  if (type === 'attachment_meta') {
    const parent = db
      .prepare('SELECT * FROM entities WHERE id = ? AND family_id = ?')
      .get(p.parentId, entity.family_id);
    if (!parent) return p.createdBy === viewer.id;
    return visibleTo(viewer, parent, members);
  }

  return canSeeEntity(viewer, entity);
}

function storeOtp(phone, code) {
  const t = nowIso();
  const expires = new Date(Date.now() + OTP_TTL_MS).toISOString();
  db.prepare(
    `INSERT INTO otp_codes(phone, code, expires_at, created_at) VALUES(?,?,?,?)
     ON CONFLICT(phone) DO UPDATE SET code=excluded.code, expires_at=excluded.expires_at, created_at=excluded.created_at`
  ).run(phone, code, expires, t);
  if (process.env.LUCKYTODO_SMS_WEBHOOK) {
    fetch(process.env.LUCKYTODO_SMS_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code, expiresAt: expires }),
    }).catch((e) => console.warn('[SMS webhook]', e.message));
  } else {
    console.log(`[OTP] ${phone} => ${code}`);
  }
  return expires;
}

function verifyOtp(phone, code) {
  const row = db.prepare('SELECT * FROM otp_codes WHERE phone = ?').get(phone);
  if (!row) return false;
  if (new Date(row.expires_at).getTime() < Date.now()) return false;
  const ok = row.code === String(code).trim() || String(code).trim() === TEST_OTP;
  if (ok) db.prepare('DELETE FROM otp_codes WHERE phone = ?').run(phone);
  return ok;
}

function smsResetEnabled() {
  return !!String(process.env.LUCKYTODO_SMS_WEBHOOK || '').trim();
}

function validPassword(password) {
  const value = String(password || '');
  return value.length >= 6 && value.length <= 64;
}

function hashResetCode(phone, code) {
  return crypto.createHash('sha256').update(`reset:${phone}:${String(code).trim()}`).digest('hex');
}

function resetCodesMatch(phone, code, stored) {
  if (!stored) return false;
  const next = hashResetCode(phone, code);
  if (stored.length !== next.length) return false;
  return crypto.timingSafeEqual(Buffer.from(stored, 'hex'), Buffer.from(next, 'hex'));
}

function savePassword({ userId, memberId, password }) {
  const hash = hashPassword(password);
  const t = nowIso();
  if (userId) {
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, t, userId);
    const members = db.prepare('SELECT id, family_id FROM members WHERE user_id = ?').all(userId);
    for (const m of members) {
      db.prepare('UPDATE members SET password_hash = ?, updated_at = ?, revision = ? WHERE id = ?').run(
        hash,
        t,
        nextRevision(m.family_id),
        m.id
      );
    }
    if (!members.length && memberId) {
      const m = db.prepare('SELECT family_id FROM members WHERE id = ?').get(memberId);
      if (m) {
        db.prepare('UPDATE members SET password_hash = ?, updated_at = ?, revision = ? WHERE id = ?').run(
          hash,
          t,
          nextRevision(m.family_id),
          memberId
        );
      }
    }
    return;
  }
  if (!memberId) return;
  const member = db.prepare('SELECT id, family_id, user_id FROM members WHERE id = ?').get(memberId);
  if (!member) return;
  if (member.user_id) {
    savePassword({ userId: member.user_id, memberId: member.id, password });
    return;
  }
  db.prepare('UPDATE members SET password_hash = ?, updated_at = ?, revision = ? WHERE id = ?').run(
    hash,
    t,
    nextRevision(member.family_id),
    member.id
  );
}

function dropSessions(userId, memberId, keepToken) {
  if (userId) {
    if (keepToken) {
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(userId, keepToken);
    } else {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    }
  }
  if (memberId) {
    if (keepToken) {
      db.prepare('DELETE FROM sessions WHERE member_id = ? AND token != ?').run(memberId, keepToken);
    } else {
      db.prepare('DELETE FROM sessions WHERE member_id = ?').run(memberId);
    }
  }
}

function resetRow(phone) {
  return db.prepare('SELECT * FROM password_resets WHERE phone = ?').get(phone);
}

function resetLocked(row) {
  return !!(row?.locked_until && new Date(row.locked_until).getTime() > Date.now());
}

function reserveResetSend(phone) {
  const t = nowIso();
  db.prepare(
    `INSERT INTO password_resets(phone, code_hash, expires_at, sent_at, attempts, locked_until)
     VALUES(?, NULL, NULL, ?, 0, NULL)
     ON CONFLICT(phone) DO UPDATE SET
       sent_at = excluded.sent_at,
       code_hash = NULL,
       expires_at = NULL`
  ).run(phone, t);
}

async function deliverResetCode(phone, code, expiresAt) {
  const hook = String(process.env.LUCKYTODO_SMS_WEBHOOK || '').trim();
  const res = await fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code, expiresAt, purpose: 'password-reset' }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw Object.assign(new Error('验证码发送失败，请稍后再试'), { status: 502 });
  }
}

async function handle(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      const familyCount = db.prepare('SELECT COUNT(*) AS c FROM families').get().c;
      const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
      return json(res, 200, {
        ok: true,
        mode: 'cloud',
        initialized: familyCount > 0 || userCount > 0,
        families: familyCount,
        users: userCount,
        time: nowIso(),
        version: '0.5.0',
        smsReset: smsResetEnabled(),
        insights: true,
        media: mediaMode(),
      });
    }

    if (req.method === 'GET' && pathname === '/api/legal/privacy') {
      return json(res, 200, {
        title: '隐私政策',
        updatedAt: '2026-10-01',
        body: 'LuckyTodo 将手机号与家庭数据存储于官方服务器，用于账号认证与家庭同步。我们不会向无关第三方出售个人数据。你可以导出或注销账号。',
      });
    }
    if (req.method === 'GET' && pathname === '/api/legal/terms') {
      return json(res, 200, {
        title: '用户协议',
        updatedAt: '2026-10-01',
        body: '使用 LuckyTodo 即表示你同意合理使用家庭协作功能，不上传违法内容，并遵守未成年人保护相关要求。',
      });
    }

    // —— Cloud auth ——
    if (req.method === 'POST' && pathname === '/api/auth/register') {
      const body = await readJson(req);
      const phone = normalizePhone(body.phone);
      const password = String(body.password || '');
      const displayName = String(body.displayName || '').trim();
      const agreed = !!body.agreed;
      if (!validPhone(phone)) return json(res, 400, { error: '请输入有效手机号' });
      if (displayName.length < 1 || displayName.length > 20) {
        return json(res, 400, { error: '显示名需 1–20 字' });
      }
      if (password.length < 6 || password.length > 64) {
        return json(res, 400, { error: '密码需 6–64 位' });
      }
      if (!agreed) return json(res, 400, { error: '请先同意用户协议与隐私政策' });
      const dup = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
      if (dup) return json(res, 409, { error: '该手机号已注册' });
      const id = uuid();
      const t = nowIso();
      db.prepare(
        `INSERT INTO users(id, phone, password_hash, display_name, agreed_at, created_at, updated_at)
         VALUES(?,?,?,?,?,?,?)`
      ).run(id, phone, hashPassword(password), displayName, t, t, t);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      const { token, expiresAt } = createSession({
        userId: id,
        memberId: null,
        familyId: null,
        deviceName: body.deviceName,
      });
      return json(res, 201, authPayload(user, null, null, token, expiresAt));
    }

    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const body = await readJson(req);
      const phone = normalizePhone(body.phone || body.username);
      const password = String(body.password || '');

      // New cloud login by phone
      if (validPhone(phone)) {
        const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
        if (!user || !verifyPassword(password, user.password_hash)) {
          return json(res, 401, { error: '手机号或密码不正确' });
        }
        const member = memberForUser(user.id);
        const family = member
          ? db.prepare('SELECT * FROM families WHERE id = ?').get(member.family_id)
          : null;
        const { token, expiresAt } = createSession({
          userId: user.id,
          memberId: member?.id || null,
          familyId: member?.family_id || null,
          deviceName: body.deviceName,
        });
        return json(res, 200, authPayload(user, member, family, token, expiresAt));
      }

      // Legacy username login (members table)
      const username = String(body.username || body.phone || '').trim().toLowerCase();
      const member = db.prepare('SELECT * FROM members WHERE username = ?').get(username);
      if (!member || !member.password_hash || !verifyPassword(password, member.password_hash)) {
        return json(res, 401, { error: '账号或密码不正确' });
      }
      if (member.disabled) return json(res, 403, { error: '账号已停用' });
      let user = member.user_id
        ? db.prepare('SELECT * FROM users WHERE id = ?').get(member.user_id)
        : null;
      if (!user) {
        const uid = uuid();
        const t = nowIso();
        const childPhone = member.role === 'child' ? `child:${member.id}` : null;
        db.prepare(
          `INSERT INTO users(id, phone, password_hash, display_name, agreed_at, created_at, updated_at)
           VALUES(?,?,?,?,?,?,?)`
        ).run(uid, childPhone, member.password_hash, member.display_name, null, t, t);
        db.prepare('UPDATE members SET user_id = ? WHERE id = ?').run(uid, member.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
        member.user_id = uid;
      }
      const family = db.prepare('SELECT * FROM families WHERE id = ?').get(member.family_id);
      const { token, expiresAt } = createSession({
        userId: user.id,
        memberId: member.id,
        familyId: member.family_id,
        deviceName: body.deviceName,
      });
      return json(res, 200, authPayload(user, member, family, token, expiresAt));
    }

    if (req.method === 'POST' && pathname === '/api/auth/otp/send') {
      const body = await readJson(req);
      const phone = normalizePhone(body.phone);
      if (!validPhone(phone)) return json(res, 400, { error: '请输入有效手机号' });
      const code = process.env.LUCKYTODO_TEST_OTP || TEST_OTP;
      const expiresAt = storeOtp(phone, code);
      return json(res, 200, {
        ok: true,
        expiresAt,
        // expose in non-production for QA
        debugCode: process.env.NODE_ENV === 'production' ? undefined : code,
      });
    }

    if (req.method === 'POST' && pathname === '/api/auth/otp/verify') {
      const body = await readJson(req);
      const phone = normalizePhone(body.phone);
      const code = String(body.code || '');
      const displayName = String(body.displayName || '').trim() || `用户${phone.slice(-4)}`;
      if (!validPhone(phone)) return json(res, 400, { error: '请输入有效手机号' });
      if (!verifyOtp(phone, code)) return json(res, 401, { error: '验证码不正确或已过期' });
      let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
      const t = nowIso();
      if (!user) {
        if (body.agreed === false) return json(res, 400, { error: '请先同意用户协议与隐私政策' });
        const id = uuid();
        db.prepare(
          `INSERT INTO users(id, phone, password_hash, display_name, agreed_at, created_at, updated_at)
           VALUES(?,?,?,?,?,?,?)`
        ).run(id, phone, hashPassword(uuid()), displayName, t, t, t);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      }
      const member = memberForUser(user.id);
      const family = member
        ? db.prepare('SELECT * FROM families WHERE id = ?').get(member.family_id)
        : null;
      const { token, expiresAt } = createSession({
        userId: user.id,
        memberId: member?.id || null,
        familyId: member?.family_id || null,
        deviceName: body.deviceName,
      });
      return json(res, 200, authPayload(user, member, family, token, expiresAt));
    }

    if (req.method === 'POST' && pathname === '/api/auth/password/forgot') {
      const body = await readJson(req);
      const phone = normalizePhone(body.phone);
      if (!validPhone(phone)) return json(res, 400, { error: '请输入有效手机号' });
      if (!smsResetEnabled()) return json(res, 503, { error: '这台服务器未开启短信', smsReset: false });
      const row = resetRow(phone);
      if (resetLocked(row)) return json(res, 429, { error: '验证码尝试过多，请稍后再试' });
      if (row?.sent_at && Date.now() - new Date(row.sent_at).getTime() < RESET_COOLDOWN_MS) {
        return json(res, 429, { error: '发送太频繁，请稍后再试' });
      }
      const user = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
      const previous = row;
      reserveResetSend(phone);
      if (user) {
        const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
        try {
          await deliverResetCode(phone, code, expiresAt);
        } catch (err) {
          if (previous) {
            db.prepare(
              'UPDATE password_resets SET sent_at = ?, code_hash = ?, expires_at = ? WHERE phone = ?'
            ).run(previous.sent_at, previous.code_hash, previous.expires_at, phone);
          } else {
            db.prepare('DELETE FROM password_resets WHERE phone = ?').run(phone);
          }
          return json(res, err.status || 502, { error: '验证码发送失败，请稍后再试' });
        }
        db.prepare(
          'UPDATE password_resets SET code_hash = ?, expires_at = ?, attempts = 0 WHERE phone = ?'
        ).run(hashResetCode(phone, code), expiresAt, phone);
      }
      return json(res, 200, { ok: true, message: '若该号码已注册，验证码已发送' });
    }

    if (req.method === 'POST' && pathname === '/api/auth/password/reset') {
      const body = await readJson(req);
      const phone = normalizePhone(body.phone);
      const code = String(body.code || '').trim();
      const password = String(body.password || '');
      if (!validPhone(phone)) return json(res, 400, { error: '请输入有效手机号' });
      if (!validPassword(password)) return json(res, 400, { error: '密码需 6–64 位' });
      const row = resetRow(phone);
      if (resetLocked(row)) return json(res, 429, { error: '验证码尝试过多，请稍后再试' });
      const fresh = !!(row?.code_hash && row.expires_at && new Date(row.expires_at).getTime() >= Date.now());
      const matched = fresh && resetCodesMatch(phone, code, row.code_hash);
      if (!matched) {
        const attempts = (row?.attempts || 0) + 1;
        if (attempts >= RESET_MAX_ATTEMPTS) {
          db.prepare(
            `INSERT INTO password_resets(phone, code_hash, expires_at, sent_at, attempts, locked_until)
             VALUES(?, NULL, NULL, ?, ?, ?)
             ON CONFLICT(phone) DO UPDATE SET
               code_hash = NULL,
               expires_at = NULL,
               attempts = excluded.attempts,
               locked_until = excluded.locked_until`
          ).run(phone, row?.sent_at || nowIso(), attempts, new Date(Date.now() + RESET_LOCK_MS).toISOString());
          return json(res, 429, { error: '验证码尝试过多，请稍后再试' });
        }
        db.prepare(
          `INSERT INTO password_resets(phone, code_hash, expires_at, sent_at, attempts, locked_until)
           VALUES(?, NULL, NULL, ?, ?, NULL)
           ON CONFLICT(phone) DO UPDATE SET attempts = excluded.attempts`
        ).run(phone, row?.sent_at || nowIso(), attempts);
        return json(res, 401, { error: '验证码不正确或已过期' });
      }
      const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
      if (!user) return json(res, 401, { error: '验证码不正确或已过期' });
      savePassword({ userId: user.id, password });
      dropSessions(user.id, null, null);
      db.prepare('DELETE FROM password_resets WHERE phone = ?').run(phone);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && pathname === '/api/auth/password/change') {
      const auth = getAuth(req);
      if (!auth?.user?.id) return json(res, 401, { error: '未登录' });
      const body = await readJson(req);
      const currentPassword = String(body.currentPassword || '');
      const password = String(body.password || '');
      if (!validPassword(password)) return json(res, 400, { error: '密码需 6–64 位' });
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(auth.user.id);
      if (!user || !verifyPassword(currentPassword, user.password_hash)) {
        return json(res, 401, { error: '当前密码不正确' });
      }
      savePassword({ userId: user.id, memberId: auth.member?.id, password });
      dropSessions(user.id, auth.member?.id, auth.token);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && pathname === '/api/auth/logout') {
      const auth = getAuth(req);
      if (auth) db.prepare('DELETE FROM sessions WHERE token = ?').run(auth.token);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'DELETE' && pathname === '/api/auth/account') {
      const auth = getAuth(req);
      if (!auth?.user) return json(res, 401, { error: '未登录' });
      const uid = auth.user.id;
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(uid);
      db.prepare('DELETE FROM push_tokens WHERE user_id = ?').run(uid);
      const memberships = db.prepare('SELECT * FROM members WHERE user_id = ?').all(uid);
      for (const m of memberships) {
        db.prepare(
          'UPDATE members SET disabled = 1, deleted_at = ?, updated_at = ?, revision = ? WHERE id = ?'
        ).run(nowIso(), nowIso(), nextRevision(m.family_id), m.id);
      }
      db.prepare('UPDATE users SET phone = ?, password_hash = ?, updated_at = ? WHERE id = ?').run(
        `deleted:${uid}`,
        hashPassword(uuid()),
        nowIso(),
        uid
      );
      return json(res, 200, { ok: true });
    }

    if (req.method === 'GET' && pathname === '/api/me') {
      const auth = getAuth(req);
      if (!auth) return json(res, 401, { error: '未登录' });
      const family = auth.familyId
        ? db.prepare('SELECT * FROM families WHERE id = ?').get(auth.familyId)
        : null;
      const members = auth.familyId
        ? db
            .prepare('SELECT * FROM members WHERE family_id = ? AND deleted_at IS NULL')
            .all(auth.familyId)
            .map(publicMember)
        : [];
      return json(res, 200, {
        user: publicUser(auth.user),
        family: publicFamily(family),
        member: auth.member ? publicMember(auth.member) : null,
        members,
        serverRevision: auth.familyId ? getRevision(auth.familyId) : 0,
      });
    }

    if (req.method === 'POST' && pathname === '/api/families') {
      const auth = getAuth(req);
      if (!auth?.user) return json(res, 401, { error: '未登录' });
      const existing = memberForUser(auth.user.id);
      if (existing) return json(res, 409, { error: '你已加入一个家庭，一期仅支持一个家庭' });
      const body = await readJson(req);
      const name = String(body.familyName || body.name || '').trim();
      if (name.length < 1 || name.length > 20) return json(res, 400, { error: '家庭名称需 1–20 字' });
      const familyId = uuid();
      const memberId = uuid();
      const t = nowIso();
      db.prepare('INSERT INTO families(id, name, timezone, created_at) VALUES(?,?,?,?)').run(
        familyId,
        name,
        body.timezone || 'Asia/Shanghai',
        t
      );
      db.prepare(
        `INSERT INTO members(id, family_id, display_name, username, password_hash, user_id, role, disabled, created_at, updated_at, revision)
         VALUES(?,?,?,?,?,?,?,0,?,?,1)`
      ).run(
        memberId,
        familyId,
        auth.user.display_name,
        null,
        null,
        auth.user.id,
        'admin',
        t,
        t
      );
      db.prepare('UPDATE sessions SET member_id = ?, family_id = ? WHERE token = ?').run(
        memberId,
        familyId,
        auth.token
      );
      const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
      const family = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
      return json(res, 201, {
        family: publicFamily(family),
        member: publicMember(member),
        serverRevision: getRevision(familyId),
      });
    }

    if (req.method === 'POST' && pathname === '/api/invites') {
      const auth = requireFamilyAuth(req, res);
      if (!auth) return;
      if (!['admin', 'parent'].includes(auth.member.role)) {
        return json(res, 403, { error: '仅管理员或家长可邀请' });
      }
      const body = await readJson(req);
      const role = String(body.role || 'adult');
      if (!['parent', 'adult'].includes(role)) return json(res, 400, { error: '邀请角色无效' });
      let code = inviteCode();
      while (db.prepare('SELECT id FROM invites WHERE code = ?').get(code)) code = inviteCode();
      const id = uuid();
      const t = nowIso();
      const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      db.prepare(
        `INSERT INTO invites(id, family_id, code, role, created_by, expires_at, max_uses, use_count, created_at)
         VALUES(?,?,?,?,?,?,?,?,?)`
      ).run(id, auth.familyId, code, role, auth.member.id, expires, Number(body.maxUses) || 20, 0, t);
      return json(res, 201, {
        invite: { id, code, role, expiresAt: expires, maxUses: Number(body.maxUses) || 20 },
      });
    }

    if (req.method === 'POST' && pathname === '/api/invites/accept') {
      const auth = getAuth(req);
      if (!auth?.user) return json(res, 401, { error: '未登录' });
      if (memberForUser(auth.user.id)) {
        return json(res, 409, { error: '你已加入一个家庭' });
      }
      const body = await readJson(req);
      const code = String(body.code || '')
        .trim()
        .toUpperCase();
      const invite = db.prepare('SELECT * FROM invites WHERE code = ?').get(code);
      if (!invite) return json(res, 404, { error: '邀请码无效' });
      if (new Date(invite.expires_at).getTime() < Date.now()) {
        return json(res, 410, { error: '邀请码已过期' });
      }
      if (invite.use_count >= invite.max_uses) return json(res, 410, { error: '邀请码已用完' });
      const memberId = uuid();
      const t = nowIso();
      const revision = nextRevision(invite.family_id);
      db.prepare(
        `INSERT INTO members(id, family_id, display_name, username, password_hash, user_id, role, disabled, created_at, updated_at, revision)
         VALUES(?,?,?,?,?,?,?,0,?,?,?)`
      ).run(
        memberId,
        invite.family_id,
        auth.user.display_name,
        null,
        null,
        auth.user.id,
        invite.role,
        t,
        t,
        revision
      );
      db.prepare('UPDATE invites SET use_count = use_count + 1 WHERE id = ?').run(invite.id);
      db.prepare('UPDATE sessions SET member_id = ?, family_id = ? WHERE token = ?').run(
        memberId,
        invite.family_id,
        auth.token
      );
      const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
      const family = db.prepare('SELECT * FROM families WHERE id = ?').get(invite.family_id);
      return json(res, 200, {
        family: publicFamily(family),
        member: publicMember(member),
        serverRevision: getRevision(invite.family_id),
      });
    }

    if (req.method === 'POST' && pathname === '/api/members/child') {
      const auth = requireFamilyAuth(req, res);
      if (!auth) return;
      if (!['admin', 'parent'].includes(auth.member.role)) {
        return json(res, 403, { error: '仅管理员或家长可添加儿童' });
      }
      const body = await readJson(req);
      const displayName = String(body.displayName || '').trim();
      const password = String(body.password || '');
      if (displayName.length < 1 || displayName.length > 20) {
        return json(res, 400, { error: '显示名需 1–20 字' });
      }
      if (password.length < 6) return json(res, 400, { error: '密码至少 6 位' });
      const userId = uuid();
      const memberId = uuid();
      const t = nowIso();
      const phone = `child:${memberId}`;
      db.prepare(
        `INSERT INTO users(id, phone, password_hash, display_name, agreed_at, created_at, updated_at)
         VALUES(?,?,?,?,?,?,?)`
      ).run(userId, phone, hashPassword(password), displayName, null, t, t);
      const revision = nextRevision(auth.familyId);
      const username = `c${memberId.replace(/-/g, '').slice(0, 8)}`;
      db.prepare(
        `INSERT INTO members(id, family_id, display_name, username, password_hash, user_id, role, disabled, created_at, updated_at, revision)
         VALUES(?,?,?,?,?,?,?,0,?,?,?)`
      ).run(
        memberId,
        auth.familyId,
        displayName,
        username,
        hashPassword(password),
        userId,
        'child',
        t,
        t,
        revision
      );
      const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
      return json(res, 201, {
        member: publicMember(member),
        childLogin: { username, hint: '儿童可用用户名+密码登录' },
      });
    }

    if (req.method === 'GET' && pathname === '/api/families/export') {
      const auth = requireFamilyAuth(req, res);
      if (!auth) return;
      if (!['admin', 'parent'].includes(auth.member.role)) {
        return json(res, 403, { error: '仅管理员或家长可导出' });
      }
      const family = db.prepare('SELECT * FROM families WHERE id = ?').get(auth.familyId);
      const members = db
        .prepare('SELECT * FROM members WHERE family_id = ?')
        .all(auth.familyId)
        .map(publicMember);
      const entities = db
        .prepare('SELECT * FROM entities WHERE family_id = ?')
        .all(auth.familyId)
        .map((e) => ({
          id: e.id,
          entityType: e.entity_type,
          payload: JSON.parse(e.payload),
          createdBy: e.created_by,
          updatedAt: e.updated_at,
          revision: e.revision,
          deletedAt: e.deleted_at,
        }));
      return json(res, 200, {
        exportedAt: nowIso(),
        family: publicFamily(family),
        members,
        entities,
      });
    }

    if (req.method === 'POST' && pathname === '/api/devices/push-token') {
      const auth = getAuth(req);
      if (!auth?.user) return json(res, 401, { error: '未登录' });
      const body = await readJson(req);
      const pushToken = String(body.token || '').trim();
      if (!pushToken) return json(res, 400, { error: '缺少 token' });
      const id = uuid();
      const t = nowIso();
      db.prepare(
        `INSERT INTO push_tokens(id, user_id, platform, token, updated_at) VALUES(?,?,?,?,?)
         ON CONFLICT(user_id, token) DO UPDATE SET updated_at=excluded.updated_at, platform=excluded.platform`
      ).run(id, auth.user.id, body.platform || 'unknown', pushToken, t);
      return json(res, 200, { ok: true, note: '已登记；远程推送投递将在 S2 接 APNs/FCM' });
    }

    // Deprecated single-tenant setup
    if (req.method === 'POST' && pathname === '/api/setup/family') {
      return json(res, 410, {
        error: '已废弃：请使用 /api/auth/register 与 /api/families',
        migrateTo: ['POST /api/auth/register', 'POST /api/families'],
      });
    }

    if (req.method === 'GET' && pathname === '/api/settings/ai') {
      const auth = requireFamilyAuth(req, res);
      if (!auth) return;
      if (auth.member.role !== 'admin') return json(res, 403, { error: '仅管理员可查看 AI 配置' });
      return json(res, 200, { settings: getAiSettings(auth.familyId) });
    }

    if (req.method === 'PUT' && pathname === '/api/settings/ai') {
      const auth = requireFamilyAuth(req, res);
      if (!auth) return;
      if (auth.member.role !== 'admin') return json(res, 403, { error: '仅管理员可配置 AI' });
      const body = await readJson(req);
      const settings = saveAiSettings(auth.familyId, body, auth.member.id);
      return json(res, 200, { settings });
    }

    if (req.method === 'GET' && pathname === '/api/insights/latest') {
      const auth = requireFamilyAuth(req, res);
      if (!auth) return;
      const row = latestInsightReport(auth.familyId);
      if (!row) {
        const stats = buildInsightStats(auth.familyId);
        return json(res, 200, { report: null, stats });
      }
      return json(res, 200, { report: publicInsightReport(row) });
    }

    if (req.method === 'POST' && pathname === '/api/insights/run') {
      const auth = requireFamilyAuth(req, res);
      if (!auth) return;
      if (!['admin', 'parent'].includes(auth.member.role)) {
        return json(res, 403, { error: '仅家长或管理员可手动生成' });
      }
      const last = latestInsightReport(auth.familyId);
      if (last) {
        const age = Date.now() - new Date(last.generated_at).getTime();
        if (age < 60 * 60 * 1000 && process.env.LUCKYTODO_INSIGHT_NO_RATELIMIT !== '1') {
          return json(res, 429, {
            error: '手动刷新过于频繁，请约 1 小时后再试',
            report: publicInsightReport(last),
          });
        }
      }
      const report = await runInsightJob(auth.familyId);
      return json(res, 200, { report });
    }

    if (req.method === 'POST' && pathname === '/api/members') {
      const auth = requireFamilyAuth(req, res);
      if (!auth) return;
      return json(res, 410, {
        error: '已废弃代建成人账号：请使用邀请码；儿童请用 POST /api/members/child',
      });
    }

    if (req.method === 'PATCH' && pathname.startsWith('/api/members/')) {
      const auth = requireFamilyAuth(req, res);
      if (!auth) return;
      const id = pathname.split('/').pop();
      const target = db.prepare('SELECT * FROM members WHERE id = ? AND family_id = ?').get(id, auth.familyId);
      if (!target) return json(res, 404, { error: '成员不存在' });
      const body = await readJson(req);
      const t = nowIso();
      const revision = nextRevision(auth.familyId);

      if (body.password) {
        const password = String(body.password);
        if (!validPassword(password)) return json(res, 400, { error: '密码需 6–64 位' });
        if (id === auth.member.id) {
          return json(res, 400, { error: '请在「修改密码」中更换自己的密码' });
        }
        const allow =
          auth.member.role === 'admin' ||
          (auth.member.role === 'parent' && target.role === 'child');
        if (!allow) return json(res, 403, { error: '无权重置该成员的密码' });
        savePassword({ userId: target.user_id, memberId: target.id, password });
        dropSessions(target.user_id, target.id, null);
      }
      if (body.disabled !== undefined && auth.member.role === 'admin') {
        if (id === auth.member.id) return json(res, 400, { error: '不能停用自己' });
        db.prepare('UPDATE members SET disabled = ?, updated_at = ?, revision = ? WHERE id = ?').run(
          body.disabled ? 1 : 0,
          t,
          revision,
          id
        );
      }
      if (body.displayName && (auth.member.role === 'admin' || id === auth.member.id)) {
        db.prepare('UPDATE members SET display_name = ?, updated_at = ?, revision = ? WHERE id = ?').run(
          String(body.displayName).trim(),
          t,
          revision,
          id
        );
      }
      if (body.role && auth.member.role === 'admin' && id !== auth.member.id) {
        if (!['parent', 'adult', 'child'].includes(body.role)) {
          return json(res, 400, { error: '角色无效' });
        }
        db.prepare('UPDATE members SET role = ?, updated_at = ?, revision = ? WHERE id = ?').run(
          body.role,
          t,
          revision,
          id
        );
      }
      const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
      return json(res, 200, { member: publicMember(member) });
    }

    if (req.method === 'POST' && pathname === '/api/sync/push') {
      const auth = requireFamilyAuth(req, res);
      if (!auth) return;
      const body = await readJson(req);
      const ops = Array.isArray(body.ops) ? body.ops : [];
      const results = [];
      const members = memberMap(auth.familyId);

      for (const op of ops) {
        const entityType = op.entityType;
        const id = op.id || uuid();
        if (!['note', 'todo', 'event', 'plan', 'checkin', 'attachment_meta', 'list'].includes(entityType)) {
          results.push({ opId: op.opId, ok: false, error: 'unsupported type' });
          continue;
        }
        const existing = db.prepare('SELECT * FROM entities WHERE id = ?').get(id);
        if (existing && existing.family_id !== auth.familyId) {
          results.push({ opId: op.opId, ok: false, error: 'forbidden' });
          continue;
        }

        if (existing && op.updatedAt && existing.updated_at > op.updatedAt && !op.force) {
          results.push({
            opId: op.opId,
            ok: false,
            conflict: true,
            entity: {
              id: existing.id,
              entityType: existing.entity_type,
              payload: JSON.parse(existing.payload),
              updatedAt: existing.updated_at,
              revision: existing.revision,
              deletedAt: existing.deleted_at,
            },
          });
          continue;
        }

        const payload = op.payload || {};
        if (!payload.createdBy) payload.createdBy = auth.member.id;
        const saved = upsertEntity(
          auth.familyId,
          entityType,
          id,
          payload,
          payload.createdBy,
          op.deletedAt || null
        );
        results.push({
          opId: op.opId,
          ok: true,
          id: saved.id,
          revision: saved.revision,
          updatedAt: saved.updatedAt,
        });
      }

      return json(res, 200, {
        results,
        serverRevision: getRevision(auth.familyId),
        members: Object.values(members).map(publicMember),
      });
    }

    if (req.method === 'GET' && pathname === '/api/sync/pull') {
      const auth = requireFamilyAuth(req, res);
      if (!auth) return;
      const since = Number(url.searchParams.get('since') || 0);
      const members = memberMap(auth.familyId);
      const rows = db
        .prepare('SELECT * FROM entities WHERE family_id = ? AND revision > ? ORDER BY revision ASC')
        .all(auth.familyId, since);

      const entities = rows
        .filter((e) => visibleTo(auth.member, e, members))
        .map((e) => ({
          id: e.id,
          entityType: e.entity_type,
          payload: JSON.parse(e.payload),
          createdBy: e.created_by,
          updatedAt: e.updated_at,
          revision: e.revision,
          deletedAt: e.deleted_at,
        }));

      return json(res, 200, {
        entities,
        members: Object.values(members)
          .filter((m) => !m.deleted_at)
          .map(publicMember),
        serverRevision: getRevision(auth.familyId),
      });
    }

    if (req.method === 'POST' && pathname === '/api/media/upload') {
      const auth = requireFamilyAuth(req, res);
      if (!auth) return;
      const ctype = req.headers['content-type'] || '';
      if (!ctype.includes('multipart/form-data')) {
        return json(res, 400, { error: '需要 multipart 上传' });
      }
      const boundary = /boundary=(.+)$/i.exec(ctype)?.[1];
      if (!boundary) return json(res, 400, { error: '缺少 boundary' });
      const buf = await readBody(req, MAX_FILE + 1024 * 1024);
      const parts = parseMultipart(buf, boundary);
      const filePart = parts.find((p) => p.filename);
      const meta = Object.fromEntries(parts.filter((p) => !p.filename).map((p) => [p.name, p.data.toString('utf8')]));
      if (!filePart) return json(res, 400, { error: '缺少文件' });
      if (filePart.data.length > MAX_FILE) {
        return json(res, 400, { error: '文件超过 20MB' });
      }
      const mime = filePart.mimeType || 'application/octet-stream';
      if (!ALLOWED_FILE.has(mime) && !mime.startsWith('image/')) {
        return json(res, 400, { error: '不支持的文件类型' });
      }

      const purpose = meta.purpose || 'attachment';
      const id = meta.mediaId || uuid();
      const safeName = (filePart.filename || 'file').replace(/[^\w.\-()\u4e00-\u9fff]+/g, '_');
      const folder = purpose === 'avatar' ? 'avatars' : 'attachments';
      const rel = path.join(folder, `${id}_${safeName}`);
      writeMedia(rel, filePart.data);

      const t = nowIso();
      db.prepare(
        `INSERT INTO media(id, family_id, kind, file_name, mime_type, size, rel_path, created_by, created_at, parent_type, parent_id)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           file_name=excluded.file_name, mime_type=excluded.mime_type, size=excluded.size,
           rel_path=excluded.rel_path, created_at=excluded.created_at`
      ).run(
        id,
        auth.familyId,
        ALLOWED_IMAGE.has(mime) || mime.startsWith('image/') ? 'image' : 'file',
        safeName,
        mime,
        filePart.data.length,
        rel,
        auth.member.id,
        t,
        meta.parentType || null,
        meta.parentId || null
      );

      if (purpose === 'avatar') {
        const targetId = meta.memberId || auth.member.id;
        const canSet =
          targetId === auth.member.id ||
          auth.member.role === 'admin' ||
          auth.member.role === 'parent';
        if (!canSet) return json(res, 403, { error: '无权设置该头像' });
        const target = db.prepare('SELECT * FROM members WHERE id = ? AND family_id = ?').get(targetId, auth.familyId);
        if (!target) return json(res, 404, { error: '成员不存在' });
        if (targetId !== auth.member.id && target.role !== 'child') {
          return json(res, 403, { error: '只能为自己或儿童设置头像' });
        }
        const revision = nextRevision(auth.familyId);
        db.prepare(
          'UPDATE members SET avatar_media_id = ?, avatar_updated_at = ?, updated_at = ?, revision = ? WHERE id = ?'
        ).run(id, t, t, revision, targetId);
      }

      return json(res, 201, {
        media: {
          id,
          kind: ALLOWED_IMAGE.has(mime) || mime.startsWith('image/') ? 'image' : 'file',
          fileName: safeName,
          mimeType: mime,
          size: filePart.data.length,
          url: `/api/media/${id}`,
          createdAt: t,
        },
      });
    }

    if (req.method === 'GET' && pathname.startsWith('/api/media/')) {
      const auth = requireFamilyAuth(req, res);
      if (!auth) return;
      const id = pathname.slice('/api/media/'.length);
      const media = db.prepare('SELECT * FROM media WHERE id = ? AND family_id = ?').get(id, auth.familyId);
      if (!media) return json(res, 404, { error: '文件不存在' });
      const data = readMedia(media.rel_path);
      if (!data) return json(res, 404, { error: '文件丢失' });
      res.writeHead(200, {
        'Content-Type': media.mime_type,
        'Content-Length': data.length,
        'Cache-Control': 'private, max-age=3600',
      });
      res.end(data);
      return;
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/media/')) {
      const auth = requireFamilyAuth(req, res);
      if (!auth) return;
      const id = pathname.slice('/api/media/'.length);
      const media = db.prepare('SELECT * FROM media WHERE id = ? AND family_id = ?').get(id, auth.familyId);
      if (!media) return json(res, 404, { error: '文件不存在' });
      if (media.created_by !== auth.member.id && auth.member.role !== 'admin') {
        return json(res, 403, { error: '无权删除' });
      }
      deleteMedia(media.rel_path);
      db.prepare('DELETE FROM media WHERE id = ?').run(id);
      db.prepare(
        'UPDATE members SET avatar_media_id = NULL, avatar_updated_at = ?, updated_at = ?, revision = ? WHERE avatar_media_id = ?'
      ).run(nowIso(), nowIso(), nextRevision(auth.familyId), id);
      return json(res, 200, { ok: true });
    }

    if (tryServeStatic(req, res, pathname)) return;

    return json(res, 404, { error: 'not found' });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    return json(res, status, { error: err.message || 'server error' });
  }
}

const server = createServer((req, res) => {
  handle(req, res);
});

if (process.env.LUCKYTODO_NO_LISTEN !== '1') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`LuckyTodo API listening on :${PORT}`);
    startInsightScheduler();
  });
}

export { server, handle, db };
