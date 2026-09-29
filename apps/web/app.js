import { css } from './src/styles.js';
import * as api from './src/api.js';
import * as db from './src/db.js';
import * as reminders from './src/reminders.js';

const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);

const root = document.getElementById('app');

function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
  calCursor: (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  })(),
  calSelected: dayKey(new Date()),
  calExpanded: localStorage.getItem('lt_cal_expanded') !== '0',
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
    else if (k === 'checked' || k === 'selected' || k === 'disabled') el[k] = !!v;
    else if (k === 'value' && (tag === 'input' || tag === 'textarea' || tag === 'select')) el.value = v == null ? '' : v;
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

async function maybeSync() {
  if (!api.isFamilyMode() || !state.online) return;
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
  const localCount = await api.countGuestRecords();
  if (localCount > 0) {
    state.screen = 'merge';
    state.mergeCount = localCount;
    render();
    return;
  }
  state.screen = 'home';
  await maybeSync();
  render();
}

async function afterLocalLogin() {
  state.screen = 'home';
  await loadMembers();
  render();
}

function roleLabel(role) {
  return { admin: '管理员', parent: '家长', adult: '成人', child: '儿童' }[role] || role;
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

function localDayKeyFromIso(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return dayKey(d);
}

function buildMonthCells(cursor) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  // Monday-first: 0=Mon ... 6=Sun
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function bindCalPull(handle, panel) {
  let startY = 0;
  let dragging = false;
  const threshold = 48;

  const onStart = (y) => {
    dragging = true;
    startY = y;
    handle.classList.add('pulling');
  };
  const onMove = (y, e) => {
    if (!dragging) return;
    const dy = y - startY;
    // visual hint
    const tip = Math.max(-24, Math.min(24, dy * 0.25));
    handle.style.transform = `translateY(${tip}px)`;
    if (e?.cancelable) e.preventDefault();
  };
  const onEnd = (y) => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('pulling');
    handle.style.transform = '';
    const dy = y - startY;
    if (dy < -threshold && state.calExpanded) {
      state.calExpanded = false;
      localStorage.setItem('lt_cal_expanded', '0');
      render();
    } else if (dy > threshold && !state.calExpanded) {
      state.calExpanded = true;
      localStorage.setItem('lt_cal_expanded', '1');
      render();
    }
  };

  handle.addEventListener('touchstart', (e) => onStart(e.touches[0].clientY), { passive: true });
  handle.addEventListener('touchmove', (e) => onMove(e.touches[0].clientY, e), { passive: false });
  handle.addEventListener('touchend', (e) => onEnd(e.changedTouches[0].clientY));
  handle.addEventListener('mousedown', (e) => {
    onStart(e.clientY);
    const move = (ev) => onMove(ev.clientY, ev);
    const up = (ev) => {
      onEnd(ev.clientY);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  });

  // also allow pull on the calendar panel itself when expanded
  if (panel) {
    panel.addEventListener('touchstart', (e) => {
      if (e.target.closest('button')) return;
      onStart(e.touches[0].clientY);
    }, { passive: true });
    panel.addEventListener('touchmove', (e) => onMove(e.touches[0].clientY, e), { passive: false });
    panel.addEventListener('touchend', (e) => onEnd(e.changedTouches[0].clientY));
  }
}

function visibilityLabel(v) {
  return { self: '仅自己', members: '指定成员', family: '全家' }[v] || '';
}

async function listActive(type) {
  const rows = await db.entitiesByType(type);
  return rows.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

async function loadMembers() {
  if (api.isFamilyMode()) {
    state.members = (await db.kvGet('members', [])) || [];
  } else {
    state.members = (await db.kvGet('members', [])) || [];
  }
  const me = api.getMember();
  if (me && !state.members.find((m) => m.id === me.id)) state.members = [me, ...state.members];
  if (!api.isFamilyMode() && me) state.members = [me];
}

async function boot() {
  applyChrome();
  if (!api.isLoggedIn()) {
    state.screen = api.hasLocalAccounts() ? 'local-login' : 'local-register';
    render();
    return;
  }
  state.screen = 'home';
  await loadMembers();
  render();
  maybeSync().then(render);
}

function renderLocalRegister() {
  const fields = {};
  const field = (key, label, type = 'text') => {
    fields[key] = h('input', {
      type,
      autocomplete: key.includes('pass') ? 'new-password' : key === 'username' ? 'username' : 'nickname',
    });
    return h('div', { className: 'field' }, [h('label', { text: label }), fields[key]]);
  };
  return h('div', { className: 'screen auth' }, [
    h('div', { className: 'brand' }, [
      h('div', { className: 'mark', text: 'L' }),
      h('h1', { text: '创建本机账号' }),
      h('p', { text: '首次使用需要登录。可不连接 NAS，本机离线使用；之后可在「我的」里连接家庭服务器做同步。' }),
    ]),
    field('displayName', '显示名'),
    field('username', '用户名（小写字母数字）'),
    field('password', '密码（至少 6 位）', 'password'),
    field('password2', '再输入一次密码', 'password'),
    h('div', { className: 'auth-actions' }, [
      h('button', {
        className: 'btn lg block',
        text: '创建并进入',
        onClick: async () => {
          if (fields.password.value !== fields.password2.value) return toast('两次密码不一致');
          try {
            await api.createLocalAccount({
              displayName: fields.displayName.value,
              username: fields.username.value,
              password: fields.password.value,
            });
            await afterLocalLogin();
          } catch (e) {
            toast(e.message);
          }
        },
      }),
      api.hasLocalAccounts()
        ? h('button', {
            className: 'btn ghost block',
            text: '已有本机账号，去登录',
            onClick: () => {
              state.screen = 'local-login';
              render();
            },
          })
        : null,
    ]),
  ]);
}

function renderLocalLogin() {
  const user = h('input', { autocomplete: 'username' });
  const pass = h('input', { type: 'password', autocomplete: 'current-password' });
  return h('div', { className: 'screen auth' }, [
    h('div', { className: 'brand' }, [
      h('div', { className: 'mark', text: 'L' }),
      h('h1', { text: '登录' }),
      h('p', { text: '使用本机账号登录。未连接家庭服务器时，数据只保存在这台设备。' }),
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
            await api.loginLocalAccount({ username: user.value, password: pass.value });
            await afterLocalLogin();
          } catch (e) {
            toast(e.message);
          }
        },
      }),
      h('button', {
        className: 'btn secondary block',
        text: '创建新的本机账号',
        onClick: () => {
          state.screen = 'local-register';
          render();
        },
      }),
    ]),
  ]);
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
      h('h1', { text: '连接家庭服务器' }),
      h('p', { text: '填写飞牛上的 HTTPS 地址后，才能多账号关联与多端同步。也可稍后再连。' }),
    ]),
    h('div', { className: 'field' }, [h('label', { text: '服务器地址（HTTPS）' }), urlInput]),
    h('div', { className: 'auth-actions' }, [
      h('button', {
        className: 'btn lg block',
        text: '检查并继续',
        onClick: async () => {
          const url = urlInput.value.trim().replace(/\/$/, '');
          if (!url) return toast('请填写服务器地址');
          if (!/^https:\/\//i.test(url) && location.hostname !== '127.0.0.1' && location.hostname !== 'localhost') {
            toast('请使用 HTTPS 地址');
          }
          api.setApiBase(url);
          try {
            const health = await api.health();
            toast(health.initialized ? '已连接，请登录家庭账号' : '已连接，可以创建家庭');
            state.health = health;
            state.screen = health.initialized ? 'family-login' : 'setup';
            render();
          } catch (e) {
            toast(e.message || '连不上服务器，请检查地址与网络');
          }
        },
      }),
      h('button', {
        className: 'btn ghost block',
        text: '返回',
        onClick: () => {
          state.screen = api.isLoggedIn() ? 'home' : api.hasLocalAccounts() ? 'local-login' : 'local-register';
          if (state.screen === 'home') state.tab = 'me';
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
      h('p', { text: '在 NAS 上创建家庭空间。你将成为管理员。时区：中国标准时间。' }),
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
        text: '返回',
        onClick: () => {
          state.screen = 'connect';
          render();
        },
      }),
    ]),
  ]);
}

