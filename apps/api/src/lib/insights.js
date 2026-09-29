/** AI insights: aggregate family data, call OpenAI-compatible API, store reports. */
import { db } from './db.js';
import { uuid, nowIso } from './util.js';

const INTERVAL_MS = Number(process.env.INSIGHT_INTERVAL_MS || 12 * 60 * 60 * 1000);

export function ensureInsightTables() {
  db.exec(`
CREATE TABLE IF NOT EXISTS family_ai_settings (
  family_id TEXT PRIMARY KEY REFERENCES families(id),
  enabled INTEGER NOT NULL DEFAULT 0,
  base_url TEXT,
  api_key TEXT,
  model TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS insight_reports (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'family',
  member_id TEXT,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  stats_json TEXT NOT NULL,
  cards_json TEXT NOT NULL,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  error TEXT,
  generated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_insight_family_time ON insight_reports(family_id, generated_at);
`);
}

function envDefaults() {
  return {
    enabled: process.env.AI_ENABLED === '1' || process.env.AI_ENABLED === 'true',
    baseUrl: (process.env.AI_BASE_URL || '').replace(/\/$/, ''),
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'deepseek-chat',
  };
}

export function getAiSettings(familyId) {
  const row = db.prepare('SELECT * FROM family_ai_settings WHERE family_id = ?').get(familyId);
  const env = envDefaults();
  if (!row) {
    return {
      enabled: env.enabled,
      baseUrl: env.baseUrl,
      apiKey: env.apiKey ? '********' : '',
      apiKeySet: !!env.apiKey,
      model: env.model,
      source: 'env',
      updatedAt: null,
    };
  }
  const key = row.api_key || env.apiKey;
  return {
    enabled: !!row.enabled,
    baseUrl: row.base_url || env.baseUrl,
    apiKey: key ? '********' : '',
    apiKeySet: !!key,
    model: row.model || env.model,
    source: 'db',
    updatedAt: row.updated_at,
  };
}

/** Internal: raw key for calling the model (never send to clients). */
export function resolveAiConfig(familyId) {
  const row = db.prepare('SELECT * FROM family_ai_settings WHERE family_id = ?').get(familyId);
  const env = envDefaults();
  const enabled = row ? !!row.enabled : env.enabled;
  const baseUrl = ((row?.base_url || env.baseUrl) || '').replace(/\/$/, '');
  const apiKey = row?.api_key || env.apiKey || '';
  const model = row?.model || env.model || 'deepseek-chat';
  return { enabled, baseUrl, apiKey, model };
}

export function saveAiSettings(familyId, patch, updatedBy) {
  const current = db.prepare('SELECT * FROM family_ai_settings WHERE family_id = ?').get(familyId);
  const env = envDefaults();
  const enabled =
    patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : current ? current.enabled : env.enabled ? 1 : 0;
  const baseUrl =
    patch.baseUrl !== undefined
      ? String(patch.baseUrl || '').trim().replace(/\/$/, '')
      : current?.base_url || env.baseUrl;
  let apiKey = current?.api_key || env.apiKey || '';
  if (patch.apiKey !== undefined && patch.apiKey !== '' && patch.apiKey !== '********') {
    apiKey = String(patch.apiKey);
  }
  if (patch.clearApiKey) apiKey = '';
  const model =
    patch.model !== undefined ? String(patch.model || '').trim() : current?.model || env.model;
  const t = nowIso();
  db.prepare(
    `INSERT INTO family_ai_settings(family_id, enabled, base_url, api_key, model, updated_at, updated_by)
     VALUES(?,?,?,?,?,?,?)
     ON CONFLICT(family_id) DO UPDATE SET
       enabled=excluded.enabled,
       base_url=excluded.base_url,
       api_key=excluded.api_key,
       model=excluded.model,
       updated_at=excluded.updated_at,
       updated_by=excluded.updated_by`
  ).run(familyId, enabled, baseUrl || null, apiKey || null, model || null, t, updatedBy || null);
  return getAiSettings(familyId);
}

function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parsePayload(row) {
  try {
    return JSON.parse(row.payload);
  } catch {
    return {};
  }
}

