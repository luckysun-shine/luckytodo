import { css } from './src/styles.js';
import * as api from './src/api.js';
import * as db from './src/db.js';
import * as reminders from './src/reminders.js';
import * as native from './src/native.js';
import * as widget from './src/widgetBridge.js';

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
  planId: null,
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
  if (!api.isFamilyMode() || !state.online) {
    widget.publishWidgetSnapshot().catch(() => {});
    return;
  }
  try {
    await api.syncNow();
    await loadMembers();
    const all = await db.allEntities();
    reminders.reschedule(all).catch(() => {});
    widget.publishWidgetSnapshot().catch(() => {});
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
  widget.publishWidgetSnapshot().catch(() => {});
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
  native.registerServiceWorker();
  await native.initNative().catch(() => {});
  bindDeepLinks();
  if (!api.isLoggedIn()) {
    state.screen = api.hasLocalAccounts() ? 'local-login' : 'local-register';
    render();
    hideBootSplash();
    widget.publishWidgetSnapshot().catch(() => {});
    return;
  }
  state.screen = 'home';
  await loadMembers();
  try {
    const drafts = await widget.consumeWidgetDrafts();
    if (drafts?.length) toast(`已从桌面组件同步 ${drafts.length} 条`);
  } catch {
    /* ignore */
  }
  render();
  hideBootSplash();
  maybeSync().then(render);
  widget.publishWidgetSnapshot().catch(() => {});
}

function bindDeepLinks() {
  const apply = (url) => {
    const info = widget.handleDeepLink(url);
    if (!info) return;
    if (info.tab) state.tab = info.tab;
    if (info.path === 'create' || info.day) {
      openCreateForm(info.type === 'event' ? 'event' : 'todo');
      return;
    }
    if (info.path === 'item' && info.type === 'plan' && info.id) {
      openPlanDetail(info.id);
      return;
    }
    state.screen = 'home';
    render();
  };
  document.addEventListener('click', () => {}, { once: true });
  if (window.Capacitor?.Plugins?.App?.addListener) {
    window.Capacitor.Plugins.App.addListener('appUrlOpen', (data) => {
      if (data?.url) apply(data.url);
    });
  }
  // also handle cold start query if present
  if (location.hash.startsWith('#luckytodo')) apply(location.hash.slice(1));
}

function hideBootSplash() {
  const el = document.getElementById('boot-splash');
  if (!el) return;
  requestAnimationFrame(() => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 400);
  });
}

const ICONS_EYE = {
  show: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  hide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l18 18"/><path d="M10.6 10.6a2.5 2.5 0 0 0 3.5 3.5"/><path d="M9.9 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.5 17.5 0 0 1-3.2 4.3"/><path d="M6.1 6.1C4 7.8 2.5 10.2 2 12c0 0 3.5 7 10 7a10.4 10.4 0 0 0 4.3-.9"/></svg>',
};

function authHero({ title, lead, tag = '家庭待办 · 本机优先' }) {
  return h('header', { className: 'auth-hero' }, [
    h('div', { className: 'wordmark' }, [
      h('img', {
        className: 'mark-img',
        src: './public/logo.png',
        alt: 'LuckyTodo',
        width: '48',
        height: '48',
        decoding: 'async',
      }),
      h('div', {}, [
        h('div', { className: 'product', text: 'LuckyTodo' }),
        h('p', { className: 'tag', text: tag }),
      ]),
    ]),
    h('h1', { text: title }),
    h('p', { className: 'lead', text: lead }),
  ]);
}

function authPasswordField(label, { autocomplete = 'current-password', hint } = {}) {
  const input = h('input', { type: 'password', autocomplete });
  let shown = false;
  const eye = h('button', {
    type: 'button',
    className: 'eye',
    'aria-label': '显示密码',
    html: ICONS_EYE.show,
    onClick: () => {
      shown = !shown;
      input.type = shown ? 'text' : 'password';
      eye.setAttribute('aria-label', shown ? '隐藏密码' : '显示密码');
      eye.innerHTML = shown ? ICONS_EYE.hide : ICONS_EYE.show;
    },
  });
  return {
    input,
    el: h('div', { className: 'field field-password' }, [
      h('label', { text: label }),
      input,
      eye,
      hint ? h('p', { className: 'hint', text: hint }) : null,
    ]),
  };
}