function renderFamilyLogin() {
  const user = h('input', { autocomplete: 'username' });
  const pass = h('input', { type: 'password', autocomplete: 'current-password' });
  return h('div', { className: 'screen auth' }, [
    h('div', { className: 'brand' }, [
      h('div', { className: 'mark', text: 'L' }),
      h('h1', { text: '登录家庭账号' }),
      h('p', { text: `服务器：${api.apiBase() || '未设置'}。登录后可同步与多账号关联。` }),
    ]),
    h('div', { className: 'field' }, [h('label', { text: '用户名' }), user]),
    h('div', { className: 'field' }, [h('label', { text: '密码' }), pass]),
    h('div', { className: 'auth-actions' }, [
      h('button', {
        className: 'btn lg block',
        text: '登录家庭账号',
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
        text: `检测到本机有 ${state.mergeCount || 0} 条离线记录。合并后进入当前家庭账号，联网后自动同步。`,
      }),
    ]),
    h('div', { className: 'auth-actions' }, [
      h('button', {
        className: 'btn lg block',
        text: '合并到当前账号',
        onClick: async () => {
          const n = await api.mergeLocalDataToFamily();
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
        text: '清空这些本机记录',
        onClick: async () => {
          if (!confirm('确定清空本机离线记录？此操作不可恢复。')) return;
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
  if (!api.isFamilyMode()) {
    return h('div', { className: 'banner' }, [
      h('span', { className: 'grow', text: '本机使用中，数据仅保存在此设备。可在「我的」连接家庭服务器开启同步。' }),
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
      emptyState('今天还没有待办', '三秒记下要做的事，勾完就清爽了。', '新建待办', () => openCreateForm('todo'))
    );
  }

  for (const t of todos) {
    const done = (t.payload.completions || {})[me?.id || 'guest'] === 'done';
    const meta = [
      t.payload.dueAt ? `截止 ${fmt(t.payload.dueAt)}` : null,
      api.isFamilyMode() && t.syncStatus === 'pending' ? '待同步' : null,
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
      emptyState('还没有计划', '把每天阅读、运动做成计划，家人各自打卡。', '新建计划', () => openCreateForm('plan'))
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
  const plans = (await listActive('plan')).filter((p) => !p.payload.archived);

  const marked = new Set();
  const byDay = {};
  const pushItem = (key, item) => {
    if (!key) return;
    marked.add(key);
    (byDay[key] ||= []).push(item);
  };
  for (const e of events) {
    const key = localDayKeyFromIso(e.payload.startAt);
    pushItem(key, { title: e.payload.title, when: e.payload.startAt, kind: '日程', sort: e.payload.startAt });
  }
  for (const t of todos) {
    const key = localDayKeyFromIso(t.payload.dueAt);
    pushItem(key, { title: t.payload.title, when: t.payload.dueAt, kind: '待办', sort: t.payload.dueAt });
  }
  // daily plans mark today and selected day lightly via reminder presence — mark all days in view? skip; only show in list if selected is today
  const todayKey = dayKey(new Date());
  if (plans.length) marked.add(todayKey);

  const cursor = state.calCursor;
  const selected = state.calSelected;
  const expanded = state.calExpanded;
  const cells = buildMonthCells(cursor);
  const monthLabel = `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`;

  const wrap = h('div', { className: 'cal-page' });
  const panel = h('section', {
    className: `cal-panel ${expanded ? 'is-open' : 'is-closed'}`,
    'aria-expanded': expanded,
  });

  const header = h('div', { className: 'cal-head' }, [
    h('button', {
      className: 'icon-btn',
      'aria-label': '上个月',
      html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg>',
      onClick: () => {
        state.calCursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
        render();
      },
    }),
    h('div', { className: 'cal-month grow' }, [
      h('h2', { text: monthLabel }),
      h('p', { className: 'muted', text: expanded ? '上拉收起日历' : '下拉展开日历' }),
    ]),
    h('button', {
      className: 'icon-btn',
      'aria-label': '下个月',
      html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>',
      onClick: () => {
        state.calCursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        render();
      },
    }),
  ]);

  const weekRow = h('div', { className: 'cal-weekdays' }, ['一', '二', '三', '四', '五', '六', '日'].map((w) => h('span', { text: w })));
  const grid = h('div', { className: 'cal-grid' });
  for (const cell of cells) {
    if (!cell) {
      grid.append(h('span', { className: 'cal-cell muted', text: '' }));
      continue;
    }
    const key = dayKey(cell);
    const isToday = key === todayKey;
    const isSel = key === selected;
    const hasMark = marked.has(key);
    grid.append(
      h('button', {
        type: 'button',
        className: `cal-cell ${isToday ? 'today' : ''} ${isSel ? 'sel' : ''} ${hasMark ? 'mark' : ''}`,
        text: String(cell.getDate()),
        'aria-label': `${key}${hasMark ? '，有事项' : ''}`,
        'aria-pressed': isSel,
        onClick: () => {
          state.calSelected = key;
          render();
        },
      })
    );
  }

  appendNodes(panel, header, h('div', { className: 'cal-body' }, [weekRow, grid]));

  const handle = h('button', {
    type: 'button',
    className: 'cal-pull',
    'aria-label': expanded ? '上拉收起日历' : '下拉展开日历',
    html: `<span class="cal-pull-bar"></span><span class="cal-pull-hint">${expanded ? '上拉隐藏' : '下拉展示'}</span>`,
    onClick: () => {
      state.calExpanded = !state.calExpanded;
      localStorage.setItem('lt_cal_expanded', state.calExpanded ? '1' : '0');
      render();
    },
  });

  const dayItems = (byDay[selected] || []).sort((a, b) => String(a.sort).localeCompare(String(b.sort)));
  const list = h('div', { className: 'cal-day-list' });
  const selDate = new Date(selected + 'T12:00:00');
  appendNodes(
    list,
    h('div', { className: 'section-label', text: `${selDate.getMonth() + 1}月${selDate.getDate()}日 · 事项` })
  );
  if (!dayItems.length) {
    appendNodes(
      list,
      emptyState('这天还没有安排', '点右下角新建日程，或给待办加上截止日。', '新建日程', () => openCreateForm('event'))
    );
  } else {
    for (const it of dayItems) {
      appendNodes(
        list,
        h('div', { className: 'card' }, [
          h('h3', { text: it.title }),
          h('p', { text: `${it.kind} · ${fmt(it.when)}` }),
        ])
      );
    }
  }

  // upcoming strip when calendar collapsed — still useful
  if (!expanded) {
    const upcoming = Object.keys(byDay)
      .filter((k) => k >= todayKey)
      .sort()
      .slice(0, 5)
      .flatMap((k) => byDay[k].map((it) => ({ ...it, day: k })));
    if (upcoming.length) {
      appendNodes(list, h('div', { className: 'section-label', text: '即将到来' }));
      for (const it of upcoming.slice(0, 4)) {
        appendNodes(
          list,
          h('div', {
            className: 'card pressable',
            onClick: () => {
              state.calSelected = it.day;
              state.calExpanded = true;
              localStorage.setItem('lt_cal_expanded', '1');
              const [y, m] = it.day.split('-').map(Number);
              state.calCursor = new Date(y, m - 1, 1);
              render();
            },
          }, [
            h('h3', { text: it.title }),
            h('p', { text: `${it.day} · ${it.kind}` }),
          ])
        );
      }
    }
  }

  appendNodes(wrap, panel, handle, list);
  // bind after mount — render() appends then we need bind; return wrap and bind in renderHome via requestAnimationFrame
  wrap._bindCalPull = () => bindCalPull(handle, panel.querySelector('.cal-body'));
  return wrap;
}

async function renderPlansBody() {
  const plans = await listActive('plan');
  const wrap = h('div');
  appendNodes(wrap, h('div', { className: 'section-label', text: '全部计划' }));
  if (!plans.length) {
    appendNodes(
      wrap,
      emptyState('还没有计划', '适合重复发生的家庭事项，每人单独打卡。', '新建计划', () => openCreateForm('plan'))
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
        if (!me) return toast('请先登录');
        fileInput.click();
      },
    },
    [me?.displayName?.[0] || '?', h('span', { className: 'cam', text: '✎' })]
  );

  const familyMode = api.isFamilyMode();
  const wrap = h('div', {}, [
    fileInput,
    h('div', { className: 'card row' }, [
      avatar,
      h('div', { className: 'grow' }, [
        h('h3', { text: me?.displayName || '未登录' }),
        h('p', {
          text: me
            ? `${roleLabel(me.role)} · @${me.username}`
            : '请先登录',
        }),
        h('p', {
          text: familyMode
            ? `家庭：${family?.name || '已连接'} · 可同步`
            : '本机账号 · 离线本地使用',
        }),
      ]),
    ]),
  ]);

  if (familyMode) {
    appendNodes(
      wrap,
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
                toast(r.skipped ? '当前无法同步' : `已同步，拉取 ${r.pullCount} 条`);
                render();
              } catch (e) {
                toast(e.message);
              }
            },
          }),
        ]),
        h('p', { className: 'muted', style: 'margin-top:8px', text: api.apiBase() }),
      ])
    );
  } else {
    appendNodes(
      wrap,
      h('div', { className: 'card' }, [
        h('h3', { text: '家庭服务器' }),
        h('p', {
          text: '现在只在本机使用，没有多端同步和家庭多账号关联。连接飞牛 NAS 后即可开启。',
        }),
        h('button', {
          className: 'btn secondary block',
          style: 'margin-top:12px',
          text: '连接家庭服务器',
          onClick: () => {
            state.screen = 'connect';
            render();
          },
        }),
      ])
    );
  }

  appendNodes(
    wrap,
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
    ])
  );

  if (familyMode && me?.role === 'admin') {
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
    h('button', {
      className: 'btn secondary block',
      text: '退出登录',
      onClick: async () => {
        if (familyMode) {
          try {
            await api.api('POST', '/api/auth/logout');
          } catch {
            /* ignore */
          }
        }
        api.logout();
        state.screen = api.hasLocalAccounts() ? 'local-login' : 'local-register';
        render();
      },
    }),
    familyMode
      ? h('button', {
          className: 'btn ghost block',
          text: '断开家庭服务器（改回本机使用）',
          onClick: () => {
            if (!confirm('断开后将停止同步，本机数据保留。可用本机账号继续离线使用。')) return;
            const localMember = api.getMember();
            api.clearApiBase();
            localStorage.removeItem('lt_token');
            if (localMember) {
              api.setLocalSession({
                id: localMember.id,
                displayName: localMember.displayName,
                username: localMember.username,
                role: localMember.role || 'admin',
                local: true,
              });
            } else {
              api.logout();
            }
            state.tab = 'me';
            state.screen = api.isLoggedIn() ? 'home' : 'local-login';
            toast('已改回本机使用');
            render();
          },
        })
      : null
  );
  return wrap;
}

