import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'node:http';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'luckytodo-'));
process.env.LUCKYTODO_DATA = tmp;
process.env.LUCKYTODO_NO_LISTEN = '1';
process.env.LUCKYTODO_TEST_OTP = '123456';

const { handle } = await import('../src/index.js');

function listen() {
  const server = createServer((req, res) => handle(req, res));
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

async function req(base, method, urlPath, { token, body } = {}) {
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

describe('LuckyTodo cloud API v005', () => {
  let server;
  let base;
  let tokenA;
  let tokenB;
  let memberA;

  before(async () => {
    ({ server, base } = await listen());
  });

  after(async () => {
    await new Promise((r) => server.close(r));
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* Windows may lock sqlite briefly */
    }
  });

  it('health reports cloud mode', async () => {
    const res = await req(base, 'GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.json.mode, 'cloud');
    assert.equal(res.json.version, '0.5.0');
  });

  it('setup/family is gone', async () => {
    const res = await req(base, 'POST', '/api/setup/family', {
      body: { familyName: 'x', displayName: 'y', username: 'abc', password: 'secret12' },
    });
    assert.equal(res.status, 410);
  });

  it('registers user by phone', async () => {
    const res = await req(base, 'POST', '/api/auth/register', {
      body: {
        phone: '13800138000',
        password: 'secret12',
        displayName: '林晨',
        agreed: true,
      },
    });
    assert.equal(res.status, 201);
    tokenA = res.json.token;
    assert.ok(tokenA);
    assert.equal(res.json.user.phone, '13800138000');
    assert.equal(res.json.family, null);
  });

  it('creates family', async () => {
    const res = await req(base, 'POST', '/api/families', {
      token: tokenA,
      body: { familyName: '林家' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.json.family.name, '林家');
    memberA = res.json.member.id;
    assert.equal(res.json.member.role, 'admin');
  });

  it('creates invite and second user joins', async () => {
    const invite = await req(base, 'POST', '/api/invites', {
      token: tokenA,
      body: { role: 'adult' },
    });
    assert.equal(invite.status, 201);
    const code = invite.json.invite.code;

    const reg = await req(base, 'POST', '/api/auth/register', {
      body: {
        phone: '13900139000',
        password: 'secret12',
        displayName: '周宁',
        agreed: true,
      },
    });
    assert.equal(reg.status, 201);
    tokenB = reg.json.token;

    const join = await req(base, 'POST', '/api/invites/accept', {
      token: tokenB,
      body: { code },
    });
    assert.equal(join.status, 200);
    assert.equal(join.json.family.name, '林家');
    assert.equal(join.json.member.role, 'adult');
  });

  it('otp login works with test code', async () => {
    const send = await req(base, 'POST', '/api/auth/otp/send', {
      body: { phone: '13700137000' },
    });
    assert.equal(send.status, 200);
    const verify = await req(base, 'POST', '/api/auth/otp/verify', {
      body: { phone: '13700137000', code: '123456', displayName: '验证用户', agreed: true },
    });
    assert.equal(verify.status, 200);
    assert.ok(verify.json.token);
  });

  it('syncs a note after join', async () => {
    const noteId = crypto.randomUUID();
    const push = await req(base, 'POST', '/api/sync/push', {
      token: tokenA,
      body: {
        ops: [
          {
            opId: '1',
            id: noteId,
            entityType: 'note',
            updatedAt: new Date().toISOString(),
            payload: {
              title: '报销材料',
              body: '书房抽屉',
              visibility: 'self',
              pinned: true,
              createdBy: memberA,
            },
          },
        ],
      },
    });
    assert.equal(push.status, 200);
    assert.equal(push.json.results[0].ok, true);

    const pull = await req(base, 'GET', '/api/sync/pull?since=0', { token: tokenA });
    assert.equal(pull.status, 200);
    assert.ok(pull.json.entities.some((e) => e.id === noteId));
  });

  it('adds child member', async () => {
    const add = await req(base, 'POST', '/api/members/child', {
      token: tokenA,
      body: { displayName: '林小满', password: 'child12' },
    });
    assert.equal(add.status, 201);
    assert.equal(add.json.member.role, 'child');
    assert.ok(add.json.childLogin.username);

    const login = await req(base, 'POST', '/api/auth/login', {
      body: { username: add.json.childLogin.username, password: 'child12' },
    });
    assert.equal(login.status, 200);
    assert.equal(login.json.member.role, 'child');
  });

  it('exports family data', async () => {
    const res = await req(base, 'GET', '/api/families/export', { token: tokenA });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json.entities));
    assert.ok(res.json.family.name);
  });

  it('registers push token placeholder', async () => {
    const res = await req(base, 'POST', '/api/devices/push-token', {
      token: tokenA,
      body: { token: 'fake-apns-token', platform: 'ios' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.ok, true);
  });

  it('saves AI settings and runs insight', async () => {
    process.env.LUCKYTODO_INSIGHT_NO_RATELIMIT = '1';
    const put = await req(base, 'PUT', '/api/settings/ai', {
      token: tokenA,
      body: {
        enabled: false,
        baseUrl: 'https://example.invalid/v1',
        model: 'test-model',
        apiKey: 'sk-test',
      },
    });
    assert.equal(put.status, 200);
    const run = await req(base, 'POST', '/api/insights/run', { token: tokenA });
    assert.equal(run.status, 200);
    assert.ok(run.json.report);
  });
});
