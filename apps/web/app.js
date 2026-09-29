import { css } from './src/styles.js';
import * as api from './src/api.js';
import * as db from './src/db.js';
import * as reminders from './src/reminders.js';

const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);

const root = document.getElementById('app');
const state = {
  tab: 'today',
  online: navigator.onLine,
  theme: localStorage.getItem('lt_theme') || 'night',
  font: localStorage.getItem('lt_font') || 'standard',
  toastTimer: null,
  screen: 'boot',
  form: null,
  members: [],
};

window.addEventListener('online', () => {
  state.online = true;
  render();
  maybeSync();
});
window.addEventListener('offline', () => {
  state.online = false;
  render();
});

function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function applyChrome() {
  root.dataset.theme = state.theme;
  root.dataset.font = state.font;
}

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

async function loadMembers() {
  state.members = (await db.kvGet('members', [])) || [];
  const me = api.getMember();
  if (me && !state.members.find((m) => m.id === me.id)) state.members.unshift(me);
}

async function maybeSync() {
  if (!api.getToken() || !state.online) return;
  try {
    await api.syncNow();
    await loadMembers();
    const all = await db.allEntities();
    reminders.reschedule(all).catch(() => {});
  } catch (e) {
    if (!e.offline) console.warn(e);
  }
}

async function afterLogin(session) {
  api.setSession(session);
  await db.kvSet('serverRevision', session.serverRevision || 0);
  const guestCount = await api.countGuestRecords();
  if (guestCount > 0) {
    state.screen = 'merge';
    state.mergeCount = guestCount;
    render();
    return;
  }
  state.screen = 'home';
  await maybeSync();
  render();
}

function roleLabel(role) {
  return { admin: '管理员', parent: '家长', adult: '成人', child: '儿童' }[role] || role;
}

async function boot() {
  applyChrome();
  const server = api.apiBase();
  if (!server) {
    state.screen = 'connect';
    render();
    return;
  }
  if (!api.getToken()) {
    // allow guest local use
    try {
      const health = await api.health();
      state.health = health;
      state.screen = health.initialized ? 'login' : 'setup';
    } catch {
      state.screen = 'home'; // offline guest
      state.guestMode = true;
    }
    render();
    return;
  }
  state.screen = 'home';
  await loadMembers();
  render();
  maybeSync().then(render);
}

function renderConnect() {
  const urlInput = h('input', {
    value: api.apiBase() || 'https://',
    placeholder: 'https://todo.home.example.com',
    autocomplete: 'url',
  });
  return h('div', { className: 'screen' }, [
    h('div', { className: 'top' }, [h('h1', { text: 'LuckyTodo' })]),
    h('div', { className: 'scroller' }, [
      h('p', { className: 'muted', text: '填写飞牛上已配置 HTTPS 的家庭服务地址。' }),
      h('div', { className: 'field' }, [h('label', { text: '服务器地址' }), urlInput]),
      h('button', {
        className: 'btn',
        text: '检查连接',
        onClick: async () => {
          const url = urlInput.value.trim().replace(/\/$/, '');
          if (!/^https:\/\//i.test(url) && location.protocol === 'https:') {
            toast('生产环境需使用 HTTPS 地址');
            // still allow http for local dev
          }
          api.setApiBase(url);
          try {
            const health = await api.health();
            toast(health.initialized ? '已连接，请登录' : '已连接，可创建家庭');
            state.health = health;
            state.screen = health.initialized ? 'login' : 'setup';
            render();
          } catch (e) {
            toast(e.message || '连接失败');
          }
        },
      }),
      h('button', {
        className: 'btn secondary',
        style: 'margin-top:10px;width:100%',
        text: '先在本机使用（不登录）',
        onClick: () => {
          state.guestMode = true;
          state.screen = 'home';
          render();
        },
      }),
    ]),
  ]);
}

