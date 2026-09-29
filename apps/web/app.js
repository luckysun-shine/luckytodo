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
  hideBanner: sessionStorage.getItem('lt_hide_banner') === '1',
  mergeCount: 0,
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

const icons = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 11h16M4 7h16M8 3v4M16 3v4"/><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 15h3M13 15h3"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  plans: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M5 6h.01M5 12h.01M5 18h.01"/></svg>',
  insights: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>',
  me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>',
  sync: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-2.3-6"/><path d="M21 3v6h-6"/></svg>',
};

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

function appendNodes(parent, ...nodes) {
  for (const n of nodes.flat()) {
    if (n == null || n === false) continue;
    parent.append(n);
  }
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

function fmtDateNice(d = new Date()) {
  const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日 · 周${w}`;
}

function hello() {
  const h = new Date().getHours();
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function visibilityLabel(v) {
  return { self: '仅自己', members: '指定成员', family: '全家' }[v] || '';
}

async function listActive(type) {
  const rows = await db.entitiesByType(type);
  return rows.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

async function boot() {
  applyChrome();
  const server = api.apiBase();
  if (!server && !localStorage.getItem('lt_server')) {
    // same-origin default still counts via apiBase()
  }
  if (!api.getToken()) {
    try {
      if (api.apiBase()) {
        const health = await api.health();
        state.health = health;
        state.screen = health.initialized ? 'login' : 'setup';
      } else {
        state.screen = 'connect';
      }
    } catch {
      state.screen = api.apiBase() ? 'login' : 'connect';
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
    inputmode: 'url',
  });
  return h('div', { className: 'screen auth' }, [
    h('div', { className: 'brand' }, [
      h('div', { className: 'mark', text: 'L' }),
      h('h1', { text: 'LuckyTodo' }),
      h('p', { text: '家庭待办放在自己的 NAS 上。先连接飞牛上的服务地址。' }),
    ]),
    h('div', { className: 'field' }, [h('label', { text: '服务器地址（HTTPS）' }), urlInput]),
    h('div', { className: 'auth-actions' }, [
      h('button', {
        className: 'btn lg block',
        text: '检查并继续',
        onClick: async () => {
          const url = urlInput.value.trim().replace(/\/$/, '');
          if (!url) return toast('请填写服务器地址');
          api.setApiBase(url);
          try {
            const health = await api.health();
            toast(health.initialized ? '已连接，请登录' : '已连接，可以创建家庭');
            state.health = health;
            state.screen = health.initialized ? 'login' : 'setup';
            render();
          } catch (e) {
            toast(e.message || '连不上服务器，请检查地址与网络');
          }
        },
      }),
      h('button', {
        className: 'btn secondary block',
        text: '先在本机试用',
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
    fields[key] = h('input', {
      type,
      autocomplete: key.includes('pass') ? 'new-password' : 'off',
    });
    return h('div', { className: 'field' }, [h('label', { text: label }), fields[key]]);
  };
  return h('div', { className: 'screen auth' }, [
    h('div', { className: 'brand' }, [
      h('div', { className: 'mark', text: 'L' }),
      h('h1', { text: '创建家庭' }),
      h('p', { text: '你将成为管理员。时区固定为中国标准时间。' }),
    ]),
    field('familyName', '家庭名称'),
    field('displayName', '你的显示名'),
    field('username', '用户名（小写字母数字）'),
    field('password', '密码（至少 6 位）', 'password'),
    field('password2', '再输入一次密码', 'password'),
    h('div', { className: 'auth-actions' }, [
      h('button', {
        className: 'btn lg block',
        text: '创建家庭并进入',
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
      h('button', {
        className: 'btn ghost block',
        text: '返回连接',
        onClick: () => {
          state.screen = 'connect';
          render();
        },
      }),
    ]),
  ]);
}

function renderLogin() {
  const user = h('input', { autocomplete: 'username' });
  const pass = h('input', { type: 'password', autocomplete: 'current-password' });
  return h('div', { className: 'screen auth' }, [
    h('div', { className: 'brand' }, [
      h('div', { className: 'mark', text: 'L' }),
      h('h1', { text: '欢迎回家' }),
      h('p', { text: '登录家庭账号，事项会在多台手机之间同步。' }),
    ]),
    h('div', { className: 'field' }, [h('label', { text: '用户名' }), user]),
    h('div', { className: 'field' }, [h('label', { text: '密码' }), pass]),
    h('div', { className: 'auth-actions' }, [
      h('button', {
        className: 'btn lg block',
        text: '登录',
        onClick: async () => {
          if (!user.value.trim()) return toast('请填写用户名');
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
        className: 'btn secondary block',
        text: '本机访客模式',
        onClick: () => {
          state.guestMode = true;
          state.screen = 'home';
          render();
        },
      }),
      h('button', {
        className: 'btn ghost block',
        text: '更换服务器',
        onClick: () => {
          state.screen = 'connect';
          render();
        },
      }),
    ]),
  ]);
}

function renderMerge() {
  return h('div', { className: 'screen auth' }, [
    h('div', { className: 'brand' }, [
      h('div', { className: 'mark', text: '⇄' }),
      h('h1', { text: '合并本机记录？' }),
      h('p', {
        text: `检测到本机有 ${state.mergeCount || 0} 条未同步记录。合并后进入当前家庭账号，联网后自动上传。`,
      }),
    ]),
    h('div', { className: 'auth-actions' }, [
      h('button', {
        className: 'btn lg block',
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
        className: 'btn secondary block',
        text: '暂不合并',
        onClick: () => {
          state.screen = 'home';
          render();
        },
      }),
      h('button', {
        className: 'btn danger block',
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
    ['today', '今天', icons.today],
    ['cal', '日历', icons.cal],
    ['plans', '计划', icons.plans],
    ['insights', '洞察', icons.insights],
    ['me', '我的', icons.me],
  ];
  return h(
    'nav',
    { className: 'tabs', role: 'tablist', 'aria-label': '主导航' },
    items.map(([id, label, icon]) =>
      h('button', {
        className: state.tab === id ? 'active' : '',
        role: 'tab',
        'aria-selected': state.tab === id,
        html: `${icon}<span>${label}</span>`,
        onClick: () => {
          state.tab = id;
          render();
        },
      })
    )
  );
}

function offlineBanner() {
  if (state.hideBanner) return null;
  if (!state.online) {
    return h('div', { className: 'banner' }, [
      h('span', { className: 'grow', text: '当前离线，改动会在联网后同步' }),
      h('button', {
        className: 'x',
        'aria-label': '关闭提示',
        text: '×',
        onClick: () => {
          state.hideBanner = true;
          sessionStorage.setItem('lt_hide_banner', '1');
          render();
        },
      }),
    ]);
  }
  if (!api.getToken()) {
    return h('div', { className: 'banner' }, [
      h('span', { className: 'grow', text: '访客模式：登录后可合并并同步到家庭' }),
      h('button', {
        className: 'btn ghost',
        text: '去登录',
        onClick: () => {
          state.screen = api.apiBase() ? 'login' : 'connect';
          render();
        },
      }),
    ]);
  }
  return null;
}

function emptyState(title, body, cta, onClick) {
  return h('div', { className: 'empty' }, [
    h('h3', { text: title }),
    h('p', { text: body }),
    cta
      ? h('button', { className: 'btn secondary', text: cta, onClick })
      : null,
  ]);
}

async function renderTodayBody() {
  const todos = await listActive('todo');
  const plans = await listActive('plan');
  const notes = await listActive('note');
  const me = api.getMember();
  const wrap = h('div');
  const openTodos = todos.filter((t) => (t.payload.completions || {})[me?.id || 'guest'] !== 'done');

  appendNodes(wrap, h('div', { className: 'section-label', text: `今日待办 · ${openTodos.length} 件未完成` }));

  if (!todos.length) {
    appendNodes(
      wrap,
      emptyState('今天还没有待办', '三秒记下要做的事，勾完就清爽了。', '新建待办', openCreateSheet)
    );
  }

  for (const t of todos) {
    const done = (t.payload.completions || {})[me?.id || 'guest'] === 'done';
    const meta = [
      t.payload.dueAt ? `截止 ${fmt(t.payload.dueAt)}` : null,
      t.syncStatus === 'pending' ? '待同步' : null,
    ]
      .filter(Boolean)
      .join(' · ');
    appendNodes(
      wrap,
      h('div', { className: `todo-row ${done ? 'done' : ''}` }, [
        h('button', {
          className: `check ${done ? 'on' : ''}`,
          'aria-label': done ? '标为未完成' : '完成',
          html: done ? '✓' : '',
          onClick: async () => {
            const completions = { ...(t.payload.completions || {}) };
            completions[me?.id || 'guest'] = done ? 'open' : 'done';
            await api.saveLocalEntity('todo', { ...t.payload, completions }, { id: t.id });
            toast(done ? '已恢复为未完成' : '已完成');
            render();
            maybeSync();
          },
        }),
        h('div', { className: 'grow' }, [
          h('h3', { text: t.payload.title }),
          meta ? h('p', { text: meta }) : h('p', { text: '待办' }),
        ]),
      ])
    );
  }

  appendNodes(wrap, h('div', { className: 'section-label', text: '今日计划' }));
  const activePlans = plans.filter((x) => !x.payload.archived);
  if (!activePlans.length) {
    appendNodes(
      wrap,
      emptyState('还没有计划', '把每天阅读、运动做成计划，家人各自打卡。', '新建计划', () => {
        state.form = { type: 'plan', title: '', body: '', visibility: 'self', attachments: [] };
        render();
      })
    );
  }
  for (const p of activePlans) {
    const execs = p.payload.executorIds || [];
    const mine = !me || execs.includes(me.id) || execs.length === 0;
    if (me?.role === 'child' && !execs.includes(me.id)) continue;
    appendNodes(
      wrap,
      h('div', { className: 'card' }, [
        h('h3', { text: p.payload.title }),
        h('p', { text: `${execs.length || 1} 人执行 · 提醒 ${p.payload.reminder || '未设置'}` }),
        mine
          ? h('button', {
              className: 'btn secondary',
              style: 'margin-top:12px',
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
                toast('打卡成功');
                render();
                maybeSync();
              },
            })
          : null,
      ])
    );
  }

  appendNodes(wrap, h('div', { className: 'section-label', text: '最近便签' }));
  if (!notes.length) {
    appendNodes(wrap, h('p', { className: 'muted', text: '没有便签。点右下角可随手记。' }));
  }
  for (const n of notes.slice(0, 4)) {
    appendNodes(
      wrap,
      h('div', { className: 'card pressable' }, [
        h('h3', { text: n.payload.title }),
        h('p', { text: n.payload.body || visibilityLabel(n.payload.visibility) || '便签' }),
      ])
    );
  }
  return wrap;
}

async function renderCalBody() {
  const events = await listActive('event');
  const todos = (await listActive('todo')).filter((t) => t.payload.dueAt);
  const wrap = h('div');
  const items = [
    ...events.map((e) => ({ title: e.payload.title, when: e.payload.startAt, kind: '日程' })),
    ...todos.map((t) => ({ title: t.payload.title, when: t.payload.dueAt, kind: '待办' })),
  ].sort((a, b) => String(a.when).localeCompare(String(b.when)));

  appendNodes(wrap, h('div', { className: 'section-label', text: '即将到来' }));
  if (!items.length) {
    appendNodes(
      wrap,
      emptyState('日历还是空的', '给待办加截止时间，或新建日程，就会出现在这里。', '新建日程', () => {
        state.form = { type: 'event', title: '', body: '', visibility: 'self', attachments: [] };
        render();
      })
    );
  }
  for (const it of items) {
    appendNodes(
      wrap,
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
  appendNodes(wrap, h('div', { className: 'section-label', text: '全部计划' }));
  if (!plans.length) {
    appendNodes(
      wrap,
      emptyState('还没有计划', '适合重复发生的家庭事项，每人单独打卡。', '新建计划', () => {
        state.form = { type: 'plan', title: '', body: '', visibility: 'self', attachments: [] };
        render();
      })
    );
  }
  for (const p of plans) {
    appendNodes(
      wrap,
      h('div', { className: 'card' }, [
        h('h3', { text: p.payload.title }),
        h('p', {
          text: p.payload.notes || `${p.payload.cycle || '每天'} · ${(p.payload.executorIds || []).length || 1} 人`,
        }),
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

  appendNodes(
    wrap,
    h('div', { className: 'card' }, [
      h('p', { className: 'eyebrow', text: '近 7 日 · 本机数据' }),
      h('div', { className: 'stat', text: `${rate}%` }),
      h('div', { className: 'bar' }, [h('i', { style: `width:${rate}%` })]),
      h('p', {
        style: 'margin-top:10px',
        className: 'muted',
        text: recent.length ? `${done} / ${recent.length} 次打卡完成` : '暂无打卡。完成几次计划后再来看节奏。',
      }),
    ])
  );

  if (openTodos.length) {
    appendNodes(
      wrap,
      h('div', { className: 'card' }, [
        h('h3', { text: '待办建议' }),
        h('p', { text: `还有 ${openTodos.length} 件未完成，建议先处理「${openTodos[0].payload.title}」。` }),
        h('button', {
          className: 'btn secondary',
          style: 'margin-top:12px',
          text: '回到今天',
          onClick: () => {
            state.tab = 'today';
            render();
          },
        }),
      ])
    );
  }
  if (plans.length && rate < 60 && recent.length) {
    appendNodes(
      wrap,
      h('div', { className: 'card' }, [
        h('h3', { text: '节奏提醒' }),
        h('p', { text: '近一周完成率偏低，今晚提醒前先留出 15 分钟。' }),
      ])
    );
  }
  if (!recent.length && !openTodos.length) {
    appendNodes(
      wrap,
      emptyState('洞察还在等数据', '先创建计划并打卡，分析只在本机完成，不会上传第三方。', '去今天', () => {
        state.tab = 'today';
        render();
      })
    );
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

  const avatar = h(
    'button',
    {
      className: 'avatar',
      'aria-label': '更换头像',
      onClick: () => {
        if (!me) return toast('登录后可设置头像');
        fileInput.click();
      },
    },
    [me?.displayName?.[0] || '访', h('span', { className: 'cam', text: '✎' })]
  );

  const wrap = h('div', {}, [
    fileInput,
    h('div', { className: 'card row' }, [
      avatar,
      h('div', { className: 'grow' }, [
        h('h3', { text: me?.displayName || '本机访客' }),
        h('p', { text: me ? `${roleLabel(me.role)} · @${me.username}` : '未登录 · 数据仅本机' }),
        h('p', { text: family ? family.name : api.apiBase() || '未连接服务器' }),
      ]),
    ]),
    h('div', { className: 'card' }, [
      h('div', { className: 'row' }, [
        h('div', { className: 'grow' }, [
          h('h3', { text: '同步' }),
          h('p', {
            text: lastSync
              ? `最近 ${fmt(lastSync)} · 队列 ${queue.length}`
              : `尚未同步 · 队列 ${queue.length}`,
          }),
        ]),
        h('button', {
          className: 'icon-btn',
          'aria-label': '立即同步',
          html: icons.sync,
          onClick: async () => {
            try {
              const r = await api.syncNow();
              toast(r.skipped ? '请先登录再同步' : `已同步，拉取 ${r.pullCount} 条`);
              render();
            } catch (e) {
              toast(e.message);
            }
          },
        }),
      ]),
    ]),
    h('div', { className: 'section-label', text: '外观' }),
    h('div', { className: 'seg', style: 'margin-bottom:12px' }, [
      ['night', '夜航'],
      ['day', '日间'],
      ['paper', '暖纸'],
    ].map(([id, label]) =>
      h('button', {
        className: state.theme === id ? 'on' : '',
        text: label,
        onClick: () => {
          state.theme = id;
          localStorage.setItem('lt_theme', id);
          applyChrome();
          render();
        },
      })
    )),
    h('div', { className: 'seg' }, [
      h('button', {
        className: state.font === 'standard' ? 'on' : '',
        text: '标准字号',
        onClick: () => {
          state.font = 'standard';
          localStorage.setItem('lt_font', 'standard');
          applyChrome();
          render();
        },
      }),
      h('button', {
        className: state.font === 'large' ? 'on' : '',
        text: '大字号',
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
    appendNodes(
      wrap,
      h('div', { className: 'section-label', text: '家庭成员' }),
      h('div', { className: 'card stack' }, [
        ...state.members.map((m) =>
          h('div', { className: 'row' }, [
            h('div', { className: 'grow' }, [
              h('h3', { text: m.displayName }),
              h('p', { text: `@${m.username} · ${roleLabel(m.role)}` }),
            ]),
          ])
        ),
        h('button', {
          className: 'btn secondary block',
          text: '添加成员',
          onClick: async () => {
            const displayName = prompt('显示名');
            const username = prompt('用户名（小写字母数字）');
            const password = prompt('初始密码');
            const role = prompt('角色 parent / adult / child', 'child');
            if (!displayName || !username || !password) return;
            try {
              await api.api('POST', '/api/members', {
                body: { displayName, username, password, role },
              });
              const meRes = await api.api('GET', '/api/me');
              state.members = meRes.members;
              await db.kvSet('members', meRes.members);
              toast('成员已添加');
              render();
            } catch (e) {
              toast(e.message);
            }
          },
        }),
      ])
    );
  }

  appendNodes(
    wrap,
    h('div', { style: 'height:16px' }),
    api.getToken()
      ? h('button', {
          className: 'btn secondary block',
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
          className: 'btn lg block',
          text: '登录家庭账号',
          onClick: () => {
            state.screen = api.apiBase() ? 'login' : 'connect';
            render();
          },
        }),
    h('button', {
      className: 'btn ghost block',
      text: '更换服务器',
      onClick: () => {
        if (confirm('更换后需要重新登录，本机皮肤设置会保留。')) {
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
  const title = h('input', {
    value: f.title,
    placeholder: f.type === 'note' ? '便签标题' : '写清楚要做什么',
    autofocus: true,
  });
  title.addEventListener('input', () => (f.title = title.value));
  const body = h('textarea', {
    rows: '3',
    placeholder: f.type === 'note' ? '正文（可空）' : '补充说明（可空）',
  });
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
        type: 'button',
        text: '+ 附件',
        onClick: () => file.click(),
      })
    );
  };
  file.addEventListener('change', () => {
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

  const typeSeg = h(
    'div',
    { className: 'seg', style: 'margin-bottom:14px' },
    [
      ['todo', '待办'],
      ['note', '便签'],
      ['event', '日程'],
      ['plan', '计划'],
    ].map(([id, label]) =>
      h('button', {
        className: f.type === id ? 'on' : '',
        text: label,
        onClick: () => {
          f.type = id;
          render();
        },
      })
    )
  );

  return h('div', {
    className: 'modal',
    onClick: (e) => {
      if (e.target.classList.contains('modal')) {
        state.form = null;
        render();
      }
    },
  }, [
    h('div', { className: 'sheet', role: 'dialog', 'aria-label': '新建' }, [
      h('div', { className: 'handle' }),
      h('h2', { text: '快速新建' }),
      typeSeg,
      h('div', { className: 'field' }, [h('label', { text: '标题' }), title]),
      h('div', { className: 'field' }, [h('label', { text: '说明' }), body]),
      f.type === 'note'
        ? h('div', { className: 'chip-row' }, [
            ['self', '仅自己'],
            ['family', '全家可见'],
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
      h('p', { className: 'eyebrow', text: '照片或附件 · 单文件 ≤ 20MB' }),
      file,
      attachRow,
      h('div', { className: 'row', style: 'margin-top:16px;gap:10px' }, [
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
          text: '保存到本机',
          onClick: async () => {
            if (!f.title.trim()) return toast('请先填写标题');
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
            const me = api.getMember();
            if (f.type === 'todo') {
              await api.saveLocalEntity('todo', {
                ...base,
                notes: f.body,
                assigneeIds: me ? [me.id] : ['guest'],
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
                participantIds: me ? [me.id] : ['guest'],
              });
            } else if (f.type === 'plan') {
              await api.saveLocalEntity('plan', {
                ...base,
                notes: f.body,
                cycle: 'daily',
                reminder: '20:00',
                executorIds: me ? [me.id] : ['guest'],
              });
            }
            state.form = null;
            if (f.type === 'event') state.tab = 'cal';
            else if (f.type === 'plan') state.tab = 'plans';
            else state.tab = 'today';
            toast('已保存');
            render();
            maybeSync();
          },
        }),
      ]),
    ]),
  ]);
}

async function renderHome() {
  const titles = {
    today: null,
    cal: '日历',
    plans: '计划',
    insights: '洞察',
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
  const me = api.getMember();
  const top =
    state.tab === 'today'
      ? h('div', { className: 'top' }, [
          h('div', { className: 'greeting' }, [
            h('p', { className: 'eyebrow', text: fmtDateNice() }),
            h('h1', { text: `${hello()}${me ? '，' + me.displayName : ''}` }),
          ]),
          h('button', {
            className: 'icon-btn',
            'aria-label': '同步',
            html: icons.sync,
            onClick: async () => {
              try {
                const r = await api.syncNow();
                toast(r.skipped ? '登录后可同步到家庭' : `已同步 ${r.pullCount} 条`);
                render();
              } catch (e) {
                toast(e.message);
              }
            },
          }),
        ])
      : h('div', { className: 'top' }, [h('h1', { text: titles[state.tab] })]);

  return h('div', { className: 'screen' }, [
    top,
    offlineBanner(),
    h('div', { className: 'scroller' }, [body]),
    state.tab !== 'me' && state.tab !== 'insights'
      ? h('button', {
          className: 'fab',
          'aria-label': '新建',
          html: icons.plus,
          onClick: openCreateSheet,
        })
      : null,
    tabs(),
    renderCreateModal(),
  ]);
}

async function render() {
  applyChrome();
  root.innerHTML = '';
  root.append(h('div', { id: 'toast', className: 'toast', role: 'status' }));
  let view;
  if (state.screen === 'connect') view = renderConnect();
  else if (state.screen === 'setup') view = renderSetup();
  else if (state.screen === 'login') view = renderLogin();
  else if (state.screen === 'merge') view = renderMerge();
  else view = await renderHome();
  root.append(view);
  // autofocus title in sheet
  const focusEl = root.querySelector('.sheet input');
  if (focusEl) setTimeout(() => focusEl.focus(), 50);
}

boot();