function myId() {
  return api.getMember()?.id || 'guest';
}

function assignableMembers() {
  const me = api.getMember();
  let list = (state.members || []).filter((m) => !m.disabled);
  if (!list.length && me) list = [me];
  if (me?.role === 'adult') {
    // adults can assign other adults/self, not children as supervisors — keep children assignable as executors for todos/plans they create? PRD: adult can set other adult or self. For plans, adults creating plans...
    list = list.filter((m) => m.role !== 'child' || m.id === me.id);
  }
  return list;
}

function toLocalInput(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultDraft(type) {
  const id = myId();
  const today = dayKey(new Date());
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  const end = new Date(now.getTime() + 3600e3);
  const calDay = state.tab === 'cal' && state.calSelected ? state.calSelected : today;
  if (type === 'note') {
    return { title: '', body: '', visibility: 'self', memberIds: [], pinned: false, attachments: [] };
  }
  if (type === 'todo') {
    return {
      title: '',
      notes: '',
      due: '',
      reminderKind: 'none',
      customReminder: '',
      assigneeIds: [id],
      attachments: [],
    };
  }
  if (type === 'event') {
    return {
      title: '',
      allday: false,
      date: calDay,
      start: `${calDay}T${String(now.getHours()).padStart(2, '0')}:00`,
      end: toLocalInput(end).replace(/^\d{4}-\d{2}-\d{2}/, calDay),
      reminderKind: 'none',
      participantIds: [id],
      attachments: [],
    };
  }
  return {
    title: '',
    desc: '',
    cycleType: 'daily',
    weekdays: [1, 2, 3, 4, 5],
    monthDay: 1,
    interval: 2,
    start: today,
    end: '',
    remind: true,
    remindTime: '20:00',
    assigneeIds: [id],
    attachments: [],
  };
}

function openCreateSheet() {
  if (!api.isLoggedIn()) {
    state.screen = api.hasLocalAccounts() ? 'local-login' : 'local-register';
    toast('请先登录');
    render();
    return;
  }
  state.form = { mode: 'menu' };
  render();
}

function openCreateForm(type) {
  if (!api.isLoggedIn()) {
    state.screen = api.hasLocalAccounts() ? 'local-login' : 'local-register';
    toast('请先登录');
    render();
    return;
  }
  const me = api.getMember();
  if (me?.role === 'child' && (type === 'event' || type === 'plan')) {
    toast('儿童账号不能新建日程或计划');
    return;
  }
  state.form = { mode: 'edit', type, draft: defaultDraft(type), errors: {} };
  render();
}

function closeForm() {
  state.form = null;
  render();
}

function draftPatch(patch) {
  if (!state.form || state.form.mode !== 'edit') return;
  Object.assign(state.form.draft, patch);
  render();
}

function toggleId(list, id) {
  const set = new Set(list || []);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return [...set];
}

function fieldEl(label, control, err) {
  return h('div', { className: 'field' }, [
    h('label', { text: label }),
    control,
    err ? h('p', { className: 'err', text: err }) : null,
  ]);
}

function attachBlock(draft, entityType) {
  const file = h('input', { type: 'file', className: 'hidden', multiple: true });
  const row = h('div', { className: 'attach' });
  const refresh = () => {
    row.innerHTML = '';
    for (const a of draft.attachments) {
      const thumb = h('div', { className: 'thumb', text: a.fileName.slice(0, 6) });
      if (a.preview) {
        thumb.textContent = '';
        thumb.append(h('img', { src: a.preview, alt: '' }));
      }
      row.append(thumb);
    }
    row.append(
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
      if (draft.attachments.length >= 9) {
        toast('单条最多 9 个附件');
        break;
      }
      draft.attachments.push({
        file: fl,
        fileName: fl.name,
        preview: fl.type.startsWith('image/') ? URL.createObjectURL(fl) : null,
      });
    }
    refresh();
  });
  refresh();
  return h('div', {}, [
    h('p', { className: 'eyebrow', text: '照片或附件 · 单文件 ≤ 20MB' }),
    file,
    row,
  ]);
}