function authTextField(label, { type = 'text', autocomplete = 'off', placeholder = '', hint } = {}) {
  const input = h('input', { type, autocomplete, placeholder });
  return {
    input,
    el: h('div', { className: 'field' }, [
      h('label', { text: label }),
      input,
      hint ? h('p', { className: 'hint', text: hint }) : null,
    ]),
  };
}

function authShell({ hero, panel, cta, foot, back, onSubmit }) {
  const shell = h('div', { className: 'screen auth' }, [
    h('div', { className: 'auth-shell' }, [
      back || null,
      hero,
      h('div', { className: 'auth-panel' }, panel),
      h('div', { className: 'auth-cta' }, cta),
      foot ? h('div', { className: 'auth-foot' }, foot) : null,
    ]),
  ]);
  if (typeof onSubmit === 'function') {
    shell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        e.preventDefault();
        onSubmit();
      }
    });
  }
  return shell;
}

function setBusy(btn, busy, idleText) {
  btn.disabled = !!busy;
  btn.textContent = busy || idleText;
}

function renderLocalRegister() {
  const name = authTextField('怎么称呼你', {
    autocomplete: 'nickname',
    placeholder: '例如：小明',
    hint: '显示在问候语和待办里',
  });
  const user = authTextField('用户名', {
    autocomplete: 'username',
    placeholder: '小写字母或数字',
    hint: '3–20 位，登录时使用',
  });
  const pass = authPasswordField('设置密码', {
    autocomplete: 'new-password',
    hint: '至少 6 位',
  });
  const pass2 = authPasswordField('确认密码', { autocomplete: 'new-password' });
  const doRegister = async () => {
    if (!name.input.value.trim()) return toast('请填写称呼');
    if (pass.input.value !== pass2.input.value) return toast('两次密码不一致');
    setBusy(submit, '创建中…', '创建账号');
    try {
      await api.createLocalAccount({
        displayName: name.input.value,
        username: user.input.value,
        password: pass.input.value,
      });
      await afterLocalLogin();
    } catch (e) {
      toast(e.message);
      setBusy(submit, null, '创建账号');
    }
  };
  const submit = h('button', {
    className: 'btn lg block',
    text: '创建账号',
    onClick: doRegister,
  });

  return authShell({
    hero: authHero({
      title: '创建你的账号',
      lead: '先完成本机注册即可开始使用。家庭服务器可以以后再连，不影响日常记录。',
      tag: '首次使用 · 本机账号',
    }),
    panel: [name.el, user.el, pass.el, pass2.el],
    cta: [
      submit,
      h('p', { className: 'auth-switch' }, [
        '已有账号？',
        h('button', {
          type: 'button',
          text: '去登录',
          onClick: () => {
            state.screen = 'local-login';
            render();
          },
        }),
      ]),
    ],
    foot: [
      h('div', { className: 'auth-chip' }, [
        h('span', { className: 'dot', 'aria-hidden': 'true' }),
        h('span', { text: '数据默认保存在本机，不强制联网' }),
      ]),
    ],
    onSubmit: doRegister,
  });
}

function renderLocalLogin() {
  const user = authTextField('用户名', {
    autocomplete: 'username',
    placeholder: '输入用户名',
  });
  const pass = authPasswordField('密码', { autocomplete: 'current-password' });
  const doLogin = async () => {
    if (!user.input.value.trim()) return toast('请填写用户名');
    if (!pass.input.value) return toast('请填写密码');
    setBusy(submit, '登录中…', '登录');
    try {
      await api.loginLocalAccount({ username: user.input.value, password: pass.input.value });
      await afterLocalLogin();
    } catch (e) {
      toast(e.message);
      setBusy(submit, null, '登录');
    }
  };
  const submit = h('button', {
    className: 'btn lg block',
    text: '登录',
    onClick: doLogin,
  });

  return authShell({
    hero: authHero({
      title: '欢迎回来',
      lead: '登录本机账号，继续管理待办、日程与家庭计划。',
      tag: '本机账号',
    }),
    panel: [user.el, pass.el],
    cta: [
      submit,
      h('p', { className: 'auth-switch' }, [
        '还没有账号？',
        h('button', {
          type: 'button',
          text: '立即注册',
          onClick: () => {
            state.screen = 'local-register';
            render();
          },
        }),
      ]),
    ],
    foot: [
      h('div', { className: 'auth-chip' }, [
        h('span', { className: 'dot', 'aria-hidden': 'true' }),
        h('span', { text: '未连接家庭服务器时，仅本机可用' }),
      ]),
    ],
    onSubmit: doLogin,
  });
}

