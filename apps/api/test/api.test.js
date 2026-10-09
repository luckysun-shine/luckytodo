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

  it('changes own password and signs out other devices', async () => {
    const reg = await req(base, 'POST', '/api/auth/register', {
      body: { phone: '13600001111', password: 'secret12', displayName: '改密', agreed: true },
    });
    assert.equal(reg.status, 201);
    const other = await req(base, 'POST', '/api/auth/login', {
      body: { phone: '13600001111', password: 'secret12' },
    });
    const bad = await req(base, 'POST', '/api/auth/password/change', {
      token: reg.json.token,
      body: { currentPassword: 'wrong-pass', password: 'newsecret' },
    });
    assert.equal(bad.status, 401);
    const ok = await req(base, 'POST', '/api/auth/password/change', {
      token: reg.json.token,
      body: { currentPassword: 'secret12', password: 'newsecret' },
    });
    assert.equal(ok.status, 200);
    const oldLogin = await req(base, 'POST', '/api/auth/login', {
      body: { phone: '13600001111', password: 'secret12' },
    });
    assert.equal(oldLogin.status, 401);
    const next = await req(base, 'POST', '/api/auth/login', {
      body: { phone: '13600001111', password: 'newsecret' },
    });
    assert.equal(next.status, 200);
    assert.equal((await req(base, 'GET', '/api/me', { token: reg.json.token })).status, 200);
    assert.equal((await req(base, 'GET', '/api/me', { token: other.json.token })).status, 401);
  });

  it('lets admin or parent reset a member, not themselves or peers', async () => {
    const me = await req(base, 'GET', '/api/me', { token: tokenA });
    const child = me.json.members.find((m) => m.role === 'child');
    const adult = me.json.members.find((m) => m.role === 'adult');
    assert.ok(child?.username);
    assert.ok(adult);
    const self = await req(base, 'PATCH', `/api/members/${me.json.member.id}`, {
      token: tokenA,
      body: { password: 'secret99' },
    });
    assert.equal(self.status, 400);
    const byAdult = await req(base, 'PATCH', `/api/members/${child.id}`, {
      token: tokenB,
      body: { password: 'child99' },
    });
    assert.equal(byAdult.status, 403);
    const byAdmin = await req(base, 'PATCH', `/api/members/${child.id}`, {
      token: tokenA,
      body: { password: 'child99' },
    });
    assert.equal(byAdmin.status, 200);
    assert.equal(
      (await req(base, 'POST', '/api/auth/login', {
        body: { username: child.username, password: 'child12' },
      })).status,
      401
    );
    const promote = await req(base, 'PATCH', `/api/members/${adult.id}`, {
      token: tokenA,
      body: { role: 'parent' },
    });
    assert.equal(promote.status, 200);
    const byParent = await req(base, 'PATCH', `/api/members/${child.id}`, {
      token: tokenB,
      body: { password: 'child77' },
    });
    assert.equal(byParent.status, 200);
    const parentOnAdmin = await req(base, 'PATCH', `/api/members/${me.json.member.id}`, {
      token: tokenB,
      body: { password: 'nope1234' },
    });
    assert.equal(parentOnAdmin.status, 403);
    const login = await req(base, 'POST', '/api/auth/login', {
      body: { username: child.username, password: 'child77' },
    });
    assert.equal(login.status, 200);
  });

  it('resets a phone password only with a real sms code', async () => {
    const hits = [];
    const hook = createServer((req2, res) => {
      let raw = '';
      req2.on('data', (chunk) => {
        raw += chunk;
      });
      req2.on('end', () => {
        hits.push(JSON.parse(raw || '{}'));
        res.writeHead(200);
        res.end('ok');
      });
    });
    await new Promise((resolve) => hook.listen(0, '127.0.0.1', resolve));
    process.env.LUCKYTODO_SMS_WEBHOOK = `http://127.0.0.1:${hook.address().port}/sms`;
    try {
      assert.equal((await req(base, 'GET', '/api/health')).json.smsReset, true);
      const unknown = await req(base, 'POST', '/api/auth/password/forgot', {
        body: { phone: '13600002222' },
      });
      assert.equal(unknown.status, 200);
      assert.equal(unknown.json.message, '若该号码已注册，验证码已发送');
      assert.equal(hits.length, 0);

      const phone = '13600003333';
      const reg = await req(base, 'POST', '/api/auth/register', {
        body: { phone, password: 'secret12', displayName: '找回', agreed: true },
      });
      assert.equal(reg.status, 201);
      const sent = await req(base, 'POST', '/api/auth/password/forgot', { body: { phone } });
      assert.equal(sent.status, 200);
      assert.equal(sent.json.message, unknown.json.message);
      assert.equal(hits.length, 1);
      assert.equal(hits[0].purpose, 'password-reset');
      assert.match(hits[0].code, /^\d{6}$/);
      const cooled = await req(base, 'POST', '/api/auth/password/forgot', { body: { phone } });
      assert.equal(cooled.status, 429);
      const wrongCode = hits[0].code === '000000' ? '111111' : '000000';
      const testCode = await req(base, 'POST', '/api/auth/password/reset', {
        body: { phone, code: wrongCode, password: 'brandnew' },
      });
      assert.equal(testCode.status, 401);
      const ok = await req(base, 'POST', '/api/auth/password/reset', {
        body: { phone, code: hits[0].code, password: 'brandnew' },
      });
      assert.equal(ok.status, 200);
      assert.equal(
        (await req(base, 'POST', '/api/auth/login', { body: { phone, password: 'secret12' } })).status,
        401
      );
      assert.equal(
        (await req(base, 'POST', '/api/auth/login', { body: { phone, password: 'brandnew' } })).status,
        200
      );
      assert.equal((await req(base, 'GET', '/api/me', { token: reg.json.token })).status, 401);

      const phone2 = '13600004444';
      assert.equal(
        (await req(base, 'POST', '/api/auth/register', {
          body: { phone: phone2, password: 'secret12', displayName: '锁定', agreed: true },
        })).status,
        201
      );
      assert.equal(
        (await req(base, 'POST', '/api/auth/password/forgot', { body: { phone: phone2 } })).status,
        200
      );
      for (let i = 0; i < 4; i += 1) {
        const miss = await req(base, 'POST', '/api/auth/password/reset', {
          body: { phone: phone2, code: '000000', password: 'brandnew' },
        });
        assert.equal(miss.status, 401);
      }
      const locked = await req(base, 'POST', '/api/auth/password/reset', {
        body: { phone: phone2, code: '000000', password: 'brandnew' },
      });
      assert.equal(locked.status, 429);
    } finally {
      delete process.env.LUCKYTODO_SMS_WEBHOOK;
      await new Promise((resolve) => hook.close(resolve));
    }
  });

  it('refuses forgot-password when sms is not configured', async () => {
    delete process.env.LUCKYTODO_SMS_WEBHOOK;
    const res = await req(base, 'POST', '/api/auth/password/forgot', {
      body: { phone: '13600003333' },
    });
    assert.equal(res.status, 503);
    assert.equal(res.json.smsReset, false);
  });
});