function peoplePicker(label, selectedIds, onChange, err) {
  // Multi-account assignment only after family server is connected.
  if (!api.isFamilyMode()) return null;
  const me = api.getMember();
  if (me?.role === 'child') {
    return h('div', {}, [
      h('h2', { className: 'block-title', text: label }),
      h('p', { className: 'muted', text: '执行人是你自己。' }),
    ]);
  }
  const list = assignableMembers();
  return h('div', {}, [
    h('h2', { className: 'block-title', text: label }),
    h(
      'div',
      { className: 'check-list' },
      list.map((m) =>
        h('button', {
          type: 'button',
          className: 'check-row',
          'aria-pressed': selectedIds.includes(m.id),
          onClick: () => onChange(toggleId(selectedIds, m.id)),
        }, [
          h('span', { className: 'box', text: selectedIds.includes(m.id) ? '✓' : '' }),
          h('span', { className: 'grow' }, [
            h('strong', { text: m.displayName }),
            h('span', { className: 'muted', text: roleLabel(m.role) }),
          ]),
        ])
      )
    ),
    err ? h('p', { className: 'err', text: err }) : null,
  ]);
}

async function uploadDraftAttachments(draft, type) {
  const ids = [];
  for (const a of draft.attachments || []) {
    const media = await api.uploadMedia(a.file, { purpose: 'attachment', parentType: type });
    ids.push(media.id);
  }
  return ids;
}