function renderConnect() {
  const url = authTextField('服务器地址', {
    type: 'url',
    autocomplete: 'url',
    placeholder: 'https://todo.home.example.com',
    hint: '请填写飞牛 NAS 上的 HTTPS 地址',
  });
  url.input.value = api.apiBase() || 'https://';
  url.input.setAttribute('inputmode', 'url');
  const submit = h('button', {
    className: 'btn lg block',
    text: '检查并继续',
    onClick: async () => {
      const val = url.input.value.trim().replace(/\/$/, '');
      if (!val) return toast('请填写服务器地址');
      if (!/^https:\/\//i.test(val) && location.hostname !== '127.0.0.1' && location.hostname !== 'localhost') {
        toast('请使用 HTTPS 地址');
      }
      api.setApiBase(val);
      setBusy(submit, '连接中…', '检查并继续');
      try {
        const health = await api.health();
        toast(health.initialized ? '已连接，请登录家庭账号' : '已连接，可以创建家庭');
        state.health = health;
        state.screen = health.initialized ? 'family-login' : 'setup';
        render();
      } catch (e) {
        toast(e.message || '连不上服务器，请检查地址与网络');
        setBusy(submit, null, '检查并继续');
      }
    },
  });

  return authShell({
    back: h('button', {
      type: 'button',
      className: 'auth-back',
      text: '← 返回',
      onClick: () => {
        state.screen = api.isLoggedIn() ? 'home' : api.hasLocalAccounts() ? 'local-login' : 'local-register';
        if (state.screen === 'home') state.tab = 'me';
        render();
      },
    }),
    hero: authHero({
      title: '连接家庭服务器',
      lead: '连上 NAS 后，家人可共用账号空间，并在多台设备间同步。',
      tag: '可选 · 家庭同步',
    }),
    panel: [url.el],
    cta: [submit],
    foot: [
      h('div', { className: 'auth-chip' }, [
        h('span', { className: 'dot', 'aria-hidden': 'true' }),
        h('span', { text: '不连也可以，继续本机离线使用' }),
      ]),
    ],
  });
}

function renderSetup() {
  const familyName = authTextField('家庭名称', {
    autocomplete: 'organization',
    placeholder: '例如：我们家',
  });
  const displayName = authTextField('你的显示名', {
    autocomplete: 'nickname',
    placeholder: '家人看到的名字',
  });
  const username = authTextField('用户名', {
    autocomplete: 'username',
    placeholder: '小写字母或数字',
    hint: '3–20 位',
  });
  const password = authPasswordField('设置密码', {
    autocomplete: 'new-password',
    hint: '至少 6 位',
  });
  const password2 = authPasswordField('确认密码', { autocomplete: 'new-password' });
  const submit = h('button', {
    className: 'btn lg block',
    text: '创建家庭',
    onClick: async () => {
      if (password.input.value !== password2.input.value) return toast('两次密码不一致');
      setBusy(submit, '创建中…', '创建家庭');
      try {
        const session = await api.api('POST', '/api/setup/family', {
          token: '',
          body: {
            familyName: familyName.input.value,
            displayName: displayName.input.value,
            username: username.input.value,
            password: password.input.value,
          },
        });
        await afterLogin(session);
      } catch (e) {
        toast(e.message);
        setBusy(submit, null, '创建家庭');
      }
    },
  });

  return authShell({
    back: h('button', {
      type: 'button',
      className: 'auth-back',
      text: '← 更换服务器',
      onClick: () => {
        state.screen = 'connect';
        render();
      },
    }),
    hero: authHero({
      title: '创建家庭空间',
      lead: '在 NAS 上建立家庭，你将成为管理员。时区为中国标准时间。',
      tag: '家庭服务器',
    }),
    panel: [familyName.el, displayName.el, username.el, password.el, password2.el],
    cta: [submit],
  });
}