function renderSetup() {
  const fields = {};
  const field = (key, label, type = 'text') => {
    fields[key] = h('input', { type, autocomplete: key.includes('pass') ? 'new-password' : 'off' });
    return h('div', { className: 'field' }, [h('label', { text: label }), fields[key]]);
  };
  return h('div', { className: 'screen' }, [
    h('div', { className: 'top' }, [
      h('button', { className: 'btn ghost', text: '返回', onClick: () => { state.screen = 'connect'; render(); } }),
      h('h1', { text: '创建家庭' }),
    ]),
    h('div', { className: 'scroller' }, [
      field('familyName', '家庭名称'),
      field('displayName', '你的显示名'),
      field('username', '用户名'),
      field('password', '密码', 'password'),
      field('password2', '确认密码', 'password'),
      h('p', { className: 'muted', text: '时区：中国标准时间（固定）' }),
      h('button', {
        className: 'btn',
        text: '创建并进入',
        onClick: async () => {
          if (fields.password.value !== fields.password2.value) return toast('两次密码不一致');
          try {
            const session = await api.api('POST', '/api/setup/family', {
              token: '',
              body: {
                familyName: fields.familyName.value,
                displayName: fields.displayName.value,
                username: fields.username.value,
                password: fields.password.value,
              },
            });
            await afterLogin(session);
          } catch (e) {
            toast(e.message);
          }
        },
      }),
    ]),
  ]);
}

function renderLogin() {
  const user = h('input', { autocomplete: 'username' });
  const pass = h('input', { type: 'password', autocomplete: 'current-password' });
  return h('div', { className: 'screen' }, [
    h('div', { className: 'top' }, [
      h('button', { className: 'btn ghost', text: '更换服务器', onClick: () => { state.screen = 'connect'; render(); } }),
      h('h1', { text: '登录' }),
    ]),
    h('div', { className: 'scroller' }, [
      h('div', { className: 'field' }, [h('label', { text: '用户名' }), user]),
      h('div', { className: 'field' }, [h('label', { text: '密码' }), pass]),
      h('button', {
        className: 'btn',
        text: '登录',
        onClick: async () => {
          try {
            const session = await api.api('POST', '/api/auth/login', {
              token: '',
              body: { username: user.value, password: pass.value },
            });
            await afterLogin(session);
          } catch (e) {
            toast(e.message);
          }
        },
      }),
      h('button', {
        className: 'btn secondary',
        style: 'margin-top:10px;width:100%',
        text: '本机访客模式',
        onClick: () => {
          state.guestMode = true;
          state.screen = 'home';
          render();
        },
      }),
    ]),
  ]);
}

function renderMerge() {
  return h('div', { className: 'screen' }, [
    h('div', { className: 'top' }, [h('h1', { text: '合并本机数据' })]),
    h('div', { className: 'scroller' }, [
      h('div', { className: 'card' }, [
        h('h3', { text: '把本机记录合并到当前账号？' }),
        h('p', {
          text: `检测到本机有 ${state.mergeCount || 0} 条未同步记录。合并后会进入当前家庭账号并在联网后同步。`,
        }),
      ]),
      h('button', {
        className: 'btn',
        style: 'width:100%;margin-bottom:10px',
        text: '合并到当前账号',
        onClick: async () => {
          const n = await api.mergeGuestData();
          toast(`已合并 ${n} 条`);
          state.screen = 'home';
          await maybeSync();
          render();
        },
      }),
      h('button', {
        className: 'btn secondary',
        style: 'width:100%;margin-bottom:10px',
        text: '暂不合并',
        onClick: () => {
          state.screen = 'home';
          render();
        },
      }),
      h('button', {
        className: 'btn danger',
        style: 'width:100%',
        text: '清空本机访客数据',
        onClick: async () => {
          if (!confirm('确定清空本机访客数据？此操作不可恢复。')) return;
          await api.clearGuestData();
          toast('已清空');
          state.screen = 'home';
          render();
        },
      }),
    ]),
  ]);
}

function tabs() {
  const items = [
    ['today', '今天'],
    ['cal', '日历'],
    ['plans', '计划'],
    ['insights', '洞察'],
    ['me', '我的'],
  ];
  return h(
    'nav',
    { className: 'tabs' },
    items.map(([id, label]) =>
      h('button', {
        className: state.tab === id ? 'active' : '',
        text: label,
        onClick: () => {
          state.tab = id;
          render();
        },
      })
    )
  );
}

function offlineBanner() {
  if (state.online && api.getToken()) return null;
  if (!state.online) {
    return h('div', { className: 'banner', text: '离线，变更会在联网后同步' });
  }
  if (!api.getToken()) {
    return h('div', { className: 'banner', text: '本机访客模式：登录后可合并并同步到家庭' });
  }
  return null;
}