function computeTodoRemindAt(draft) {
  if (draft.reminderKind === 'none' || !draft.reminderKind) return null;
  if (draft.reminderKind === 'custom') {
    return draft.customReminder ? new Date(draft.customReminder).toISOString() : null;
  }
  if (!draft.due) return null;
  const due = new Date(draft.due);
  if (draft.reminderKind === 'due') return due.toISOString();
  if (draft.reminderKind === 'before1h') return new Date(due.getTime() - 3600e3).toISOString();
  return null;
}

function computeEventRemindAt(draft, startIso) {
  if (draft.reminderKind === 'none' || !draft.reminderKind) return null;
  const start = new Date(startIso);
  if (draft.allday) {
    if (draft.reminderKind === 'day9') {
      const d = new Date(draft.date + 'T09:00:00');
      return d.toISOString();
    }
    if (draft.reminderKind === 'prev9') {
      const d = new Date(draft.date + 'T09:00:00');
      d.setDate(d.getDate() - 1);
      return d.toISOString();
    }
  } else {
    if (draft.reminderKind === 'start') return start.toISOString();
    if (draft.reminderKind === 'm10') return new Date(start.getTime() - 600e3).toISOString();
    if (draft.reminderKind === 'h1') return new Date(start.getTime() - 3600e3).toISOString();
  }
  return null;
}

function renderCreateMenu() {
  const me = api.getMember();
  const isChild = me?.role === 'child';
  const items = isChild
    ? [
        ['note', '便签', '短记录，稍后再转待办', icons.today],
        ['todo', '待办', '要勾完的一件事', icons.plans],
      ]
    : [
        ['note', '便签', '短记录，稍后再转待办', icons.today],
        ['todo', '待办', '截止、提醒与执行人', icons.plans],
        ['event', '日程', '占用一段时间的安排', icons.cal],
        ['plan', '计划', '周期打卡，多人各自完成', icons.insights],
      ];
  // fix icons - note should use a note-like; use available set
  items[0][3] = icons.today;
  return h('div', {
    className: 'modal',
    onClick: (e) => {
      if (e.target.classList.contains('modal')) closeForm();
    },
  }, [
    h('div', { className: 'sheet', role: 'dialog', 'aria-label': '新建' }, [
      h('div', { className: 'handle' }),
      h('h2', { text: '新建' }),
      h(
        'div',
        { className: 'menu-list' },
        items.map(([type, title, desc, icon]) =>
          h('button', {
            type: 'button',
            className: 'menu-item',
            onClick: () => openCreateForm(type),
          }, [
            h('span', { className: 'mi', html: icon }),
            h('span', { className: 'grow' }, [
              h('strong', { text: title }),
              h('span', { text: desc }),
            ]),
            h('span', { className: 'chev', text: '›' }),
          ])
        )
      ),
    ]),
  ]);
}

function formShell(title, bodyNodes, onSave, saveLabel) {
  return h('div', { className: 'form-screen', role: 'dialog', 'aria-modal': 'true' }, [
    h('div', { className: 'top' }, [
      h('button', {
        className: 'btn ghost',
        text: '返回',
        onClick: () => {
          state.form = { mode: 'menu' };
          render();
        },
      }),
      h('h1', { text: title }),
    ]),
    h('div', { className: 'scroller' }, [
      ...bodyNodes,
      h('button', {
        className: 'btn lg block',
        style: 'margin-top:8px',
        text: saveLabel,
        onClick: onSave,
      }),
      h('button', {
        className: 'btn ghost block',
        text: '取消',
        onClick: closeForm,
      }),
    ]),
  ]);
}