function renderFamilyLogin() {
  const user = authTextField('用户名', { autocomplete: 'username', placeholder: '家庭账号用户名' });
  const pass = authPasswordField('密码', { autocomplete: 'current-password' });
  const submit = h('button', {
    className: 'btn lg block',
    text: '登录',
    onClick: async () => {
      if (!user.input.value.trim()) return toast('请填写用户名');
      setBusy(submit, '登录中…', '登录');
      try {
        const session = await api.api('POST', '/api/auth/login', {
          token: '',
          body: { username: user.input.value, password: pass.input.value },
        });
        await afterLogin(session);
      } catch (e) {
        toast(e.message);
        setBusy(submit, null, '登录');
      }
    },
  });

  return authShell({
    back: h('button', {
      type: 'button',
      className: 'auth-back',
      text: '← 更换服务器',
      onClick: () => {
        state.screen = 'connect';
        render();
      },
    }),
    hero: authHero({
      title: '登录家庭账号',
      lead: '登录后可与家人关联，并在联网时自动同步。',
      tag: api.apiBase() ? `服务器 · ${api.apiBase().replace(/^https?:\/\//, '')}` : '家庭服务器',
    }),
    panel: [user.el, pass.el],
    cta: [submit],
  });
}

function renderMerge() {
  return authShell({
    hero: authHero({
      title: '合并本机记录？',
      lead: `检测到本机有 ${state.mergeCount || 0} 条离线记录。合并后归入当前家庭账号，联网后自动同步。`,
      tag: '数据合并',
    }),
    panel: [],
    cta: [
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
    ],
  });
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
            if (!done) native.lightTap();
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
    const prog = milestoneProgress(p.payload.milestones);
    appendNodes(
      wrap,
      h('div', { className: 'card pressable', onClick: () => openPlanDetail(p.id) }, [
        h('h3', { text: p.payload.title }),
        h('p', {
          text: [
            `${execs.length || 1} 人执行`,
            p.payload.reminder ? `提醒 ${p.payload.reminder}` : null,
            prog ? `里程碑 ${prog.done}/${prog.total}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
        }),
        mine
          ? h('button', {
              className: 'btn secondary',
              style: 'margin-top:12px',
              text: '打卡',
              onClick: async (e) => {
                e.stopPropagation();
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

  const today = dayKey(new Date());
  const dueMilestones = [];
  for (const p of activePlans) {
    for (const ms of p.payload.milestones || []) {
      if (ms.status === 'done') continue;
      if (ms.dueDate && ms.dueDate <= today) {
        dueMilestones.push({ plan: p, ms });
      }
    }
  }
  if (dueMilestones.length) {
    appendNodes(wrap, h('div', { className: 'section-label', text: `里程碑 · ${dueMilestones.length} 个待处理` }));
    for (const { plan, ms } of dueMilestones.slice(0, 8)) {
      const tone = milestoneTone(ms);
      appendNodes(
        wrap,
        h('div', { className: 'card' }, [
          h('h3', { text: ms.title }),
          h('p', {
            text: `${plan.payload.title} · ${ms.dueDate}${tone === 'overdue' ? ' · 已逾期' : ' · 今日到期'}${ms.remind && ms.remindTime ? ` · 提醒 ${ms.remindTime}` : ''}`,
          }),
          h('div', { className: 'ms-actions' }, [
            h('button', {
              className: 'btn',
              text: '完成并记录',
              onClick: () => promptMilestoneProgress(plan, ms),
            }),
            h('button', {
              className: 'btn ghost',
              text: '查看计划',
              onClick: () => openPlanDetail(plan.id),
            }),
          ]),
        ])
      );
    }
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
  // daily plans mark today; milestones mark their due dates
  const todayKey = dayKey(new Date());
  if (plans.length) marked.add(todayKey);
  for (const p of plans) {
    for (const ms of p.payload.milestones || []) {
      if (!ms.dueDate) continue;
      pushItem(ms.dueDate, {
        title: `${p.payload.title} · ${ms.title}`,
        when: ms.dueDate,
        kind: ms.status === 'done' ? '里程碑·已完成' : '里程碑',
        sort: `${ms.dueDate}T${ms.remindTime || '09:00'}:00`,
        planId: p.id,
      });
    }
  }

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
        h('div', {
          className: it.planId ? 'card pressable' : 'card',
          onClick: it.planId
            ? () => openPlanDetail(it.planId)
            : undefined,
        }, [
          h('h3', { text: it.title }),
          h('p', {
            text: `${it.kind} · ${it.when?.includes?.('T') ? fmt(it.when) : it.when}`,
          }),
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
      emptyState('还没有计划', '适合重复发生的家庭事项，也可拆成里程碑节点逐步推进。', '新建计划', () => openCreateForm('plan'))
    );
  }
  for (const p of plans) {
    const prog = milestoneProgress(p.payload.milestones);
    const cycleLabel = { daily: '每天', weekly: '每周', monthly: '每月', interval: '间隔' }[p.payload.cycle] || p.payload.cycle || '计划';
    appendNodes(
      wrap,
      h('div', {
        className: 'card pressable',
        onClick: () => openPlanDetail(p.id),
      }, [
        h('h3', { text: p.payload.title }),
        h('p', {
          text: p.payload.notes || `${cycleLabel} · ${(p.payload.executorIds || []).length || 1} 人`,
        }),
        prog
          ? h('div', {
              className: 'progress-pill',
              text: `里程碑 ${prog.done}/${prog.total} · ${prog.pct}%`,
            })
          : null,
      ])
    );
  }
  return wrap;
}

async function renderPlanDetail() {
  const plans = await listActive('plan');
  const plan = plans.find((p) => p.id === state.planId);
  if (!plan) {
    state.screen = 'home';
    state.tab = 'plans';
    state.planId = null;
    return renderHome();
  }
  const me = api.getMember();
  const milestones = [...(plan.payload.milestones || [])].sort((a, b) =>
    String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'))
  );
  const prog = milestoneProgress(milestones);
  const cycleLabel = { daily: '每天', weekly: '每周', monthly: '每月', interval: '间隔' }[plan.payload.cycle] || '计划';
  const wrap = h('div', { className: 'screen' }, [
    h('div', { className: 'top' }, [
      h('button', {
        className: 'auth-back',
        text: '← 计划',
        onClick: () => {
          state.screen = 'home';
          state.tab = 'plans';
          state.planId = null;
          render();
        },
      }),
      h('h1', { text: plan.payload.title }),
    ]),
    h('div', { className: 'scroller' }, [
      h('div', { className: 'card' }, [
        h('p', {
          className: 'eyebrow',
          text: `${cycleLabel}${plan.payload.reminder ? ` · 周期提醒 ${plan.payload.reminder}` : ''}`,
        }),
        plan.payload.notes ? h('p', { text: plan.payload.notes }) : h('p', { className: 'muted', text: '暂无说明' }),
        prog
          ? h('div', {
              className: 'progress-pill',
              text: `里程碑进度 ${prog.done}/${prog.total}`,
            })
          : null,
      ]),
      h('div', { className: 'section-label', text: '里程碑' }),
      milestones.length
        ? h(
            'div',
            { className: 'ms-timeline' },
            milestones.map((ms) => {
              const tone = milestoneTone(ms);
              const meta = [
                ms.dueDate ? `目标 ${ms.dueDate}` : '未设日期',
                ms.remind && ms.remindTime ? `提醒 ${ms.remindTime}` : null,
                ms.status === 'done' ? '已完成' : tone === 'overdue' ? '已逾期' : tone === 'due' ? '今日到期' : '进行中',
              ]
                .filter(Boolean)
                .join(' · ');
              return h('div', { className: `ms-node ${tone} ${ms.status === 'done' ? 'done' : ''}` }, [
                h('div', { className: 'ms-rail' }, [h('div', { className: 'ms-dot', 'aria-hidden': 'true' })]),
                h('div', { className: `ms-body ${ms.status === 'done' ? 'done' : ''}` }, [
                  h('h3', { text: ms.title }),
                  h('p', { className: 'ms-meta', text: meta }),
                  ms.progressNote ? h('div', { className: 'ms-note', text: ms.progressNote }) : null,
                  h('div', { className: 'ms-actions' }, [
                    ms.status !== 'done'
                      ? h('button', {
                          className: 'btn',
                          text: '完成并记录',
                          onClick: () => promptMilestoneProgress(plan, ms),
                        })
                      : h('button', {
                          className: 'btn secondary',
                          text: '更新完成情况',
                          onClick: async () => {
                            const note = prompt('更新完成情况', ms.progressNote || '');
                            if (note === null) return;
                            await updateMilestone(plan, ms.id, {
                              progressNote: String(note).slice(0, 200),
                            });
                            toast('已更新');
                            render();
                            maybeSync();
                          },
                        }),
                    ms.status === 'done'
                      ? h('button', {
                          className: 'btn ghost',
                          text: '标为未完成',
                          onClick: async () => {
                            await updateMilestone(plan, ms.id, {
                              status: 'open',
                              completedAt: null,
                              completedBy: null,
                            });
                            toast('已恢复为进行中');
                            render();
                            maybeSync();
                          },
                        })
                      : null,
                  ]),
                ]),
              ]);
            })
          )
        : emptyState('还没有里程碑', '编辑计划时可添加节点，用于分阶段提醒与记录进度。', null),
      h('div', { style: 'height:16px' }),
      h('button', {
        className: 'btn secondary block',
        text: '今日打卡（周期）',
        onClick: async () => {
          const feedback = prompt('一句反馈（可空）') || '';
          await api.saveLocalEntity('checkin', {
            planId: plan.id,
            memberId: me?.id || 'guest',
            date: dayKey(new Date()),
            status: 'done',
            feedback,
          });
          toast('打卡成功');
          render();
          maybeSync();
        },
      }),
    ]),
  ]);
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
    (() => {
      let snap = null;
      try {
        snap = JSON.parse(localStorage.getItem('lt_widget_snapshot') || 'null');
      } catch {
        snap = null;
      }
      const remCount = (snap?.reminders || []).filter((r) => !r.done).length;
      const markCount = (snap?.markedDays || []).length;
      const updated = snap?.updatedAt ? fmt(snap.updatedAt) : '尚未生成';
      return [
        h('div', { className: 'section-label', text: '主屏组件' }),
        h('div', { className: 'card' }, [
          h('h3', { text: '今日提醒 / 家庭日历' }),
          h('p', {
            text: snap
              ? `今日提醒 ${remCount} 条 · 日历落点 ${markCount} 天`
              : '打开 App 并登录后会写入组件快照',
          }),
          h('p', { className: 'muted', text: `最近快照：${updated}` }),
          h('p', {
            className: 'muted',
            style: 'margin-top:8px',
            text: '长按主屏 → 添加组件 → LuckyTodo。需 iOS 17+ 与 App Group 签名。',
          }),
          h('button', {
            className: 'btn secondary block',
            style: 'margin-top:12px',
            text: '刷新组件数据',
            onClick: async () => {
              try {
                await widget.publishWidgetSnapshot();
                toast('已刷新主屏组件快照');
                render();
              } catch (e) {
                toast(e.message || '刷新失败');
              }
            },
          }),
        ]),
      ];
    })(),
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
        widget.publishWidgetSnapshot().catch(() => {});
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
            widget.publishWidgetSnapshot().catch(() => {});
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

function newMilestoneDraft() {
  return {
    id: db.uuid(),
    title: '',
    dueDate: '',
    remind: false,
    remindTime: '09:00',
  };
}

function normalizeMilestones(list) {
  return (list || [])
    .filter((m) => String(m.title || '').trim())
    .map((m) => ({
      id: m.id || db.uuid(),
      title: String(m.title).trim().slice(0, 80),
      dueDate: m.dueDate || null,
      remind: !!(m.remind && m.dueDate),
      remindTime: m.remind && m.dueDate ? m.remindTime || '09:00' : null,
      status: m.status === 'done' ? 'done' : 'open',
      progressNote: String(m.progressNote || '').slice(0, 200),
      completedAt: m.completedAt || null,
      completedBy: m.completedBy || null,
    }));
}

function milestoneProgress(milestones) {
  const list = milestones || [];
  if (!list.length) return null;
  const done = list.filter((m) => m.status === 'done').length;
  return { total: list.length, done, pct: Math.round((done / list.length) * 100) };
}

function milestoneTone(ms) {
  if (ms.status === 'done') return 'done';
  if (!ms.dueDate) return '';
  const today = dayKey(new Date());
  if (ms.dueDate < today) return 'overdue';
  if (ms.dueDate === today) return 'due';
  return '';
}

function openPlanDetail(planId) {
  state.planId = planId;
  state.screen = 'plan-detail';
  state.form = null;
  render();
}

async function updateMilestone(planEntity, milestoneId, patch) {
  const milestones = [...(planEntity.payload.milestones || [])];
  const idx = milestones.findIndex((m) => m.id === milestoneId);
  if (idx < 0) throw new Error('找不到该里程碑');
  milestones[idx] = { ...milestones[idx], ...patch };
  await api.saveLocalEntity('plan', { ...planEntity.payload, milestones }, { id: planEntity.id });
  const all = await db.allEntities();
  reminders.reschedule(all).catch(() => {});
}

async function promptMilestoneProgress(planEntity, ms) {
  const note = prompt('补充完成情况（可空，最多 200 字）', ms.progressNote || '');
  if (note === null) return;
  const me = api.getMember();
  await updateMilestone(planEntity, ms.id, {
    status: 'done',
    progressNote: String(note).slice(0, 200),
    completedAt: db.nowIso(),
    completedBy: me?.id || null,
  });
  toast('里程碑已完成');
  render();
  maybeSync();
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
    milestones: [],
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
        ['plan', '计划', '周期打卡，可加里程碑节点', icons.insights],
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

  if (!Array.isArray(d.milestones)) d.milestones = [];
  const msEditor = h('div', {}, [
    h('h2', { className: 'block-title', text: '里程碑节点' }),
    h('p', { className: 'muted', style: 'margin:0 0 10px', text: '可选。到节点日提醒，并记录该节点的完成情况。' }),
    h(
      'div',
      { className: 'ms-list' },
      d.milestones.map((ms, i) => {
        const title = h('input', { value: ms.title || '', placeholder: `节点 ${i + 1} 名称`, maxlength: '80' });
        title.addEventListener('input', () => {
          ms.title = title.value;
        });
        const due = h('input', { type: 'date', value: ms.dueDate || '' });
        due.addEventListener('change', () => {
          ms.dueDate = due.value;
          draftPatch({});
        });
        const remindChk = h('label', { className: 'choice' }, [
          h('input', {
            type: 'checkbox',
            checked: !!ms.remind,
            disabled: !ms.dueDate,
            onChange: (e) => {
              ms.remind = e.target.checked;
              draftPatch({});
            },
          }),
          '到期日提醒',
        ]);
        const timeInp =
          ms.remind && ms.dueDate
            ? (() => {
                const inp = h('input', { type: 'time', value: ms.remindTime || '09:00' });
                inp.addEventListener('change', () => {
                  ms.remindTime = inp.value;
                });
                return fieldEl('提醒时刻', inp);
              })()
            : null;
        return h('div', { className: 'ms-row' }, [
          h('div', { className: 'ms-row-top' }, [
            h('div', { className: 'grow' }, [fieldEl('节点名称', title)]),
            h('button', {
              type: 'button',
              className: 'ms-remove',
              'aria-label': '删除节点',
              text: '×',
              onClick: () => {
                d.milestones = d.milestones.filter((_, j) => j !== i);
                draftPatch({});
              },
            }),
          ]),
          fieldEl('目标日期', due),
          remindChk,
          timeInp,
        ]);
      })
    ),
    h('button', {
      type: 'button',
      className: 'ms-add',
      text: '+ 添加里程碑',
      onClick: () => {
        if ((d.milestones || []).length >= 20) return toast('单条计划最多 20 个里程碑');
        d.milestones = [...(d.milestones || []), newMilestoneDraft()];
        draftPatch({});
      },
    }),
    err.milestones ? h('p', { className: 'err', text: err.milestones }) : null,
  ]);

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
      msEditor,
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
      const milestones = normalizeMilestones(d.milestones);
      for (const m of milestones) {
        if (m.dueDate && d.start && m.dueDate < d.start) {
          f.errors.milestones = '里程碑日期不能早于计划开始日';
          render();
          return;
        }
        if (m.dueDate && d.end && m.dueDate > d.end) {
          f.errors.milestones = '里程碑日期不能晚于计划结束日';
          render();
          return;
        }
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
          milestones,
          archived: false,
          attachmentIds,
        });
        state.form = null;
        state.tab = 'plans';
        toast(milestones.length ? `计划已保存 · ${milestones.length} 个里程碑` : '计划已保存');
        render();
        maybeSync();
        const all = await db.allEntities();
        reminders.reschedule(all).catch(() => {});
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
  if ((state.screen === 'home' || state.screen === 'plan-detail') && !api.isLoggedIn()) {
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
  else if (state.screen === 'plan-detail') view = await renderPlanDetail();
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
