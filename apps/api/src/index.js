import { db, getRevision, nextRevision, MEDIA_DIR } from './lib/db.js';
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
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { URL } from 'node:url';
import { tryServeStatic } from './lib/static.js';

ensureInsightTables();

const PORT = Number(process.env.PORT || 8787);
const MAX_FILE = 20 * 1024 * 1024;
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

function getAuth(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(session.member_id);
  if (!member || member.disabled) return null;
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token = ?').run(nowIso(), token);
  return { session, member, familyId: session.family_id, token };
}

function publicMember(m) {
  return {
    id: m.id,
    familyId: m.family_id,
    displayName: m.display_name,
    username: m.username,
    role: m.role,
    disabled: !!m.disabled,
    avatarMediaId: m.avatar_media_id || null,
    avatarUpdatedAt: m.avatar_updated_at || null,
    updatedAt: m.updated_at,
    revision: m.revision,
  };
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
  if (!entity) return false;
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
    return false;
  }

  if (type === 'event') {
    const parts = p.participantIds || [];
    return parts.includes(viewer.id) || p.createdBy === viewer.id;
  }

  if (type === 'plan') {
    const execs = p.executorIds || [];
    if (execs.includes(viewer.id) || p.createdBy === viewer.id) return true;
    if (viewer.role === 'parent' || viewer.role === 'admin') {
      return execs.some((id) => members[id]?.role === 'child');
    }
    return false;
  }

  if (type === 'checkin') {
    if (p.memberId === viewer.id) return true;
    if (viewer.role === 'parent' || viewer.role === 'admin') {
      const m = members[p.memberId];
      return m && (m.role === 'child' || true);
    }
    return false;
  }

  if (type === 'attachment_meta') {
    const parent = db
      .prepare('SELECT * FROM entities WHERE id = ? AND family_id = ?')
      .get(p.parentId, viewer.family_id || entity.family_id);
    if (!parent) return p.createdBy === viewer.id;
    return visibleTo(viewer, parent, members);
  }

  return canSeeEntity(viewer, entity);
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
      return json(res, 200, {
        ok: true,
        initialized: familyCount > 0,
        time: nowIso(),
        version: '0.4.0',
        insights: true,
      });
    }

    if (req.method === 'GET' && pathname === '/api/settings/ai') {
      const auth = getAuth(req);
      if (!auth) return json(res, 401, { error: '未登录' });
      if (auth.member.role !== 'admin') return json(res, 403, { error: '仅管理员可查看 AI 配置' });
      return json(res, 200, { settings: getAiSettings(auth.familyId) });
    }

    if (req.method === 'PUT' && pathname === '/api/settings/ai') {
      const auth = getAuth(req);
      if (!auth) return json(res, 401, { error: '未登录' });
      if (auth.member.role !== 'admin') return json(res, 403, { error: '仅管理员可修改 AI 配置' });
      const body = await readJson(req);
      const settings = saveAiSettings(
        auth.familyId,
        {
          enabled: body.enabled,
          baseUrl: body.baseUrl,
          apiKey: body.apiKey,
          clearApiKey: !!body.clearApiKey,
          model: body.model,
        },
        auth.member.id
      );
      return json(res, 200, { settings });
    }

    if (req.method === 'GET' && pathname === '/api/insights/latest') {
      const auth = getAuth(req);
      if (!auth) return json(res, 401, { error: '未登录' });
      const row = latestInsightReport(auth.familyId);
      if (!row) {
        // soft empty: return rule snapshot without persisting when never run
        const stats = buildInsightStats(auth.familyId);
        return json(res, 200, {
          report: null,
          preview: {
            stats,
            cards: [],
            status: 'empty',
            generatedAt: null,
          },
        });
      }
      const report = publicInsightReport(row);
      // children only see their own member stats slice
      if (auth.member.role === 'child' && report?.stats?.memberStats) {
        report.stats = {
          ...report.stats,
          memberStats: report.stats.memberStats.filter((m) => m.memberId === auth.member.id),
        };
      }
      return json(res, 200, { report });
    }

    if (req.method === 'POST' && pathname === '/api/insights/run') {
      const auth = getAuth(req);
      if (!auth) return json(res, 401, { error: '未登录' });
      if (auth.member.role !== 'admin' && auth.member.role !== 'parent') {
        return json(res, 403, { error: '仅家长或管理员可手动生成洞察' });
      }
      const last = latestInsightReport(auth.familyId);
      if (last) {
        const age = Date.now() - new Date(last.generated_at).getTime();
        if (age < 60 * 60 * 1000 && process.env.LUCKYTODO_INSIGHT_NO_RATELIMIT !== '1') {
          return json(res, 429, {
            error: '手动刷新过于频繁，请约 1 小时后再试，或等待 12 小时定时任务',
            report: publicInsightReport(last),
          });
        }
      }
      const report = await runInsightJob(auth.familyId);
      return json(res, 200, { report });
    }

    if (req.method === 'POST' && pathname === '/api/setup/family') {
      const existing = db.prepare('SELECT id FROM families LIMIT 1').get();
      if (existing) return json(res, 409, { error: '家庭已创建，请直接登录' });
      const body = await readJson(req);
      const name = String(body.familyName || '').trim();
      const displayName = String(body.displayName || '').trim();
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (name.length < 1 || name.length > 20) return json(res, 400, { error: '家庭名称需 1–20 字' });
      if (displayName.length < 1 || displayName.length > 20) {
        return json(res, 400, { error: '显示名需 1–20 字' });
      }
      if (!/^[a-z0-9]{3,20}$/.test(username)) {
        return json(res, 400, { error: '用户名为 3–20 位小写字母或数字' });
      }
      if (password.length < 6 || password.length > 64) {
        return json(res, 400, { error: '密码需 6–64 位' });
      }

      const familyId = uuid();
      const memberId = uuid();
      const t = nowIso();
      db.prepare('INSERT INTO families(id, name, timezone, created_at) VALUES(?,?,?,?)').run(
        familyId,
        name,
        'Asia/Shanghai',
        t
      );
      db.prepare(
        `INSERT INTO members(id, family_id, display_name, username, password_hash, role, disabled, created_at, updated_at, revision)
         VALUES(?,?,?,?,?,?,0,?,?,1)`
      ).run(memberId, familyId, displayName, username, hashPassword(password), 'admin', t, t);

      const token = sessionToken();
      const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
      db.prepare(
        `INSERT INTO sessions(token, member_id, family_id, device_name, created_at, expires_at, last_seen_at)
         VALUES(?,?,?,?,?,?,?)`
      ).run(token, memberId, familyId, body.deviceName || 'device', t, expires, t);

      const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
      return json(res, 201, {
        token,
        expiresAt: expires,
        family: { id: familyId, name, timezone: 'Asia/Shanghai' },
        member: publicMember(member),
        serverRevision: getRevision(familyId),
      });
    }

    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const body = await readJson(req);
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      const member = db.prepare('SELECT * FROM members WHERE username = ?').get(username);
      if (!member || !verifyPassword(password, member.password_hash)) {
        return json(res, 401, { error: '账号或密码不正确' });
      }
      if (member.disabled) return json(res, 403, { error: '账号已停用，请联系家庭管理员' });

      // prune old sessions beyond 5
      const sessions = db
        .prepare('SELECT token FROM sessions WHERE member_id = ? ORDER BY last_seen_at DESC')
        .all(member.id);
      if (sessions.length >= 5) {
        for (const s of sessions.slice(4)) {
          db.prepare('DELETE FROM sessions WHERE token = ?').run(s.token);
        }
      }

      const token = sessionToken();
      const t = nowIso();
      const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
      db.prepare(
        `INSERT INTO sessions(token, member_id, family_id, device_name, created_at, expires_at, last_seen_at)
         VALUES(?,?,?,?,?,?,?)`
      ).run(token, member.id, member.family_id, body.deviceName || 'device', t, expires, t);

      const family = db.prepare('SELECT * FROM families WHERE id = ?').get(member.family_id);
      return json(res, 200, {
        token,
        expiresAt: expires,
        family: { id: family.id, name: family.name, timezone: family.timezone },
        member: publicMember(member),
        serverRevision: getRevision(member.family_id),
      });
    }

    if (req.method === 'POST' && pathname === '/api/auth/logout') {
      const auth = getAuth(req);
      if (auth) db.prepare('DELETE FROM sessions WHERE token = ?').run(auth.token);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'GET' && pathname === '/api/me') {
      const auth = getAuth(req);
      if (!auth) return json(res, 401, { error: '未登录' });
      const family = db.prepare('SELECT * FROM families WHERE id = ?').get(auth.familyId);
      const members = db
        .prepare('SELECT * FROM members WHERE family_id = ? AND deleted_at IS NULL')
        .all(auth.familyId)
        .map(publicMember);
      return json(res, 200, {
        family: { id: family.id, name: family.name, timezone: family.timezone },
        member: publicMember(auth.member),
        members,
        serverRevision: getRevision(auth.familyId),
      });
    }

    if (req.method === 'POST' && pathname === '/api/members') {
      const auth = getAuth(req);
      if (!auth) return json(res, 401, { error: '未登录' });
      if (auth.member.role !== 'admin') return json(res, 403, { error: '仅管理员可添加成员' });
      const body = await readJson(req);
      const displayName = String(body.displayName || '').trim();
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      const role = String(body.role || 'adult');
      if (!['parent', 'adult', 'child'].includes(role)) {
        return json(res, 400, { error: '角色无效' });
      }
      if (!/^[a-z0-9]{3,20}$/.test(username)) {
        return json(res, 400, { error: '用户名无效' });
      }
      if (password.length < 6) return json(res, 400, { error: '密码至少 6 位' });
      const dup = db
        .prepare('SELECT id FROM members WHERE family_id = ? AND username = ?')
        .get(auth.familyId, username);
      if (dup) return json(res, 409, { error: '用户名已存在' });
      const id = uuid();
      const t = nowIso();
      const revision = nextRevision(auth.familyId);
      db.prepare(
        `INSERT INTO members(id, family_id, display_name, username, password_hash, role, disabled, created_at, updated_at, revision)
         VALUES(?,?,?,?,?,?,0,?,?,?)`
      ).run(id, auth.familyId, displayName, username, hashPassword(password), role, t, t, revision);
      const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
      return json(res, 201, { member: publicMember(member) });
    }

    if (req.method === 'PATCH' && pathname.startsWith('/api/members/')) {
      const auth = getAuth(req);
      if (!auth) return json(res, 401, { error: '未登录' });
      const id = pathname.split('/').pop();
      const target = db.prepare('SELECT * FROM members WHERE id = ? AND family_id = ?').get(id, auth.familyId);
      if (!target) return json(res, 404, { error: '成员不存在' });
      const body = await readJson(req);
      const t = nowIso();
      const revision = nextRevision(auth.familyId);

      if (body.password && auth.member.role === 'admin' && id !== auth.member.id) {
        db.prepare('UPDATE members SET password_hash = ?, updated_at = ?, revision = ? WHERE id = ?').run(
          hashPassword(body.password),
          t,
          revision,
          id
        );
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
      if (body.currentPassword && body.newPassword && id === auth.member.id) {
        if (!verifyPassword(body.currentPassword, target.password_hash)) {
          return json(res, 400, { error: '当前密码不正确' });
        }
        db.prepare('UPDATE members SET password_hash = ?, updated_at = ?, revision = ? WHERE id = ?').run(
          hashPassword(body.newPassword),
          t,
          revision,
          id
        );
      }

      const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
      return json(res, 200, { member: publicMember(member) });
    }

    if (req.method === 'POST' && pathname === '/api/sync/push') {
      const auth = getAuth(req);
      if (!auth) return json(res, 401, { error: '未登录' });
      const body = await readJson(req);
      const ops = Array.isArray(body.ops) ? body.ops : [];
      const results = [];
      const members = memberMap(auth.familyId);

      for (const op of ops) {
        const entityType = op.entityType;
        const id = op.id || uuid();
        if (!['note', 'todo', 'event', 'plan', 'checkin', 'attachment_meta'].includes(entityType)) {
          results.push({ opId: op.opId, ok: false, error: 'unsupported type' });
          continue;
        }
        const existing = db.prepare('SELECT * FROM entities WHERE id = ?').get(id);
        if (existing && existing.family_id !== auth.familyId) {
          results.push({ opId: op.opId, ok: false, error: 'forbidden' });
          continue;
        }

        // LWW: if server newer, reject overwrite but return server copy
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
      const auth = getAuth(req);
      if (!auth) return json(res, 401, { error: '未登录' });
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
      const auth = getAuth(req);
      if (!auth) return json(res, 401, { error: '未登录' });
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

      const purpose = meta.purpose || 'attachment'; // avatar | attachment
      const id = meta.mediaId || uuid();
      const safeName = (filePart.filename || 'file').replace(/[^\w.\-()\u4e00-\u9fff]+/g, '_');
      const folder = purpose === 'avatar' ? 'avatars' : 'attachments';
      const rel = path.join(folder, `${id}_${safeName}`);
      const abs = path.join(MEDIA_DIR, rel);
      fs.writeFileSync(abs, filePart.data);

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
          (auth.member.role === 'admin' || auth.member.role === 'parent');
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
      const auth = getAuth(req);
      if (!auth) return json(res, 401, { error: '未登录' });
      const id = pathname.slice('/api/media/'.length);
      const media = db.prepare('SELECT * FROM media WHERE id = ? AND family_id = ?').get(id, auth.familyId);
      if (!media) return json(res, 404, { error: '文件不存在' });
      const abs = path.join(MEDIA_DIR, media.rel_path);
      if (!fs.existsSync(abs)) return json(res, 404, { error: '文件丢失' });
      const data = fs.readFileSync(abs);
      res.writeHead(200, {
        'Content-Type': media.mime_type,
        'Content-Length': data.length,
        'Cache-Control': 'private, max-age=3600',
      });
      res.end(data);
      return;
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/media/')) {
      const auth = getAuth(req);
      if (!auth) return json(res, 401, { error: '未登录' });
      const id = pathname.slice('/api/media/'.length);
      const media = db.prepare('SELECT * FROM media WHERE id = ? AND family_id = ?').get(id, auth.familyId);
      if (!media) return json(res, 404, { error: '文件不存在' });
      if (media.created_by !== auth.member.id && auth.member.role !== 'admin') {
        return json(res, 403, { error: '无权删除' });
      }
      try {
        fs.unlinkSync(path.join(MEDIA_DIR, media.rel_path));
      } catch {
        /* ignore */
      }
      db.prepare('DELETE FROM media WHERE id = ?').run(id);
      // clear avatar refs
      db.prepare(
        'UPDATE members SET avatar_media_id = NULL, avatar_updated_at = ?, updated_at = ?, revision = ? WHERE avatar_media_id = ?'
      ).run(nowIso(), nowIso(), nextRevision(auth.familyId), id);
      return json(res, 200, { ok: true });
    }

    if (tryServeStatic(req, res, pathname)) return;

    return json(res, 404, { error: 'not found' });
  } catch (err) {
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