function renderNoteForm(f) {
  const d = f.draft;
  const err = f.errors || {};
  const me = api.getMember();
  const title = h('input', { value: d.title, placeholder: '标题', maxlength: '40' });
  title.addEventListener('input', () => (d.title = title.value));
  const body = h('textarea', { rows: '4', placeholder: '想记的细节可以写在这里', maxlength: '1000' });
  body.value = d.body || '';
  body.addEventListener('input', () => (d.body = body.value));

  const familyMode = api.isFamilyMode();
  if (!familyMode) d.visibility = 'self';

  const visOptions = me?.role === 'child'
    ? [
        ['self', '仅自己', '只有你能看到这条便签'],
        ['members', '指定家长', '选择一位或多位家长一起看'],
      ]
    : [
        ['self', '仅自己', '只有你能看到，适合私人备忘'],
        ['members', '指定成员', '点选家人后，只有他们能看'],
        ['family', '全家成人', '所有成人和家长可见，孩子默认看不到'],
      ];

  const vis = familyMode
    ? h(
        'div',
        { className: 'vis-grid', role: 'group', 'aria-label': '谁可以看' },
        visOptions.map(([id, t, desc]) =>
          h('button', {
            type: 'button',
            className: 'vis-card',
            'aria-pressed': d.visibility === id,
            onClick: () => draftPatch({ visibility: id }),
          }, [
            h('span', { className: 'grow' }, [h('strong', { text: t }), h('span', { text: desc })]),
            h('span', { className: 'vis-check', text: '✓' }),
          ])
        )
      )
    : null;

  const pick =
    familyMode && d.visibility === 'members'
      ? peoplePicker('可见成员', d.memberIds || [], (ids) => draftPatch({ memberIds: ids }), err.memberIds)
      : null;

  return formShell(
    '写便签',
    [
      fieldEl('标题', title, err.title),
      fieldEl('正文', body),
      familyMode ? h('p', { className: 'eyebrow', text: '谁可以看' }) : null,
      vis,
      pick,
      h('label', { className: 'choice' }, [
        h('input', {
          type: 'checkbox',
          checked: d.pinned || false,
          onChange: (e) => draftPatch({ pinned: e.target.checked }),
        }),
        '置顶这条便签',
      ]),
      attachBlock(d, 'note'),
    ],
    async () => {
      f.errors = {};
      if (!d.title.trim() || d.title.trim().length > 40) {
        f.errors.title = '标题需 1–40 字';
        render();
        return;
      }
      const visibility = familyMode ? d.visibility : 'self';
      if (visibility === 'members' && !(d.memberIds || []).length) {
        f.errors.memberIds = '请至少选择一位成员';
        render();
        return;
      }
      try {
        const attachmentIds = await uploadDraftAttachments(d, 'note');
        await api.saveLocalEntity('note', {
          title: d.title.trim(),
          body: d.body || '',
          visibility,
          memberIds: visibility === 'members' ? d.memberIds : [],
          pinned: !!d.pinned,
          attachmentIds,
        });
        state.form = null;
        state.tab = 'today';
        toast('便签已保存');
        render();
        maybeSync();
      } catch (e) {
        toast(e.message);
      }
    },
    '保存便签'
  );
}

function renderTodoForm(f) {
  const d = f.draft;
  const err = f.errors || {};
  const title = h('input', { value: d.title, placeholder: '要做的事', maxlength: '80' });
  title.addEventListener('input', () => (d.title = title.value));
  const notes = h('textarea', { rows: '3', placeholder: '补充说明（可空）', maxlength: '500' });
  notes.value = d.notes || '';
  notes.addEventListener('input', () => (d.notes = notes.value));
  const due = h('input', { type: 'datetime-local', value: d.due || '' });
  due.addEventListener('change', () => draftPatch({ due: due.value }));

  const remind = h('select');
  [
    ['none', '不提醒'],
    ['due', '截止时', !d.due],
    ['before1h', '提前 1 小时', !d.due],
    ['custom', '自定义时间'],
  ].forEach(([v, label, disabled]) => {
    const opt = h('option', { value: v, text: label });
    if (disabled) opt.disabled = true;
    if (d.reminderKind === v) opt.selected = true;
    remind.append(opt);
  });
  remind.addEventListener('change', () => draftPatch({ reminderKind: remind.value }));

  const custom =
    d.reminderKind === 'custom'
      ? fieldEl(
          '提醒时间',
          (() => {
            const inp = h('input', { type: 'datetime-local', value: d.customReminder || '' });
            inp.addEventListener('change', () => draftPatch({ customReminder: inp.value }));
            return inp;
          })(),
          err.customReminder
        )
      : null;

  return formShell(
    '写待办',
    [
      fieldEl('标题', title, err.title),
      fieldEl('补充说明', notes),
      fieldEl('截止时间', due),
      fieldEl('提醒', remind),
      custom,
      peoplePicker('执行人', d.assigneeIds || [], (ids) => draftPatch({ assigneeIds: ids }), err.assignees),
      attachBlock(d, 'todo'),
    ],
    async () => {
      f.errors = {};
      if (!d.title.trim()) {
        f.errors.title = '请填写标题';
        render();
        return;
      }
      const assignees = d.assigneeIds?.length ? d.assigneeIds : [myId()];
      if (!assignees.length) {
        f.errors.assignees = '至少选择一名执行人';
        render();
        return;
      }
      if (d.reminderKind === 'custom') {
        if (!d.customReminder || new Date(d.customReminder).getTime() <= Date.now()) {
          f.errors.customReminder = '提醒时间要晚于现在';
          render();
          return;
        }
      }
      try {
        const attachmentIds = await uploadDraftAttachments(d, 'todo');
        await api.saveLocalEntity('todo', {
          title: d.title.trim(),
          notes: d.notes || '',
          dueAt: d.due ? new Date(d.due).toISOString() : null,
          reminderKind: d.reminderKind,
          remindAt: computeTodoRemindAt(d),
          assigneeIds: assignees,
          completions: {},
          attachmentIds,
        });
        state.form = null;
        state.tab = 'today';
        toast('待办已保存');
        render();
        maybeSync();
      } catch (e) {
        toast(e.message);
      }
    },
    '保存待办'
  );
}