/** Build redacted stats for the model (no note bodies, no attachments). */
export function buildInsightStats(familyId) {
  const members = db
    .prepare('SELECT id, display_name, role FROM members WHERE family_id = ? AND deleted_at IS NULL AND disabled = 0')
    .all(familyId);
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const periodEnd = nowIso();
  const periodStart = since;

  const entities = db
    .prepare(
      `SELECT * FROM entities WHERE family_id = ? AND deleted_at IS NULL
       AND entity_type IN ('plan','todo','checkin','event')`
    )
    .all(familyId);

  const memberStats = members.map((m) => {
    const checkins = entities.filter((e) => {
      if (e.entity_type !== 'checkin') return false;
      const p = parsePayload(e);
      return p.memberId === m.id && e.updated_at >= since;
    });
    const done = checkins.filter((e) => parsePayload(e).status === 'done').length;
    const openTodos = entities.filter((e) => {
      if (e.entity_type !== 'todo') return false;
      const p = parsePayload(e);
      const assignees = p.assigneeIds || [];
      if (!assignees.includes(m.id) && p.createdBy !== m.id) return false;
      return (p.completions || {})[m.id] !== 'done';
    });
    return {
      memberId: m.id,
      name: m.display_name,
      role: m.role,
      checkinDone: done,
      checkinTotal: checkins.length,
      rate: checkins.length ? Math.round((done / checkins.length) * 100) : null,
      openTodoCount: openTodos.length,
      openTodoTitles: openTodos.slice(0, 5).map((e) => parsePayload(e).title || '待办'),
    };
  });

  const plans = entities
    .filter((e) => e.entity_type === 'plan' && !parsePayload(e).archived)
    .map((e) => {
      const p = parsePayload(e);
      return {
        title: p.title || '计划',
        executorCount: (p.executorIds || []).length,
        milestoneOpen: (p.milestones || []).filter((ms) => ms.status !== 'done').length,
      };
    });

  const upcomingEvents = entities
    .filter((e) => e.entity_type === 'event')
    .map((e) => parsePayload(e))
    .filter((p) => p.startAt && p.startAt >= periodStart)
    .slice(0, 8)
    .map((p) => ({ title: p.title || '日程', startAt: p.startAt }));

  return {
    periodStart,
    periodEnd,
    day: dayKey(),
    memberStats,
    planCount: plans.length,
    plans: plans.slice(0, 10),
    upcomingEvents,
  };
}

function ruleBasedCards(stats) {
  const cards = [];
  const ranked = stats.memberStats
    .filter((m) => m.checkinTotal > 0)
    .slice()
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
  const best = ranked[0];
  const weak = ranked.slice().sort((a, b) => (a.rate ?? 100) - (b.rate ?? 100))[0];
  if (best && best.rate != null) {
    cards.push({
      tag: '高光',
      title: `${best.name} 近 7 日完成率 ${best.rate}%`,
      body: `${best.checkinDone}/${best.checkinTotal} 次打卡完成。保持当前节奏即可。`,
    });
  }
  if (weak && weak.checkinTotal && (weak.rate ?? 100) < 60) {
    cards.push({
      tag: '风险',
      title: `${weak.name} 完成率偏低`,
      body: '可把提醒调到更方便的时段，或把计划拆短一点。',
    });
  }
  const openSum = stats.memberStats.reduce((n, m) => n + m.openTodoCount, 0);
  if (openSum > 0) {
    const first = stats.memberStats.find((m) => m.openTodoCount > 0);
    cards.push({
      tag: '待办',
      title: `家庭还有 ${openSum} 条未完成待办`,
      body: first?.openTodoTitles?.[0]
        ? `可从「${first.openTodoTitles[0]}」开始清理。`
        : '优先处理今天到期的事项。',
    });
  }
  if (!cards.length) {
    cards.push({
      tag: '起步',
      title: '数据还不够形成趋势',
      body: '先坚持几天打卡，定时洞察会根据完成率自动更新。',
    });
  }
  return cards.slice(0, 5);
}