async function listActive(type) {
  const rows = await db.entitiesByType(type);
  return rows.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

async function renderTodayBody() {
  const todos = await listActive('todo');
  const plans = await listActive('plan');
  const notes = await listActive('note');
  const me = api.getMember();
  const wrap = h('div');

  wrap.append(
    h('div', { className: 'h2', text: '今日待办' }),
    todos.length
      ? null
      : h('div', { className: 'card' }, [h('p', { text: '还没有待办。点右下角新建。' })])
  );

  for (const t of todos) {
    const done = (t.payload.completions || {})[me?.id || 'guest'] === 'done';
    wrap.append(
      h('div', { className: 'card row' }, [
        h('button', {
          className: `check ${done ? 'on' : ''}`,
          text: done ? '✓' : '',
          onClick: async () => {
            const completions = { ...(t.payload.completions || {}) };
            completions[me?.id || 'guest'] = done ? 'open' : 'done';
            await api.saveLocalEntity('todo', { ...t.payload, completions }, { id: t.id });
            toast(done ? '已标为未完成' : '已完成');
            render();
            maybeSync();
          },
        }),
        h('div', { className: 'grow' }, [
          h('h3', { text: t.payload.title }),
          h('p', {
            text: [t.payload.dueAt ? `截止 ${fmt(t.payload.dueAt)}` : '', t.syncStatus === 'pending' ? '待同步' : '']
              .filter(Boolean)
              .join(' · ') || '待办',
          }),
        ]),
      ])
    );
  }

  wrap.append(h('div', { className: 'h2', text: '今日计划' }));
  for (const p of plans.filter((x) => !x.payload.archived)) {
    const execs = p.payload.executorIds || [];
    const mine = !me || execs.includes(me.id) || execs.length === 0;
    if (me?.role === 'child' && !execs.includes(me.id)) continue;
    wrap.append(
      h('div', { className: 'card' }, [
        h('h3', { text: p.payload.title }),
        h('p', { text: `${(execs.length || 1)} 人执行 · ${p.payload.reminder || '无提醒'}` }),
        mine
          ? h('button', {
              className: 'btn secondary',
              style: 'margin-top:10px',
              text: '打卡',
              onClick: async () => {
                const feedback = prompt('一句反馈（可空）') || '';
                await api.saveLocalEntity('checkin', {
                  planId: p.id,
                  memberId: me?.id || 'guest',
                  date: dayKey(new Date()),
                  status: 'done',
                  feedback,
                });
                toast('已打卡');
                render();
                maybeSync();
              },
            })
          : null,
      ])
    );
  }

  wrap.append(h('div', { className: 'h2', text: '便签' }));
  for (const n of notes.slice(0, 5)) {
    wrap.append(
      h('div', { className: 'card' }, [
        h('h3', { text: n.payload.title }),
        h('p', { text: n.payload.body || visibilityLabel(n.payload.visibility) }),
      ])
    );
  }
  return wrap;
}

function visibilityLabel(v) {
  return { self: '仅自己', members: '指定成员', family: '全家' }[v] || '';
}

function dayKey(d) {
  return d.toISOString().slice(0, 10);
}

function fmt(iso) {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

async function renderCalBody() {
  const events = await listActive('event');
  const todos = (await listActive('todo')).filter((t) => t.payload.dueAt);
  const wrap = h('div', {}, [h('div', { className: 'h2', text: '本周安排' })]);
  const items = [
    ...events.map((e) => ({ title: e.payload.title, when: e.payload.startAt, kind: '日程' })),
    ...todos.map((t) => ({ title: t.payload.title, when: t.payload.dueAt, kind: '待办' })),
  ].sort((a, b) => String(a.when).localeCompare(String(b.when)));
  if (!items.length) wrap.append(h('div', { className: 'card' }, [h('p', { text: '日历还是空的。' })]));
  for (const it of items) {
    wrap.append(
      h('div', { className: 'card' }, [
        h('h3', { text: it.title }),
        h('p', { text: `${it.kind} · ${fmt(it.when)}` }),
      ])
    );
  }
  return wrap;
}

async function renderPlansBody() {
  const plans = await listActive('plan');
  const wrap = h('div');
  if (!plans.length) wrap.append(h('div', { className: 'card' }, [h('p', { text: '还没有计划。' })]));
  for (const p of plans) {
    wrap.append(
      h('div', { className: 'card' }, [
        h('h3', { text: p.payload.title }),
        h('p', { text: p.payload.notes || `${p.payload.cycle || '每天'} · 执行人 ${(p.payload.executorIds || []).length} 人` }),
      ])
    );
  }
  return wrap;
}

async function renderInsightsBody() {
  const checkins = await listActive('checkin');
  const plans = await listActive('plan');
  const todos = await listActive('todo');
  const me = api.getMember();
  const since = Date.now() - 7 * 864e5;
  const recent = checkins.filter((c) => new Date(c.updatedAt).getTime() >= since);
  const done = recent.filter((c) => c.payload.status === 'done').length;
  const rate = recent.length ? Math.round((done / Math.max(recent.length, 1)) * 100) : 0;
  const openTodos = todos.filter((t) => (t.payload.completions || {})[me?.id || 'guest'] !== 'done');
  const wrap = h('div');
  wrap.append(
    h('div', { className: 'card' }, [
      h('p', { className: 'muted', text: '近 7 日完成率（本机数据）' }),
      h('div', { className: 'stat', text: `${rate}%` }),
      h('div', { className: 'bar' }, [h('i', { style: `width:${rate}%` })]),
      h('p', { style: 'margin-top:8px', className: 'muted', text: recent.length ? `${done}/${recent.length} 次打卡` : '暂无打卡，完成几次计划后再来看。' }),
    ])
  );
  if (openTodos.length) {
    wrap.append(
      h('div', { className: 'card' }, [
        h('h3', { text: '待办建议' }),
        h('p', { text: `还有 ${openTodos.length} 件未完成，优先处理「${openTodos[0].payload.title}」。` }),
      ])
    );
  }
  if (plans.length && rate < 60 && recent.length) {
    wrap.append(
      h('div', { className: 'card' }, [
        h('h3', { text: '风险提示' }),
        h('p', { text: '近一周打卡完成率偏低，今晚提醒前先留出 15 分钟。' }),
      ])
    );
  }
  if (!recent.length && !openTodos.length) {
    wrap.append(h('div', { className: 'card' }, [h('p', { text: '数据还很少。先创建计划并打卡，洞察会在本机生成，不会上传第三方。' })]));
  }
  return wrap;
}

async function renderMeBody() {
  const me = api.getMember();
  const family = api.getFamily();
  const lastSync = await db.kvGet('lastSyncAt', null);
  const queue = await db.listQueue();
  const fileInput = h('input', { type: 'file', accept: 'image/*', className: 'hidden' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const media = await api.uploadMedia(file, { purpose: 'avatar', memberId: me?.id });
      if (me) {
        me.avatarMediaId = media.id;
        localStorage.setItem('lt_member', JSON.stringify(me));
      }
      toast(media.pending ? '头像已保存，待上传' : '头像已更新');
      render();
      maybeSync();
    } catch (e) {
      toast(e.message);
    }
  });

  const avatar = h('button', {
    className: 'avatar',
    onClick: () => {
      if (!me) return toast('登录后可设置头像');
      fileInput.click();
    },
  }, [
    me?.displayName?.[0] || '访',
    h('span', { className: 'cam', text: '📷' }),
  ]);

  const wrap = h('div', {}, [
    fileInput,
    h('div', { className: 'card row' }, [
      avatar,
      h('div', { className: 'grow' }, [
        h('h3', { text: me?.displayName || '本机访客' }),
        h('p', { text: me ? `${roleLabel(me.role)} · ${me.username}` : '未登录' }),
        h('p', { text: family ? `家庭：${family.name}` : api.apiBase() || '未连接服务器' }),
      ]),
    ]),
    h('div', { className: 'card' }, [
      h('h3', { text: '同步' }),
      h('p', {
        text: lastSync
          ? `最近同步 ${fmt(lastSync)} · 队列 ${queue.length}`
          : `尚未同步 · 队列 ${queue.length}`,
      }),
      h('button', {
        className: 'btn secondary',
        style: 'margin-top:10px',
        text: '立即同步',
        onClick: async () => {
          try {
            const r = await api.syncNow();
            toast(r.skipped ? '请先登录' : `已同步，拉取 ${r.pullCount} 条`);
            render();
          } catch (e) {
            toast(e.message);
          }
        },
      }),
    ]),
    h('div', { className: 'h2', text: '皮肤' }),
    h('div', { className: 'seg' }, [
      ['night', '夜航'],
      ['day', '日间清晰'],
      ['paper', '暖纸'],
    ].map(([id, label]) =>
      h('button', {
        className: `btn secondary ${state.theme === id ? '' : ''}`,
        text: label,
        onClick: () => {
          state.theme = id;
          localStorage.setItem('lt_theme', id);
          applyChrome();
          render();
        },
      })
    )),
    h('div', { className: 'h2', text: '字号' }),
    h('div', { className: 'seg' }, [
      h('button', {
        className: 'btn secondary',
        text: '标准',
        onClick: () => {
          state.font = 'standard';
          localStorage.setItem('lt_font', 'standard');
          applyChrome();
          render();
        },
      }),
      h('button', {
        className: 'btn secondary',
        text: '大',
        onClick: () => {
          state.font = 'large';
          localStorage.setItem('lt_font', 'large');
          applyChrome();
          render();
        },
      }),
    ]),
  ]);

  if (me?.role === 'admin') {
    wrap.append(
      h('div', { className: 'h2', text: '成员' }),
      h('div', { className: 'card' }, [
        ...state.members.map((m) =>
          h('div', { className: 'row', style: 'margin-bottom:8px' }, [
            h('div', { className: 'grow' }, [
              h('h3', { text: m.displayName }),
              h('p', { text: `${m.username} · ${roleLabel(m.role)}` }),
            ]),
          ])
        ),
        h('button', {
          className: 'btn secondary',
          text: '添加成员',
          onClick: async () => {
            const displayName = prompt('显示名');
            const username = prompt('用户名（小写字母数字）');
            const password = prompt('初始密码');
            const role = prompt('角色 parent/adult/child', 'child');
            if (!displayName || !username || !password) return;
            try {
              await api.api('POST', '/api/members', {
                body: { displayName, username, password, role },
              });
              await maybeSync();
              const meRes = await api.api('GET', '/api/me');
              state.members = meRes.members;
              await db.kvSet('members', meRes.members);
              toast('已添加');
              render();
            } catch (e) {
              toast(e.message);
            }
          },
        }),
      ])
    );
  }

  wrap.append(
    h('div', { style: 'height:12px' }),
    api.getToken()
      ? h('button', {
          className: 'btn secondary',
          style: 'width:100%',
          text: '退出登录',
          onClick: async () => {
            try {
              await api.api('POST', '/api/auth/logout');
            } catch {
              /* ignore */
            }
            api.setSession(null);
            state.screen = 'login';
            render();
          },
        })
      : h('button', {
          className: 'btn',
          style: 'width:100%',
          text: '登录家庭账号',
          onClick: () => {
            state.screen = api.apiBase() ? 'login' : 'connect';
            render();
          },
        }),
    h('button', {
      className: 'btn ghost',
      style: 'width:100%;margin-top:8px',
      text: '更换服务器',
      onClick: () => {
        if (confirm('更换后需要重新登录')) {
          api.setSession(null);
          state.screen = 'connect';
          render();
        }
      },
    })
  );
  return wrap;
}

function openCreateSheet() {
  state.form = { type: 'todo', title: '', body: '', visibility: 'self', attachments: [] };
  render();
}

function renderCreateModal() {
  if (!state.form) return null;
  const f = state.form;
  const title = h('input', { value: f.title, placeholder: '标题' });
  title.addEventListener('input', () => (f.title = title.value));
  const body = h('textarea', { rows: '3', placeholder: '补充说明（可空）' });
  body.value = f.body || '';
  body.addEventListener('input', () => (f.body = body.value));
  const file = h('input', { type: 'file', className: 'hidden', multiple: true });
  const attachRow = h('div', { className: 'attach' });
  const refreshAttach = () => {
    attachRow.innerHTML = '';
    for (const a of f.attachments) {
      const thumb = h('div', { className: 'thumb', text: a.fileName.slice(0, 6) });
      if (a.preview) {
        thumb.textContent = '';
        thumb.append(h('img', { src: a.preview, alt: '' }));
      }
      attachRow.append(thumb);
    }
    attachRow.append(
      h('button', {
        className: 'thumb',
        text: '+',
        onClick: () => file.click(),
      })
    );
  };
  file.addEventListener('change', async () => {
    for (const fl of [...file.files]) {
      const err = api.validateAttachment(fl);
      if (err) {
        toast(err);
        continue;
      }
      if (f.attachments.length >= 9) {
        toast('单条最多 9 个附件');
        break;
      }
      const preview = fl.type.startsWith('image/') ? URL.createObjectURL(fl) : null;
      f.attachments.push({ file: fl, fileName: fl.name, preview });
    }
    refreshAttach();
  });
  refreshAttach();

  const typeSeg = h('div', { className: 'seg' }, [
    ['todo', '待办'],
    ['note', '便签'],
    ['event', '日程'],
    ['plan', '计划'],
  ].map(([id, label]) =>
    h('button', {
      className: `chip ${f.type === id ? 'on' : ''}`,
      text: label,
      onClick: () => {
        f.type = id;
        render();
      },
    })
  ));

  return h('div', { className: 'modal' }, [
    h('div', { className: 'sheet' }, [
      h('h2', { style: 'margin:0 0 12px', text: '新建' }),
      typeSeg,
      h('div', { className: 'field', style: 'margin-top:12px' }, [title]),
      h('div', { className: 'field' }, [body]),
      f.type === 'note'
        ? h('div', { className: 'seg', style: 'margin-bottom:12px' }, [
            ['self', '仅自己'],
            ['family', '全家'],
          ].map(([id, label]) =>
            h('button', {
              className: `chip ${f.visibility === id ? 'on' : ''}`,
              text: label,
              onClick: () => {
                f.visibility = id;
                render();
              },
            })
          ))
        : null,
      h('div', { className: 'h2', text: '照片或附件（≤20MB）' }),
      file,
      attachRow,
      h('div', { className: 'row', style: 'margin-top:16px' }, [
        h('button', {
          className: 'btn secondary grow',
          text: '取消',
          onClick: () => {
            state.form = null;
            render();
          },
        }),
        h('button', {
          className: 'btn grow',
          text: '保存',
          onClick: async () => {
            if (!f.title.trim()) return toast('请填写标题');
            const attachmentIds = [];
            for (const a of f.attachments) {
              try {
                const media = await api.uploadMedia(a.file, { purpose: 'attachment', parentType: f.type });
                attachmentIds.push(media.id);
              } catch (e) {
                toast(e.message);
                return;
              }
            }
            const base = { title: f.title.trim(), attachmentIds };
            if (f.type === 'todo') {
              await api.saveLocalEntity('todo', {
                ...base,
                notes: f.body,
                assigneeIds: api.getMember() ? [api.getMember().id] : ['guest'],
                completions: {},
              });
            } else if (f.type === 'note') {
              await api.saveLocalEntity('note', {
                ...base,
                body: f.body,
                visibility: f.visibility,
                pinned: false,
              });
            } else if (f.type === 'event') {
              const start = new Date();
              start.setHours(start.getHours() + 1, 0, 0, 0);
              const end = new Date(start.getTime() + 3600e3);
              await api.saveLocalEntity('event', {
                ...base,
                startAt: start.toISOString(),
                endAt: end.toISOString(),
                allDay: false,
                participantIds: api.getMember() ? [api.getMember().id] : ['guest'],
              });
            } else if (f.type === 'plan') {
              await api.saveLocalEntity('plan', {
                ...base,
                notes: f.body,
                cycle: 'daily',
                reminder: '20:00',
                executorIds: api.getMember() ? [api.getMember().id] : ['guest'],
              });
            }
            state.form = null;
            toast('已保存到本机');
            render();
            maybeSync();
          },
        }),
      ]),
    ]),
  ]);
}

async function renderHome() {
  const titleMap = {
    today: '今天',
    cal: '日历',
    plans: '计划',
    insights: 'AI 洞察',
    me: '我的',
  };
  const bodyMap = {
    today: renderTodayBody,
    cal: renderCalBody,
    plans: renderPlansBody,
    insights: renderInsightsBody,
    me: renderMeBody,
  };
  const body = await bodyMap[state.tab]();
  const screen = h('div', { className: 'screen' }, [
    h('div', { className: 'top' }, [h('h1', { text: titleMap[state.tab] })]),
    offlineBanner(),
    h('div', { className: 'scroller' }, [body]),
    state.tab !== 'me' && state.tab !== 'insights'
      ? h('button', { className: 'fab', text: '+', onClick: openCreateSheet })
      : null,
    tabs(),
    renderCreateModal(),
  ]);
  return screen;
}

async function render() {
  applyChrome();
  root.innerHTML = '';
  root.append(h('div', { id: 'toast', className: 'toast' }));
  let view;
  if (state.screen === 'connect') view = renderConnect();
  else if (state.screen === 'setup') view = renderSetup();
  else if (state.screen === 'login') view = renderLogin();
  else if (state.screen === 'merge') view = renderMerge();
  else view = await renderHome();
  root.append(view);
}

boot();