function renderEventForm(f) {
  const d = f.draft;
  const err = f.errors || {};
  const title = h('input', { value: d.title, placeholder: '日程标题', maxlength: '80' });
  title.addEventListener('input', () => (d.title = title.value));

  const allday = h('label', { className: 'choice' }, [
    h('input', {
      type: 'checkbox',
      checked: !!d.allday,
      onChange: (e) => draftPatch({ allday: e.target.checked }),
    }),
    '全天',
  ]);

  let timeFields;
  if (d.allday) {
    const date = h('input', { type: 'date', value: d.date || dayKey(new Date()) });
    date.addEventListener('change', () => draftPatch({ date: date.value }));
    const kind = h('select');
    [
      ['none', '不提醒'],
      ['day9', '当天 09:00'],
      ['prev9', '提前一天 09:00'],
    ].forEach(([v, label]) => {
      const opt = h('option', { value: v, text: label });
      if (d.reminderKind === v) opt.selected = true;
      kind.append(opt);
    });
    kind.addEventListener('change', () => draftPatch({ reminderKind: kind.value }));
    timeFields = [fieldEl('日期', date, err.date), fieldEl('提醒', kind)];
  } else {
    const start = h('input', { type: 'datetime-local', value: d.start || '' });
    start.addEventListener('change', () => draftPatch({ start: start.value }));
    const end = h('input', { type: 'datetime-local', value: d.end || '' });
    end.addEventListener('change', () => draftPatch({ end: end.value }));
    const kind = h('select');
    [
      ['none', '不提醒'],
      ['start', '开始时'],
      ['m10', '提前 10 分钟'],
      ['h1', '提前 1 小时'],
    ].forEach(([v, label]) => {
      const opt = h('option', { value: v, text: label });
      if (d.reminderKind === v) opt.selected = true;
      kind.append(opt);
    });
    kind.addEventListener('change', () => draftPatch({ reminderKind: kind.value }));
    timeFields = [
      fieldEl('开始', start, err.start),
      fieldEl('结束', end, err.end),
      fieldEl('提醒', kind),
    ];
  }

  return formShell(
    '新建日程',
    [
      fieldEl('标题', title, err.title),
      allday,
      ...timeFields,
      peoplePicker('参与人', d.participantIds || [], (ids) => draftPatch({ participantIds: ids }), err.participants),
      attachBlock(d, 'event'),
    ],
    async () => {
      f.errors = {};
      if (!d.title.trim()) {
        f.errors.title = '请填写标题';
        render();
        return;
      }
      const participants = d.participantIds?.length ? d.participantIds : [myId()];
      if (!participants.length) {
        f.errors.participants = '至少选择一名参与人';
        render();
        return;
      }
      let startAt;
      let endAt;
      if (d.allday) {
        if (!d.date) {
          f.errors.date = '请选择日期';
          render();
          return;
        }
        startAt = new Date(d.date + 'T00:00:00').toISOString();
        endAt = new Date(d.date + 'T23:59:59').toISOString();
      } else {
        if (!d.start) {
          f.errors.start = '请填写开始时间';
          render();
          return;
        }
        if (!d.end || new Date(d.end) <= new Date(d.start)) {
          f.errors.end = '结束时间必须晚于开始时间';
          render();
          return;
        }
        startAt = new Date(d.start).toISOString();
        endAt = new Date(d.end).toISOString();
      }
      try {
        const attachmentIds = await uploadDraftAttachments(d, 'event');
        await api.saveLocalEntity('event', {
          title: d.title.trim(),
          allDay: !!d.allday,
          startAt,
          endAt,
          reminderKind: d.reminderKind,
          remindAt: computeEventRemindAt(d, startAt),
          participantIds: participants,
          attachmentIds,
        });
        state.form = null;
        state.tab = 'cal';
        if (d.allday && d.date) state.calSelected = d.date;
        else if (d.start) state.calSelected = dayKey(new Date(d.start));
        toast('日程已保存');
        render();
        maybeSync();
      } catch (e) {
        toast(e.message);
      }
    },
    '保存日程'
  );
}

