/** LuckyTodo skin aligned to the Todoist dashboard redesign (cyan, soft cards, members). */
export const css = `
:root {
  color-scheme: light;
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --radius-sm: 12px;
  --radius-md: 18px;
  --radius-lg: 24px;
  --radius-xl: 28px;
  --font-display: "Plus Jakarta Sans", "Noto Sans SC", sans-serif;
  --font-body: "Plus Jakarta Sans", "Noto Sans SC", "PingFang SC", sans-serif;
  --tap: 48px;
  --tile-green: #3dbd7f;
  --tile-red: #f34e4e;
  --tile-teal: #00cabe;
  --prio-high: #f34e4e;
  --prio-mid: #00cabe;
  --prio-low: #3dbd7f;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; overflow: hidden; }
body {
  min-height: 100dvh;
  background: #f3f5f8;
  color: #1c1c1e;
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}
button, input, textarea, select { font: inherit; }
button { cursor: pointer; }
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

#app {
  --bg: #ffffff;
  --bg-elev: #ffffff;
  --surface: #ffffff;
  --task: #ffffff;
  --chip: #f3f4f6;
  --nav: #ffffff;
  --text: #1c1c1e;
  --text-soft: #1c1c1e;
  --muted: #8e8e93;
  --accent: #2dd8fe;
  --accent-strong: #00a8d6;
  --on-accent: #07323c;
  --done: #3dbd7f;
  --warn: #f5a524;
  --miss: #f34e4e;
  --line: #ececf1;
  --field: #f4f5f7;
  --glow: transparent;
  --shadow: 0 10px 28px rgba(28, 28, 30, 0.06);
  max-width: 430px;
  margin: 0 auto;
  height: 100dvh;
  max-height: 100dvh;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
}
#app[data-theme="night"] {
  color-scheme: dark;
  --bg: #121212;
  --bg-elev: #1c1c1e;
  --surface: #1c1c1e;
  --task: #232326;
  --chip: #2a2a2e;
  --nav: #1a1a1c;
  --text: #ffffff;
  --text-soft: rgba(255, 255, 255, 0.92);
  --muted: #a1a1aa;
  --accent: #2dd8fe;
  --accent-strong: #7ee7ff;
  --on-accent: #07323c;
  --done: #3dbd7f;
  --warn: #f5a524;
  --miss: #f34e4e;
  --line: #2e2e33;
  --field: #2a2a2e;
  --glow: transparent;
  --shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
  background: var(--bg);
}
#app[data-theme="paper"] {
  color-scheme: light;
  --bg: #fbf7f1;
  --bg-elev: #fffdf9;
  --surface: #fffdf9;
  --task: #fffdf9;
  --chip: #f3ece2;
  --nav: #fffdf9;
  --text: #1d1a16;
  --text-soft: #1d1a16;
  --muted: #8a8174;
  --accent: #2dd8fe;
  --accent-strong: #0098c4;
  --on-accent: #07323c;
  --done: #3dbd7f;
  --warn: #b07d1a;
  --miss: #f34e4e;
  --line: #eadfd0;
  --field: #f6f0e6;
  --glow: transparent;
  --shadow: 0 10px 28px rgba(80, 60, 30, 0.06);
  background: var(--bg);
}
#app[data-font="large"] { font-size: 17.5px; }

.screen { flex: 1; min-height: 0; display: flex; flex-direction: column; animation: rise .35s var(--ease); }
@keyframes rise {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}

.top {
  display: flex; align-items: center; gap: 8px;
  min-height: 56px;
  padding: calc(8px + env(safe-area-inset-top)) 12px 8px;
}
.top.appbar {
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  gap: 0;
}
.top h1 {
  flex: 1;
  margin: 0;
  text-align: center;
  font-family: var(--font-display);
  font-size: 1.15rem; font-weight: 800;
  letter-spacing: -0.03em; line-height: 1.2;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.eyebrow {
  margin: 0 0 4px;
  font-size: 0.75rem; font-weight: 400;
  letter-spacing: 0; color: var(--muted);
  text-transform: none;
}
.appbar-side { width: 44px; height: 44px; }
.avatar.sm {
  width: 42px; height: 42px; font-size: 1rem;
  justify-self: end;
}

.scroller {
  flex: 1; min-height: 0; overflow: auto;
  padding: var(--space-2) var(--space-5) calc(140px + env(safe-area-inset-bottom));
  overscroll-behavior: contain;
  scroll-behavior: smooth;
}
.dash .empty { padding: 8px 4px 4px; }
.dash .empty .empty-mark { width: 64px; height: 64px; margin: 0 auto 10px; }
.dash .empty .empty-mark svg { width: 30px; height: 30px; }
.dash .empty h3 { font-size: 1.05rem; margin-bottom: 6px; }

.banner {
  margin: 0 var(--space-4) var(--space-3);
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: color-mix(in oklch, var(--accent) 14%, var(--surface));
  border: 1px solid color-mix(in oklch, var(--accent) 25%, transparent);
  color: var(--text); font-size: 0.8125rem;
  display: flex; align-items: center; gap: 8px;
}
.banner .x {
  margin-left: auto; border: 0; background: transparent;
  color: var(--muted); min-width: 32px; min-height: 32px; border-radius: 999px;
}

.section-label {
  margin: var(--space-5) 2px var(--space-3);
  font-size: 0.875rem; font-weight: 400;
  letter-spacing: 0; text-transform: none; color: var(--muted);
}
.section-label:first-child { margin-top: var(--space-2); }

.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin: 0 0 var(--space-3);
  box-shadow: var(--shadow);
  transition: transform .18s var(--ease);
}
.card.pressable:active { transform: scale(0.985); }
.card h3 {
  margin: 0 0 2px;
  font-family: var(--font-body);
  font-size: 1rem; font-weight: 400; letter-spacing: 0;
  color: var(--text-soft);
}
.card p, .muted { margin: 0; color: var(--muted); font-size: 0.8125rem; }
.row { display: flex; align-items: center; gap: var(--space-3); }
.grow { flex: 1; min-width: 0; }
.stack { display: grid; gap: var(--space-3); }

.todo-row {
  display: flex; align-items: flex-start; gap: 4px;
  padding: 14px 14px 14px 6px; margin: 0 0 12px;
  border-radius: 22px;
  background: var(--task);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  transition: background .15s var(--ease);
}
.todo-row.done { align-items: center; }
.todo-row:active { filter: brightness(1.06); }
.todo-row h3 {
  margin: 0;
  font-size: 1.02rem; font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-soft);
}
.todo-row.done h3 { text-decoration: line-through; color: var(--muted); font-weight: 400; }
.task-meta {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  margin-top: 6px;
}
.task-time { color: var(--muted); font-size: 0.8rem; }
.task-chip {
  display: inline-flex; align-items: center; gap: 4px;
  min-height: 26px; padding: 0 10px;
  border-radius: 999px;
  background: var(--chip);
  color: var(--text);
  font-size: 0.75rem; font-weight: 650;
}
.task-flag {
  display: inline-flex; align-items: center;
  min-height: 26px; padding: 0 10px;
  border-radius: 999px;
  border: 0;
  color: #fff;
  background: var(--prio-mid);
  font-size: 0.72rem; font-weight: 800; letter-spacing: 0.02em;
}
.task-flag.high { background: var(--prio-high); }
.task-flag.low { background: var(--prio-low); }
.task-flag.medium { background: var(--prio-mid); }
.fold {
  display: flex; width: max-content; align-items: center; gap: 8px;
  margin: 4px 0 16px;
  min-height: 36px; padding: 0 16px 0 16px;
  border: 0; border-radius: 4px;
  background: var(--chip); color: var(--text);
  font-weight: 400; font-size: 0.95rem;
}
.fold svg { width: 18px; height: 18px; }

.check {
  width: 40px; height: 40px; flex: none;
  border: 0; border-radius: 999px;
  background: transparent;
  display: grid; place-items: center;
  color: transparent;
  position: relative;
  font-size: 12px; line-height: 1;
}
.check::before {
  content: "";
  position: absolute;
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid var(--line);
  box-sizing: border-box;
}
.check.on { color: transparent; }
.check.on::before {
  background: var(--accent);
  border-color: var(--accent);
}
.check.on::after {
  content: "";
  position: absolute;
  width: 4px;
  height: 8px;
  border-right: 2px solid #07323c;
  border-bottom: 2px solid #07323c;
  transform: rotate(45deg) translate(-1px, -2px);
  z-index: 1;
}
.check:focus-visible { outline-offset: 3px; }

.btn {
  appearance: none; border: 0;
  border-radius: 18px;
  min-height: var(--tap);
  padding: 12px 24px;
  font-family: var(--font-body);
  font-weight: 800; letter-spacing: -0.02em;
  background: var(--accent); color: var(--on-accent);
  box-shadow: none;
  transition: filter .15s var(--ease), opacity .15s var(--ease);
}
.btn:active { filter: brightness(0.92); }
.btn:disabled { opacity: 0.45; }
.btn.secondary {
  background: transparent; color: var(--text);
  border: 2px solid var(--accent); box-shadow: none;
}
.btn.ghost {
  background: transparent; color: var(--muted); box-shadow: none;
  min-height: 36px; padding: 0 10px;
}
.btn.danger {
  background: var(--miss);
  color: #fff; box-shadow: none;
  border: 0;
}
.btn.block { width: 100%; }
.btn.lg { min-height: 52px; font-size: 1rem; border-radius: 28px; }

.field { display: grid; gap: 6px; margin: 0 0 var(--space-3); }
.field label { font-size: 0.8125rem; font-weight: 550; color: var(--muted); }
.field input, .field textarea, .field select {
  width: 100%; min-height: var(--tap);
  border-radius: 16px;
  border: 1px solid var(--line);
  background: var(--field); color: var(--text);
  padding: 12px 14px;
  transition: border-color .15s var(--ease);
}
.field textarea { min-height: 96px; resize: vertical; }
.field input::placeholder, .field textarea::placeholder { color: var(--muted); }
.field input:focus, .field textarea:focus, .field select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: none;
}

.auth {
  flex: 1; display: flex; flex-direction: column;
  padding: calc(20px + env(safe-area-inset-top)) var(--space-5) calc(24px + env(safe-area-inset-bottom));
  position: relative;
  overflow: auto;
}
.auth-shell {
  flex: 1; display: flex; flex-direction: column; min-height: 0;
  position: relative; z-index: 1;
}
.auth-hero {
  display: grid; gap: var(--space-3);
  margin: 8px 0 28px;
  animation: auth-in .5s var(--ease) both;
}
.auth-hero .wordmark {
  display: flex; align-items: center; gap: 12px;
}
.auth-hero .mark {
  width: 44px; height: 44px; border-radius: 14px; flex-shrink: 0;
  display: grid; place-items: center;
  font-family: var(--font-display); font-weight: 800; font-size: 1.2rem;
  color: var(--on-accent);
  background: linear-gradient(145deg, var(--accent), color-mix(in oklch, var(--accent) 45%, oklch(0.5 0.07 230)));
  box-shadow: 0 10px 28px var(--glow);
}
.auth-hero .mark-img {
  width: 48px; height: 48px; flex-shrink: 0;
  border-radius: 14px;
  object-fit: cover;
  display: block;
  box-shadow: 0 10px 28px color-mix(in oklch, oklch(0.45 0.08 250) 35%, transparent);
  border: 1px solid color-mix(in oklch, white 12%, transparent);
}
.auth-hero .product {
  font-family: var(--font-display);
  font-weight: 800; font-size: 1.35rem;
  letter-spacing: -0.03em; line-height: 1;
  color: var(--text);
}
.auth-hero .tag {
  margin: 0; font-size: 0.75rem; font-weight: 600;
  color: var(--accent-strong);
  letter-spacing: 0.02em;
}
.auth-hero h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 2.05rem;
  font-weight: 800; letter-spacing: -0.04em; line-height: 1.15;
}
.auth-hero p.lead {
  margin: 0; color: var(--muted); font-size: 0.95rem; line-height: 1.5;
  max-width: 32ch;
}
.auth-panel {
  display: grid; gap: var(--space-4);
  animation: auth-in .55s var(--ease) .06s both;
}
.auth-panel .field { margin: 0; }
.auth-panel .field label {
  font-size: 0.8rem; font-weight: 600;
  letter-spacing: 0.01em;
}
.auth-panel .field input {
  min-height: 52px;
  border-radius: 16px;
  padding: 12px 14px;
  background: var(--field);
  border: 1px solid var(--line);
  backdrop-filter: none;
}
.field-password { position: relative; }
.field-password input { padding-right: 48px; }
.field-password .eye {
  position: absolute; right: 6px; bottom: 6px;
  width: 36px; height: 36px; border: 0; border-radius: 10px;
  background: transparent; color: var(--muted);
  display: grid; place-items: center;
  transition: color .15s var(--ease), background .15s var(--ease);
}
.field-password .eye:hover { color: var(--text); background: color-mix(in oklch, var(--text) 6%, transparent); }
.field-password .eye svg { width: 18px; height: 18px; }
.field .hint {
  margin: 0; font-size: 0.75rem; color: var(--muted); line-height: 1.35;
}
.field .err-inline {
  margin: 0; font-size: 0.78rem; color: var(--miss); font-weight: 550;
}
.auth-cta {
  display: grid; gap: var(--space-3);
  margin-top: var(--space-5);
  animation: auth-in .55s var(--ease) .12s both;
}
.auth-cta .btn.lg {
  min-height: 54px;
  font-weight: 800;
  letter-spacing: -0.02em;
  border-radius: 28px;
  box-shadow: none;
}
.auth-switch {
  text-align: center;
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}
.auth-switch button {
  border: 0; background: none; padding: 0;
  color: var(--accent-strong); font-weight: 700;
  text-decoration: underline; text-underline-offset: 3px;
  text-decoration-color: color-mix(in oklch, var(--accent) 45%, transparent);
}
.auth-foot {
  margin-top: auto;
  padding-top: var(--space-6);
  display: grid; gap: var(--space-3);
  justify-items: start;
  animation: auth-in .55s var(--ease) .18s both;
}
.auth-chip {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: color-mix(in oklch, var(--bg-elev) 70%, transparent);
  color: var(--muted);
  font-size: 0.78rem; font-weight: 550;
}
.auth-chip .dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--accent) 25%, transparent);
}
.auth-back {
  border: 0; background: transparent; color: var(--muted);
  font-size: 0.88rem; font-weight: 600;
  padding: 8px 0; margin: 0 0 8px;
  display: inline-flex; align-items: center; gap: 6px;
}
.auth-back:hover { color: var(--text); }
@keyframes auth-in {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
}

/* legacy brand used by connect/setup/merge until fully migrated */
.brand { margin: 12px 0 28px; }
.brand .mark {
  width: 48px; height: 48px; border-radius: 16px;
  display: grid; place-items: center;
  font-family: var(--font-display); font-weight: 800; font-size: 1.25rem;
  color: var(--on-accent);
  background: linear-gradient(145deg, var(--accent), color-mix(in oklch, var(--accent) 40%, oklch(0.55 0.08 240)));
  box-shadow: 0 12px 28px var(--glow);
  margin-bottom: 18px;
}
.brand h1 {
  margin: 0 0 8px;
  font-family: var(--font-display);
  font-size: clamp(2rem, 8vw, 2.4rem);
  font-weight: 800; letter-spacing: -0.04em; line-height: 1.05;
}
.brand p { margin: 0; color: var(--muted); font-size: 0.95rem; max-width: 28ch; }
.auth-actions { margin-top: auto; display: grid; gap: var(--space-3); padding-top: var(--space-5); }

.ms-list { display: grid; gap: 10px; margin: 0 0 12px; }
.ms-row {
  display: grid; gap: 8px;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: var(--field);
}
.ms-row-top { display: flex; align-items: flex-start; gap: 8px; }
.ms-row-top .grow { min-width: 0; }
.ms-row .field { margin: 0; }
.ms-row .field input { min-height: 40px; padding: 8px 12px; }
.ms-remove {
  border: 0; background: transparent; color: var(--muted);
  width: 36px; height: 36px; border-radius: 10px; flex: none;
  font-size: 1.1rem; line-height: 1;
}
.ms-remove:hover { color: var(--miss); background: color-mix(in oklch, var(--miss) 12%, transparent); }
.ms-add {
  width: 100%; min-height: 44px;
  border: 1px dashed var(--line);
  background: transparent; color: var(--accent-strong);
  border-radius: var(--radius-md);
  font-weight: 650;
}
.ms-add:hover { background: color-mix(in oklch, var(--accent) 8%, transparent); }

.ms-timeline { display: grid; gap: 0; margin: 8px 0 16px; position: relative; }
.ms-node {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  position: relative;
  padding-bottom: 18px;
}
.ms-node:last-child { padding-bottom: 0; }
.ms-rail {
  display: flex; flex-direction: column; align-items: center;
  position: relative;
}
.ms-dot {
  width: 16px; height: 16px; border-radius: 50%; flex: none;
  border: 2px solid var(--line);
  background: var(--bg-elev);
  z-index: 1;
  margin-top: 4px;
}
.ms-node.done .ms-dot {
  background: var(--done);
  border-color: var(--done);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--done) 25%, transparent);
}
.ms-node.due .ms-dot {
  border-color: var(--accent);
  background: color-mix(in oklch, var(--accent) 35%, var(--bg-elev));
}
.ms-node.overdue:not(.done) .ms-dot {
  border-color: var(--miss);
  background: color-mix(in oklch, var(--miss) 30%, var(--bg-elev));
}
.ms-rail::after {
  content: '';
  flex: 1; width: 2px; margin-top: 4px;
  background: var(--line);
  min-height: 12px;
}
.ms-node:last-child .ms-rail::after { display: none; }
.ms-body {
  min-width: 0;
  padding: 2px 0 4px;
}
.ms-body h3 {
  margin: 0 0 4px;
  font-family: var(--font-display);
  font-size: 1rem; font-weight: 700;
}
.ms-body.done h3 { text-decoration: line-through; color: var(--muted); }
.ms-meta { margin: 0; color: var(--muted); font-size: 0.78rem; }
.ms-note {
  margin: 8px 0 0;
  padding: 8px 10px;
  border-radius: 10px;
  background: color-mix(in oklch, var(--accent) 8%, var(--field));
  color: var(--text); font-size: 0.85rem; line-height: 1.4;
}
.ms-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.ms-actions .btn { min-height: 40px; padding: 0 14px; font-size: 0.88rem; }

.progress-pill {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  background: color-mix(in oklch, var(--accent) 12%, transparent);
  color: var(--accent-strong);
  font-size: 0.75rem; font-weight: 650;
}

.tabs {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr) 72px;
  gap: 0;
  padding: 6px 6px calc(6px + env(safe-area-inset-bottom));
  border-radius: 28px 28px 0 0;
  background: var(--nav);
  border: 0;
  border-top: 1px solid var(--line);
  box-shadow: 0 -12px 32px rgba(20, 24, 40, 0.06);
  backdrop-filter: none;
}
.tabs button {
  border: 0; background: transparent; color: var(--muted);
  min-height: 56px; border-radius: 16px;
  display: grid; place-items: center; gap: 2px;
  font-size: 0.68rem; font-weight: 700;
  transition: color .18s var(--ease);
}
.tabs button svg { width: 22px; height: 22px; }
.tabs button.active {
  color: var(--accent-strong);
  background: transparent;
  box-shadow: none;
}
.tabs-gap { pointer-events: none; }

.fab {
  position: absolute;
  left: auto;
  right: 14px;
  bottom: calc(16px + env(safe-area-inset-bottom));
  transform: none;
  width: 56px; height: 56px; border: 0; border-radius: 18px;
  background: var(--accent); color: #07323c;
  display: grid; place-items: center;
  box-shadow: 0 10px 22px color-mix(in srgb, var(--accent) 45%, transparent);
  z-index: 6;
  transition: filter .18s var(--ease), transform .18s var(--ease);
}
.fab:active { transform: scale(0.96); filter: brightness(0.96); }
.fab svg { width: 28px; height: 28px; stroke: #07323c; }

.toast {
  position: absolute;
  top: calc(12px + env(safe-area-inset-top));
  left: 16px; right: 16px; z-index: 60;
  padding: 12px 14px; border-radius: var(--radius-md);
  background: var(--bg-elev); border: 1px solid var(--line);
  box-shadow: 0 12px 32px color-mix(in oklch, black 30%, transparent);
  font-size: 0.875rem; font-weight: 550;
  display: none;
}
.toast.show { display: block; animation: rise .28s var(--ease); }

.modal {
  position: fixed;
  z-index: 80;
  top: 0; bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(100%, 430px);
  background: rgba(0, 0, 0, 0.54);
  display: grid; align-items: end; justify-items: stretch;
  padding: 0;
  animation: fade .2s var(--ease);
}
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
.sheet {
  width: 100%;
  max-height: min(88dvh, 720px);
  overflow: auto;
  background: var(--bg);
  border: 0;
  border-radius: 28px 28px 0 0;
  padding: 20px 24px calc(24px + env(safe-area-inset-bottom));
  backdrop-filter: none;
  animation: sheetIn .32s var(--ease);
}
@keyframes sheetIn {
  from { transform: translateY(24px); opacity: 0.6; }
  to { transform: none; opacity: 1; }
}
.sheet .handle {
  width: 40px; height: 5px; border-radius: 999px;
  background: color-mix(in oklch, var(--muted) 45%, transparent);
  margin: 4px auto 14px;
}
.sheet h2 {
  margin: 0 0 14px;
  font-family: var(--font-display);
  font-size: 1.25rem; font-weight: 700; letter-spacing: 0;
}

.seg {
  display: flex; gap: 6px; padding: 4px;
  border-radius: 14px; background: var(--field); border: 1px solid var(--line);
}
.seg button {
  flex: 1; border: 0; min-height: 36px; border-radius: 11px;
  background: transparent; color: var(--muted); font-weight: 650; font-size: 0.8125rem;
}
.seg button.on {
  background: var(--surface); color: var(--text);
  box-shadow: 0 1px 0 color-mix(in oklch, white 12%, transparent);
  border: 1px solid var(--line);
}

.chip-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.chip {
  display: inline-flex; align-items: center; gap: 6px;
  min-height: 34px; padding: 0 12px; border-radius: 999px;
  border: 1px solid var(--line); background: var(--field);
  color: var(--muted); font-size: 0.8125rem; font-weight: 600;
}
.chip.on {
  color: var(--on-accent); background: var(--accent); border-color: transparent;
}

.empty {
  padding: 48px var(--space-4) 24px;
  border-radius: 0;
  border: 0;
  text-align: center;
  background: transparent;
}
.empty .empty-mark {
  width: 120px; height: 120px; margin: 0 auto 24px;
  border-radius: 50%;
  display: grid; place-items: center;
  background: var(--surface);
  color: var(--accent);
}
.empty .empty-mark svg { width: 56px; height: 56px; }
.empty h3 {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: 1.25rem; font-weight: 700;
}
.empty p { margin: 0 0 14px; color: var(--muted); font-size: 1rem; }

.stat {
  font-family: var(--font-display);
  font-size: 3rem; font-weight: 800; letter-spacing: -0.04em; line-height: 1;
}
.bar {
  height: 8px; border-radius: 999px; background: var(--field); overflow: hidden; margin-top: 12px;
}
.bar > i {
  display: block; height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--done));
  border-radius: inherit;
}

.avatar {
  width: 64px; height: 64px; border-radius: 50%;
  background: linear-gradient(145deg, var(--accent), color-mix(in oklch, var(--accent) 30%, oklch(0.5 0.08 240)));
  color: var(--on-accent);
  display: grid; place-items: center;
  font-family: var(--font-display); font-weight: 800; font-size: 1.35rem;
  position: relative; overflow: hidden; border: 0; flex: none;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar .cam {
  position: absolute; right: 0; bottom: 0;
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--bg-elev); border: 1px solid var(--line);
  font-size: 11px; display: grid; place-items: center;
}

.attach { display: flex; gap: 8px; overflow: auto; padding-bottom: 4px; }
.attach .thumb {
  width: 64px; height: 64px; border-radius: 14px; border: 1px solid var(--line);
  background: var(--field); display: grid; place-items: center;
  font-size: 0.7rem; overflow: hidden; flex: none; color: var(--muted);
}
.attach .thumb img { width: 100%; height: 100%; object-fit: cover; }

.icon-btn {
  width: 42px; height: 42px; border: 0; border-radius: 14px;
  background: var(--chip); color: var(--text);
  display: grid; place-items: center; flex: none;
}
.icon-btn svg { width: 22px; height: 22px; }

.hidden { display: none !important; }
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); border: 0;
}

/* Calendar page */
.cal-page { display: flex; flex-direction: column; gap: 0; min-height: 100%; }
.cal-panel {
  background: var(--bg);
  border: 0;
  border-radius: 0 0 28px 28px;
  padding: 8px 12px 4px;
  margin: 0 -24px 8px;
  overflow: hidden;
  box-shadow: var(--shadow);
  transition: box-shadow .2s var(--ease);
}
.cal-panel.is-open { box-shadow: 0 10px 28px color-mix(in oklch, black 16%, transparent); }
.cal-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.cal-month h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em;
}
.cal-month p { margin: 2px 0 0; font-size: 0.75rem; }
.cal-body {
  overflow: hidden;
  max-height: 360px;
  opacity: 1;
  transform: translateY(0);
  transition: max-height .35s var(--ease), opacity .25s var(--ease), transform .35s var(--ease);
}
.cal-panel.is-closed .cal-body {
  max-height: 0;
  opacity: 0;
  transform: translateY(-8px);
  pointer-events: none;
}
.cal-weekdays, .cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  text-align: center;
}
.cal-weekdays { margin-bottom: 6px; }
.cal-weekdays span {
  font-size: 0.7rem; font-weight: 650; color: var(--muted); padding: 4px 0;
}
.cal-cell {
  appearance: none; border: 0;
  aspect-ratio: 1;
  border-radius: 50%;
  background: transparent;
  color: var(--text);
  font-family: var(--font-body);
  font-size: 0.9rem; font-weight: 400;
  display: grid; place-items: center;
  position: relative;
  min-height: 36px;
  transition: background .15s var(--ease), color .15s var(--ease);
}
.cal-cell.muted { opacity: 0; pointer-events: none; }
.cal-cell.mark::after {
  content: "";
  position: absolute; bottom: 5px;
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--accent);
}
.cal-cell.today {
  box-shadow: none;
  color: var(--accent-strong);
  font-weight: 700;
}
.cal-cell.sel {
  background: var(--accent);
  color: var(--on-accent);
  transform: none;
  font-weight: 700;
}
.cal-cell.sel.mark::after { background: var(--on-accent); }
.cal-cell:active { transform: scale(0.96); }

.cal-pull {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--muted);
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 10px 0 6px;
  touch-action: none;
  cursor: grab;
  user-select: none;
}
.cal-pull:active, .cal-pull.pulling { cursor: grabbing; }
.cal-pull-bar {
  width: 44px; height: 5px; border-radius: 999px;
  background: color-mix(in oklch, var(--muted) 45%, transparent);
  transition: width .15s var(--ease), background .15s var(--ease);
}
.cal-pull.pulling .cal-pull-bar,
.cal-pull:active .cal-pull-bar {
  width: 56px;
  background: var(--accent);
}
.cal-pull-hint { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.02em; }
.cal-day-list { padding-top: 4px; }

/* Create menu + typed forms */
.menu-list { display: grid; gap: 8px; margin-top: 4px; }
.menu-item {
  display: flex; align-items: center; gap: 12px;
  width: 100%; text-align: left;
  border: 1px solid var(--line);
  background: var(--field);
  border-radius: var(--radius-md);
  padding: 12px 14px; min-height: 64px;
  color: var(--text);
  transition: background .15s var(--ease), transform .15s var(--ease);
}
.menu-item:active { transform: scale(0.985); }
.menu-item .mi {
  width: 40px; height: 40px; border-radius: 14px; flex: none;
  display: grid; place-items: center;
  background: color-mix(in oklch, var(--accent) 18%, transparent);
  color: var(--accent);
}
.menu-item .mi svg { width: 22px; height: 22px; }
.menu-item strong { display: block; font-family: var(--font-display); font-size: 1rem; }
.menu-item span span { display: block; color: var(--muted); font-size: 0.78rem; margin-top: 2px; }
.menu-item .chev { margin-left: auto; color: var(--muted); }

.form-screen {
  position: absolute; inset: 0; z-index: 45;
  display: flex; flex-direction: column;
  background: var(--bg);
  animation: rise .28s var(--ease);
}
.form-screen .top { border-bottom: 1px solid var(--line); }
.form-screen .scroller { padding-bottom: calc(24px + env(safe-area-inset-bottom)); }
.form-screen h2.block-title {
  margin: 18px 2px 10px;
  font-size: 0.8rem; font-weight: 650;
  letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted);
}
.choice {
  display: flex; align-items: center; gap: 10px;
  min-height: 44px; margin: 0 0 12px; padding: 0 2px;
  color: var(--text); font-weight: 550;
}
.choice input { width: 18px; height: 18px; accent-color: var(--accent); }
.err { margin: -4px 0 10px; color: var(--miss); font-size: 0.78rem; }

.vis-grid { display: grid; gap: 8px; }
.vis-card {
  display: flex; align-items: flex-start; gap: 12px;
  width: 100%; text-align: left;
  border: 1px solid var(--line);
  background: var(--field);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  color: var(--text);
}
.vis-card[aria-pressed="true"] {
  border-color: color-mix(in oklch, var(--accent) 55%, var(--line));
  background: color-mix(in oklch, var(--accent) 12%, var(--field));
  box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 25%, transparent);
}
.vis-card strong { display: block; font-family: var(--font-display); margin-bottom: 2px; }
.vis-card span span { display: block; color: var(--muted); font-size: 0.78rem; line-height: 1.35; }
.vis-card .vis-check {
  margin-left: auto; width: 22px; height: 22px; border-radius: 999px;
  border: 1.5px solid var(--line); flex: none;
  display: grid; place-items: center; font-size: 12px; color: transparent;
}
.vis-card[aria-pressed="true"] .vis-check {
  background: var(--accent); border-color: var(--accent); color: var(--on-accent);
}

.check-list { display: grid; gap: 8px; margin-bottom: 12px; }
.check-row {
  display: flex; align-items: center; gap: 10px;
  min-height: 48px; padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: var(--field);
  color: var(--text); width: 100%; text-align: left;
}
.check-row[aria-pressed="true"] {
  border-color: color-mix(in oklch, var(--accent) 50%, var(--line));
  background: color-mix(in oklch, var(--accent) 10%, var(--field));
}
.check-row .box {
  width: 22px; height: 22px; border-radius: 7px; flex: none;
  border: 1.5px solid var(--line);
  display: grid; place-items: center; font-size: 12px; color: transparent;
}
.check-row[aria-pressed="true"] .box {
  background: var(--accent); border-color: var(--accent); color: var(--on-accent);
}

.days {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px;
  margin-bottom: 12px;
}
.days button {
  border: 1px solid var(--line);
  background: var(--field);
  color: var(--muted);
  border-radius: 12px;
  min-height: 40px;
  font-weight: 650; font-size: 0.8rem;
}
.days button[aria-pressed="true"] {
  background: var(--accent); color: var(--on-accent); border-color: transparent;
}

.task-search {
  display: flex; align-items: center; gap: 8px;
  margin: 4px 0 18px;
  min-height: 48px;
  padding: 0 14px;
  border-radius: 16px;
  border: 1px solid var(--line);
  background: var(--field);
  color: var(--muted);
}
.task-search svg { width: 20px; height: 20px; flex: none; }
.task-search input {
  flex: 1; min-width: 0;
  border: 0; background: transparent; color: var(--text);
  min-height: 44px; padding: 0;
  font: inherit;
}
.task-search input:focus { outline: none; }
.task-search input::placeholder { color: var(--muted); }

.profile-head { text-align: center; padding: 8px 0 4px; }
.profile-head .avatar { margin: 0 auto 10px; width: 86px; height: 86px; font-size: 1.75rem; box-shadow: var(--shadow); }
.profile-head h2 {
  margin: 0;
  font-size: 1.35rem; font-weight: 800;
  letter-spacing: -0.03em;
  font-family: var(--font-display);
}
.profile-head p { margin: 6px 0 0; color: var(--muted); font-size: 0.875rem; }
.profile-stats {
  display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
  margin: 20px 0 28px;
}
.profile-stat {
  background: var(--chip);
  border-radius: 18px;
  padding: 16px 8px;
  text-align: center;
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 700;
}
.settings-row {
  display: flex; align-items: center; gap: 12px;
  width: 100%;
  min-height: 52px;
  padding: 8px 0;
  border: 0;
  background: transparent;
  color: var(--text-soft);
  text-align: left;
  font-size: 1rem;
}
.settings-row svg { width: 24px; height: 24px; flex: none; }
.settings-row .chev { margin-left: auto; color: var(--muted); }
.settings-row.danger { color: var(--miss); }
#app[data-theme="night"] .tabs {
  box-shadow: 0 -12px 32px rgba(0, 0, 0, 0.35);
}

.dash-head {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px 12px;
  align-items: center;
  margin: 4px 0 8px;
}
.dash-head h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.45rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.15;
}
.dash-head p { margin: 4px 0 0; color: var(--muted); font-size: 0.85rem; }
.dash-head .avatar { grid-row: span 2; width: 48px; height: 48px; font-size: 1.05rem; box-shadow: var(--shadow); }

.dash-section {
  display: flex; align-items: baseline; gap: 8px;
  margin: 18px 2px 10px;
}
.dash-section h2 {
  margin: 0; flex: 1;
  font-family: var(--font-display);
  font-size: 1.05rem; font-weight: 800;
  letter-spacing: -0.03em;
}
.dash-section button {
  border: 0; background: transparent; color: var(--muted);
  font-weight: 700; font-size: 0.82rem; padding: 4px 0;
}

.plan-rail, .remind-rail {
  display: flex; gap: 12px;
  overflow-x: auto;
  padding: 4px 2px 10px;
  scroll-snap-type: x mandatory;
}
.plan-rail::-webkit-scrollbar, .remind-rail::-webkit-scrollbar { display: none; }
.plan-tile {
  flex: none;
  width: 168px;
  min-height: 148px;
  scroll-snap-align: start;
  border: 0;
  border-radius: 22px;
  padding: 14px;
  text-align: left;
  color: #fff;
  display: flex; flex-direction: column; gap: 8px;
  box-shadow: var(--shadow);
}
.plan-tile.tone-green { background: var(--tile-green); }
.plan-tile.tone-red { background: var(--tile-red); }
.plan-tile.tone-teal { background: var(--tile-teal); }
.plan-tile-top, .plan-foot {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  font-size: 0.72rem; font-weight: 700; opacity: 0.95;
}
.plan-tile strong {
  font-family: var(--font-display);
  font-size: 1.02rem; font-weight: 800;
  letter-spacing: -0.03em; line-height: 1.25;
}
.plan-bar {
  height: 5px; border-radius: 999px;
  background: rgba(255,255,255,.35); overflow: hidden;
}
.plan-bar > i { display: block; height: 100%; background: #fff; border-radius: inherit; }
.plan-check {
  align-self: flex-start;
  border: 0; border-radius: 999px;
  background: rgba(255,255,255,.22); color: #fff;
  font-weight: 800; font-size: 0.75rem;
  min-height: 28px; padding: 0 10px;
}

.remind-chip {
  flex: none;
  display: inline-flex; align-items: center; gap: 8px;
  max-width: 220px;
  min-height: 40px; padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--text);
  font-weight: 700; font-size: 0.82rem;
  box-shadow: var(--shadow);
}
.remind-chip i {
  width: 8px; height: 8px; border-radius: 50%; flex: none;
  background: var(--tile-red);
}
.remind-chip.teal i { background: var(--tile-teal); }
.remind-chip.green i { background: var(--tile-green); }
.remind-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.task-tabs {
  display: flex; gap: 18px;
  margin: 0 2px 12px;
}
.task-tabs button {
  border: 0; background: transparent;
  color: var(--muted);
  font-family: var(--font-display);
  font-weight: 800; font-size: 0.95rem;
  padding: 4px 0 8px;
  border-bottom: 2px solid transparent;
}
.task-tabs button.on {
  color: var(--text);
  border-bottom-color: var(--text);
}

.faces { display: flex; align-items: center; }
.face {
  width: 22px; height: 22px; margin-left: -6px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,.85);
  background: rgba(0,0,0,.18);
  color: #fff;
  display: grid; place-items: center;
  font-size: 0.62rem; font-weight: 800;
}
.faces .face:first-child { margin-left: 0; }
.todo-row .face, .member-rail .face {
  border-color: var(--surface);
  background: var(--accent);
  color: #07323c;
}
.member-rail { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; }
.member-pill {
  display: flex; align-items: center; gap: 8px;
  flex: none;
  padding: 6px 12px 6px 6px;
  border-radius: 999px;
  background: var(--chip);
  font-weight: 700; font-size: 0.82rem;
}
.member-pill .face { margin: 0; }

.prio-row { display: flex; gap: 8px; }
.prio {
  flex: 1; min-height: 40px;
  border: 0; border-radius: 999px;
  color: #fff; font-weight: 800; font-size: 0.78rem;
  letter-spacing: 0.04em;
  opacity: 0.45;
}
.prio.on { opacity: 1; }
.prio-high { background: var(--prio-high); }
.prio-medium { background: var(--prio-mid); }
.prio-low { background: var(--prio-low); }
`;