async function callChatModel(cfg, stats) {
  const url = `${cfg.baseUrl}/chat/completions`;
  const system = `你是家庭待办助手 LuckyTodo 的洞察分析员。根据给定 JSON 统计，输出 2～5 条中文建议卡片。
只返回 JSON 数组，不要 markdown。每项字段：tag（高光|风险|待办|协作|节奏）、title（≤28字）、body（≤80字）。
不要编造统计里没有的人名或数字；语气温和、可执行。`;
  const user = `统计数据：\n${JSON.stringify(stats)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error?.message || data.message || `模型请求失败 ${res.status}`);
    }
    const text = data.choices?.[0]?.message?.content || '';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('模型未返回 JSON 数组');
    const cards = JSON.parse(match[0]);
    if (!Array.isArray(cards) || !cards.length) throw new Error('模型返回为空');
    return cards
      .slice(0, 6)
      .map((c) => ({
        tag: String(c.tag || '建议').slice(0, 8),
        title: String(c.title || '洞察').slice(0, 40),
        body: String(c.body || '').slice(0, 120),
      }))
      .filter((c) => c.body);
  } finally {
    clearTimeout(timer);
  }
}

export function latestInsightReport(familyId) {
  return db
    .prepare(
      `SELECT * FROM insight_reports WHERE family_id = ? AND scope = 'family'
       ORDER BY generated_at DESC LIMIT 1`
    )
    .get(familyId);
}

export function publicInsightReport(row) {
  if (!row) return null;
  return {
    id: row.id,
    familyId: row.family_id,
    scope: row.scope,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    stats: JSON.parse(row.stats_json),
    cards: JSON.parse(row.cards_json),
    model: row.model,
    status: row.status,
    error: row.error,
    generatedAt: row.generated_at,
  };
}

export async function runInsightJob(familyId, { forceModel = true } = {}) {
  ensureInsightTables();
  const stats = buildInsightStats(familyId);
  const cfg = resolveAiConfig(familyId);
  let cards = ruleBasedCards(stats);
  let status = 'rules';
  let error = null;
  let model = null;

  if (cfg.enabled && cfg.baseUrl && cfg.apiKey && forceModel) {
    try {
      cards = await callChatModel(cfg, stats);
      status = 'ok';
      model = cfg.model;
    } catch (e) {
      status = 'fallback';
      error = e.message || String(e);
      model = cfg.model;
      cards = ruleBasedCards(stats);
    }
  } else if (!cfg.enabled || !cfg.baseUrl || !cfg.apiKey) {
    status = 'rules';
    error = cfg.enabled ? '未配置完整的模型地址或密钥' : 'AI 洞察未启用，已使用规则生成';
  }

  const id = uuid();
  const t = nowIso();
  db.prepare(
    `INSERT INTO insight_reports(
      id, family_id, scope, member_id, period_start, period_end,
      stats_json, cards_json, model, status, error, generated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    familyId,
    'family',
    null,
    stats.periodStart,
    stats.periodEnd,
    JSON.stringify(stats),
    JSON.stringify(cards),
    model,
    status,
    error,
    t
  );

  // keep last 30 reports per family
  const old = db
    .prepare(
      `SELECT id FROM insight_reports WHERE family_id = ? ORDER BY generated_at DESC LIMIT -1 OFFSET 30`
    )
    .all(familyId);
  for (const r of old) {
    db.prepare('DELETE FROM insight_reports WHERE id = ?').run(r.id);
  }

  return publicInsightReport(latestInsightReport(familyId));
}

export async function runInsightJobsForAllFamilies() {
  ensureInsightTables();
  const families = db.prepare('SELECT id FROM families').all();
  const results = [];
  for (const f of families) {
    try {
      results.push({ familyId: f.id, report: await runInsightJob(f.id) });
    } catch (e) {
      results.push({ familyId: f.id, error: e.message || String(e) });
    }
  }
  return results;
}

let timer = null;
let running = false;

export function startInsightScheduler() {
  ensureInsightTables();
  if (process.env.LUCKYTODO_NO_LISTEN === '1') return;
  if (timer) return;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const r = await runInsightJobsForAllFamilies();
      console.log(`[insights] scheduled run done: ${r.length} families`);
    } catch (e) {
      console.warn('[insights] scheduled run failed', e);
    } finally {
      running = false;
    }
  };
  // first run shortly after boot, then every 12h
  setTimeout(tick, 15_000);
  timer = setInterval(tick, INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
  console.log(`[insights] scheduler started, interval=${INTERVAL_MS}ms`);
}

export { INTERVAL_MS };