function renderPlanForm(f) {
  const d = f.draft;
  const err = f.errors || {};
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  const title = h('input', { value: d.title, placeholder: '计划标题', maxlength: '80' });
  title.addEventListener('input', () => (d.title = title.value));
  const desc = h('textarea', { rows: '3', placeholder: '说明（可空）' });
  desc.value = d.desc || '';
  desc.addEventListener('input', () => (d.desc = desc.value));

  const cycle = h('select');
  [
    ['daily', '每天'],
    ['weekly', '每周'],
    ['monthly', '每月'],
    ['interval', '每 N 天'],
  ].forEach(([v, label]) => {
    const opt = h('option', { value: v, text: label });
    if (d.cycleType === v) opt.selected = true;
    cycle.append(opt);
  });
  cycle.addEventListener('change', () => draftPatch({ cycleType: cycle.value }));

  let extra = null;
  if (d.cycleType === 'weekly') {
    extra = h('div', {}, [
      h('h2', { className: 'block-title', text: '星期' }),
      h(
        'div',
        { className: 'days' },
        [1, 2, 3, 4, 5, 6, 0].map((n) =>
          h('button', {
            type: 'button',
            'aria-pressed': (d.weekdays || []).includes(n),
            text: WEEK[n],
            onClick: () => draftPatch({ weekdays: toggleId(d.weekdays || [], n) }),
          })
        )
      ),
      err.weekdays ? h('p', { className: 'err', text: err.weekdays }) : null,
    ]);
  } else if (d.cycleType === 'monthly') {
    const inp = h('input', { type: 'number', min: '1', max: '28', value: String(d.monthDay || 1) });
    inp.addEventListener('change', () => draftPatch({ monthDay: Number(inp.value) || 1 }));
    extra = fieldEl('每月几日（1–28）', inp, err.monthDay);
  } else if (d.cycleType === 'interval') {
    const inp = h('input', { type: 'number', min: '2', max: '30', value: String(d.interval || 2) });
    inp.addEventListener('change', () => draftPatch({ interval: Number(inp.value) || 2 }));
    extra = fieldEl('间隔天数（2–30）', inp, err.interval);
  }

  const start = h('input', { type: 'date', value: d.start || dayKey(new Date()) });
  start.addEventListener('change', () => draftPatch({ start: start.value }));
  const end = h('input', { type: 'date', value: d.end || '' });
  end.addEventListener('change', () => draftPatch({ end: end.value }));

  const remind = h('label', { className: 'choice' }, [
    h('input', {
      type: 'checkbox',
      checked: !!d.remind,
      onChange: (e) => draftPatch({ remind: e.target.checked }),
    }),
    '每个发生日提醒',
  ]);
  const remindTime = d.remind
    ? fieldEl(
        '提醒时刻',
        (() => {
          const inp = h('input', { type: 'time', value: d.remindTime || '20:00' });
          inp.addEventListener('change', () => draftPatch({ remindTime: inp.value }));
          return inp;
        })()
      )
    : null;

  return formShell(
    '新建计划',
    [
      fieldEl('标题', title, err.title),
      fieldEl('说明', desc),
      fieldEl('周期', cycle),
      extra,
      fieldEl('开始日期', start, err.start),
      fieldEl('结束日期（可空）', end, err.end),
      remind,
      remindTime,
      peoplePicker('执行人', d.assigneeIds || [], (ids) => draftPatch({ assigneeIds: ids }), err.assignees),
      attachBlock(d, 'plan'),
    ],
    async () => {
      f.errors = {};
      if (!d.title.trim()) {
        f.errors.title = '请填写标题';
        render();
        return;
      }
      if (d.cycleType === 'weekly' && !(d.weekdays || []).length) {
        f.errors.weekdays = '请至少选择一个星期';
        render();
        return;
      }
      if (d.cycleType === 'monthly') {
        const day = Number(d.monthDay);
        if (!day || day < 1 || day > 28) {
          f.errors.monthDay = '请填写 1–28 日';
          render();
          return;
        }
      }
      if (d.cycleType === 'interval') {
        const n = Number(d.interval);
        if (!n || n < 2 || n > 30) {
          f.errors.interval = '间隔需为 2–30 天';
          render();
          return;
        }
      }
      if (!d.start) {
        f.errors.start = '请选择开始日期';
        render();
        return;
      }
      if (d.end && d.end < d.start) {
        f.errors.end = '结束日期不能早于开始日期';
        render();
        return;
      }
      const assignees = d.assigneeIds?.length ? d.assigneeIds : [myId()];
      if (!assignees.length) {
        f.errors.assignees = '至少选择一名执行人';
        render();
        return;
      }
      try {
        const attachmentIds = await uploadDraftAttachments(d, 'plan');
        await api.saveLocalEntity('plan', {
          title: d.title.trim(),
          notes: d.desc || '',
          cycle: d.cycleType,
          weekdays: d.cycleType === 'weekly' ? d.weekdays : [],
          monthDay: d.cycleType === 'monthly' ? Number(d.monthDay) : null,
          interval: d.cycleType === 'interval' ? Number(d.interval) : null,
          startDate: d.start,
          endDate: d.end || null,
          reminder: d.remind ? d.remindTime || '20:00' : null,
          executorIds: assignees,
          archived: false,
          attachmentIds,
        });
        state.form = null;
        state.tab = 'plans';
        toast('计划已保存');
        render();
        maybeSync();
      } catch (e) {
        toast(e.message);
      }
    },
    '保存计划'
  );
}

function renderCreateModal() {
  if (!state.form) return null;
  if (state.form.mode === 'menu') return renderCreateMenu();
  if (state.form.mode === 'edit') {
    if (state.form.type === 'note') return renderNoteForm(state.form);
    if (state.form.type === 'todo') return renderTodoForm(state.form);
    if (state.form.type === 'event') return renderEventForm(state.form);
    if (state.form.type === 'plan') return renderPlanForm(state.form);
  }
  // legacy fallback
  return null;
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
  const familyMode = api.isFamilyMode();
  const top =
    state.tab === 'today'
      ? h('div', { className: 'top' }, [
          h('div', { className: 'greeting' }, [
            h('p', { className: 'eyebrow', text: fmtDateNice() }),
            h('h1', { text: `${hello()}${me ? '，' + me.displayName : ''}` }),
          ]),
          familyMode
            ? h('button', {
                className: 'icon-btn',
                'aria-label': '同步',
                html: icons.sync,
                onClick: async () => {
                  try {
                    const r = await api.syncNow();
                    toast(r.skipped ? '当前无法同步' : `已同步 ${r.pullCount} 条`);
                    render();
                  } catch (e) {
                    toast(e.message);
                  }
                },
              })
            : null,
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
  if (state.screen === 'home' && !api.isLoggedIn()) {
    state.screen = api.hasLocalAccounts() ? 'local-login' : 'local-register';
  }
  root.innerHTML = '';
  root.append(h('div', { id: 'toast', className: 'toast', role: 'status' }));
  let view;
  if (state.screen === 'local-register') view = renderLocalRegister();
  else if (state.screen === 'local-login') view = renderLocalLogin();
  else if (state.screen === 'connect') view = renderConnect();
  else if (state.screen === 'setup') view = renderSetup();
  else if (state.screen === 'family-login') view = renderFamilyLogin();
  else if (state.screen === 'merge') view = renderMerge();
  else view = await renderHome();
  root.append(view);
  const focusEl = root.querySelector('.form-screen input, .form-screen textarea, .sheet .menu-item');
  if (focusEl && focusEl.tagName !== 'BUTTON') setTimeout(() => focusEl.focus(), 50);
  const calPage = root.querySelector('.cal-page');
  if (calPage && typeof calPage._bindCalPull === 'function') {
    requestAnimationFrame(() => calPage._bindCalPull());
  }
}

boot();
