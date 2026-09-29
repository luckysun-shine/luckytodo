import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'node:http';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'luckytodo-'));
process.env.LUCKYTODO_DATA = tmp;
process.env.LUCKYTODO_NO_LISTEN = '1';

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

async function req(base, method, urlPath, { token, body, headers } = {}) {
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
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

describe('LuckyTodo API', () => {
  let server;
  let base;
  let token;
  let memberId;

  before(async () => {
    ({ server, base } = await listen());
  });

  after(async () => {
    await new Promise((r) => server.close(r));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('health before setup', async () => {
    const res = await req(base, 'GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.json.initialized, false);
  });

  it('creates family', async () => {
    const res = await req(base, 'POST', '/api/setup/family', {
      body: {
        familyName: '林家',
        displayName: '林晨',
        username: 'linchen',
        password: 'secret12',
      },
    });
    assert.equal(res.status, 201);
    token = res.json.token;
    memberId = res.json.member.id;
    assert.ok(token);
  });

  it('rejects second family', async () => {
    const res = await req(base, 'POST', '/api/setup/family', {
      body: {
        familyName: '别家',
        displayName: 'X',
        username: 'xxx',
        password: 'secret12',
      },
    });
    assert.equal(res.status, 409);
  });

  it('syncs a note and pulls it', async () => {
    const noteId = crypto.randomUUID();
    const push = await req(base, 'POST', '/api/sync/push', {
      token,
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
              createdBy: memberId,
            },
          },
        ],
      },
    });
    assert.equal(push.status, 200);
    assert.equal(push.json.results[0].ok, true);

    const pull = await req(base, 'GET', '/api/sync/pull?since=0', { token });
    assert.equal(pull.status, 200);
    assert.ok(pull.json.entities.some((e) => e.id === noteId));
  });

  it('adds member and login', async () => {
    const add = await req(base, 'POST', '/api/members', {
      token,
      body: {
        displayName: '林小满',
        username: 'xiaoman',
        password: 'child12',
        role: 'child',
      },
    });
    assert.equal(add.status, 201);

    const login = await req(base, 'POST', '/api/auth/login', {
      body: { username: 'xiaoman', password: 'child12' },
    });
    assert.equal(login.status, 200);
    assert.equal(login.json.member.role, 'child');
  });
});
