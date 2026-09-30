/** LuckyTodo design tokens — cool slate + sky accent (aligned with house-checklist logo).
 * Register: h5 + product app shell. Crafted via finesse-ui redesign. */
export const css = `
:root {
  color-scheme: dark;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --radius-sm: 12px;
  --radius-md: 16px;
  --radius-lg: 20px;
  --radius-xl: 26px;
  --font-display: "Outfit", "Noto Sans SC", sans-serif;
  --font-body: "Noto Sans SC", "PingFang SC", sans-serif;
  --tap: 44px;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
  min-height: 100dvh;
  background: #0c1219;
  color: oklch(0.96 0.012 230);
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
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
  /* Cool slate ramp + sky accent (logo-aligned, not purple SaaS) */
  --page: oklch(0.145 0.018 240);
  --bg: oklch(0.165 0.02 240);
  --bg-elev: oklch(0.205 0.02 240);
  --surface: oklch(0.22 0.018 240);
  --panel-2: oklch(0.19 0.016 240);
  --text: oklch(0.96 0.01 230);
  --muted: oklch(0.70 0.02 240);
  --accent: oklch(0.68 0.14 250);
  --accent-strong: oklch(0.60 0.15 250);
  --accent-soft: color-mix(in oklch, var(--accent) 14%, transparent);
  --on-accent: oklch(0.99 0.005 230);
  --done: oklch(0.72 0.11 160);
  --warn: oklch(0.78 0.11 70);
  --miss: oklch(0.66 0.16 25);
  --line: color-mix(in oklch, oklch(0.85 0.02 240) 12%, transparent);
  --field: oklch(0.185 0.018 240);
  --glow: color-mix(in oklch, var(--accent) 32%, transparent);
  --shadow: 0 1px 2px color-mix(in oklch, oklch(0.2 0.02 240) 35%, transparent);
  --shadow-lg: 0 18px 40px -18px color-mix(in oklch, oklch(0.15 0.03 250) 55%, transparent);
  max-width: 430px;
  margin: 0 auto;
  min-height: 100dvh;
  height: 100dvh;
  position: relative;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(ellipse 100% 55% at 50% -18%, color-mix(in oklch, var(--accent) 16%, transparent), transparent 58%),
    var(--page);
  color: var(--text);
  overflow: hidden;
}
#app[data-theme="day"] {
  color-scheme: light;
  --page: oklch(0.965 0.008 240);
  --bg: oklch(0.975 0.006 240);
  --bg-elev: oklch(0.99 0.004 240);
  --surface: oklch(0.995 0.003 240);
  --panel-2: oklch(0.95 0.008 240);
  --text: oklch(0.26 0.025 250);
  --muted: oklch(0.48 0.02 245);
  --accent: oklch(0.52 0.14 250);
  --accent-strong: oklch(0.45 0.15 250);
  --accent-soft: color-mix(in oklch, var(--accent) 12%, transparent);
  --on-accent: oklch(0.99 0.005 230);
  --done: oklch(0.48 0.11 160);
  --warn: oklch(0.58 0.12 70);
  --miss: oklch(0.52 0.15 25);
  --line: color-mix(in oklch, var(--text) 11%, transparent);
  --field: oklch(0.955 0.008 240);
  --glow: color-mix(in oklch, var(--accent) 20%, transparent);
  --shadow: 0 1px 2px color-mix(in oklch, oklch(0.35 0.02 250) 12%, transparent);
  --shadow-lg: 0 16px 36px -20px color-mix(in oklch, oklch(0.4 0.04 250) 28%, transparent);
  background:
    radial-gradient(ellipse 90% 42% at 50% -12%, color-mix(in oklch, var(--accent) 10%, transparent), transparent 55%),
    var(--page);
}
#app[data-theme="paper"] {
  color-scheme: light;
  /* Warm stone — restrained, not cream+terracotta craft kit */
  --page: oklch(0.955 0.012 85);
  --bg: oklch(0.965 0.01 85);
  --bg-elev: oklch(0.98 0.008 85);
  --surface: oklch(0.985 0.006 85);
  --panel-2: oklch(0.94 0.012 85);
  --text: oklch(0.28 0.025 70);
  --muted: oklch(0.48 0.02 70);
  --accent: oklch(0.50 0.11 250);
  --accent-strong: oklch(0.44 0.12 250);
  --accent-soft: color-mix(in oklch, var(--accent) 12%, transparent);
  --on-accent: oklch(0.99 0.005 230);
  --done: oklch(0.46 0.1 155);
  --warn: oklch(0.55 0.1 70);
  --miss: oklch(0.5 0.13 30);
  --line: color-mix(in oklch, var(--text) 11%, transparent);
  --field: oklch(0.95 0.01 85);
  --glow: color-mix(in oklch, var(--accent) 16%, transparent);
  --shadow: 0 1px 2px color-mix(in oklch, oklch(0.35 0.02 70) 10%, transparent);
  --shadow-lg: 0 16px 36px -20px color-mix(in oklch, oklch(0.4 0.03 70) 22%, transparent);
  background: var(--page);
}
#app[data-font="large"] { font-size: 17.5px; }

.screen { flex: 1; min-height: 0; display: flex; flex-direction: column; animation: rise .32s var(--ease-out); }
@keyframes rise {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}

.top {
  display: flex; align-items: center; gap: var(--space-2);
  min-height: 56px;
  padding: calc(10px + env(safe-area-inset-top)) var(--space-4) var(--space-2);
}
.top h1 {
  flex: 1; margin: 0;
  font-family: var(--font-display);
  font-size: 1.625rem; font-weight: 700;
  letter-spacing: -0.03em; line-height: 1.15;
  text-wrap: balance;
}
.eyebrow {
  margin: 0 0 4px;
  font-size: 0.75rem; font-weight: 600;
  letter-spacing: 0.01em; color: var(--muted);
}
.greeting { display: grid; gap: 2px; flex: 1; min-width: 0; }
.greeting h1 { font-size: 1.5rem; }

.scroller {
  flex: 1; min-height: 0; overflow: auto;
  padding: var(--space-2) var(--space-4) calc(118px + env(safe-area-inset-bottom));
  overscroll-behavior: contain;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}

.banner {
  margin: 0 var(--space-4) var(--space-3);
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: var(--accent-soft);
  border: 1px solid color-mix(in oklch, var(--accent) 28%, transparent);
  color: var(--text); font-size: 0.8125rem;
  display: flex; align-items: center; gap: 8px;
}
.banner .x {
  margin-left: auto; border: 0; background: transparent;
  color: var(--muted); min-width: 32px; min-height: 32px; border-radius: 999px;
}

.section-label {
  margin: var(--space-5) 2px var(--space-3);
  font-size: 0.8125rem; font-weight: 650;
  letter-spacing: -0.01em; color: var(--muted);
}
.section-label:first-child { margin-top: var(--space-2); }

.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin: 0 0 var(--space-3);
  box-shadow: var(--shadow);
  transition: transform .16s var(--ease), border-color .16s var(--ease), background .16s var(--ease);
}
.card.pressable:active { transform: scale(0.985); }
.card h3 {
  margin: 0 0 2px;
  font-family: var(--font-display);
  font-size: 1.05rem; font-weight: 650; letter-spacing: -0.02em;
}
.card p, .muted { margin: 0; color: var(--muted); font-size: 0.8125rem; }
.row { display: flex; align-items: center; gap: var(--space-3); }
.grow { flex: 1; min-width: 0; }
.stack { display: grid; gap: var(--space-3); }

.todo-row {
  display: flex; align-items: center; gap: var(--space-3);
  padding: 12px 14px; margin: 0 0 8px;
  border-radius: var(--radius-md);
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  transition: background .15s var(--ease), border-color .15s var(--ease);
}
.todo-row:active { background: color-mix(in oklch, var(--accent) 8%, var(--surface)); }
.todo-row.done h3 { text-decoration: line-through; color: var(--muted); font-weight: 550; }

.check {
  width: 28px; height: 28px; flex: none;
  border-radius: 999px;
  border: 2px solid color-mix(in oklch, var(--muted) 55%, transparent);
  background: transparent;
  display: grid; place-items: center;
  color: var(--on-accent);
  transition: background .15s var(--ease), border-color .15s var(--ease), transform .15s var(--ease);
}
.check.on {
  background: var(--done);
  border-color: var(--done);
  transform: scale(1.04);
}
.check:focus-visible { outline-offset: 3px; }

.btn {
  appearance: none; border: 0;
  border-radius: var(--radius-md);
  min-height: var(--tap);
  padding: 0 18px;
  font-family: var(--font-display);
  font-weight: 650; letter-spacing: -0.01em;
  background: var(--accent); color: var(--on-accent);
  box-shadow: 0 8px 22px var(--glow);
  transition: transform .15s var(--ease), filter .15s var(--ease);
}
.btn:active { transform: scale(0.98); }
.btn:disabled { opacity: 0.45; box-shadow: none; }
.btn.secondary {
  background: var(--field); color: var(--text);
  border: 1px solid var(--line); box-shadow: none;
}
.btn.ghost {
  background: transparent; color: var(--accent-strong); box-shadow: none;
  min-height: 36px; padding: 0 10px;
}
.btn.danger {
  background: color-mix(in oklch, var(--miss) 88%, var(--bg));
  color: oklch(0.98 0.01 30); box-shadow: none;
}
.btn.block { width: 100%; }
.btn.lg { min-height: 52px; font-size: 1.05rem; border-radius: var(--radius-lg); }

.field { display: grid; gap: 6px; margin: 0 0 var(--space-3); }
.field label { font-size: 0.8125rem; font-weight: 550; color: var(--muted); }
.field input, .field textarea, .field select {
  width: 100%; min-height: var(--tap);
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: var(--field); color: var(--text);
  padding: 12px 14px;
  transition: border-color .15s var(--ease), box-shadow .15s var(--ease);
}
.field textarea { min-height: 96px; resize: vertical; }
.field input:focus, .field textarea:focus, .field select:focus {
  outline: none;
  border-color: color-mix(in oklch, var(--accent) 55%, var(--line));
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--accent) 22%, transparent);
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
  margin: 8px 0 0;
  font-family: var(--font-display);
  font-size: clamp(1.85rem, 7vw, 2.25rem);
  font-weight: 800; letter-spacing: -0.04em; line-height: 1.12;
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
  min-height: 48px;
  border-radius: 14px;
  padding: 12px 14px;
  background: color-mix(in oklch, var(--field) 88%, transparent);
  backdrop-filter: blur(8px);
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
  min-height: 52px;
  font-weight: 700;
  letter-spacing: 0.01em;
  box-shadow: 0 10px 28px var(--glow);
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
  left: 12px; right: 12px;
  bottom: calc(8px + env(safe-area-inset-bottom));
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 2px;
  padding: 6px;
  border-radius: 22px;
  background: color-mix(in oklch, var(--bg-elev) 92%, transparent);
  border: 1px solid var(--line);
  backdrop-filter: blur(20px) saturate(130%);
  box-shadow: var(--shadow-lg);
  z-index: 30;
}
.tabs button {
  border: 0; background: transparent; color: var(--muted);
  min-height: 52px; border-radius: 16px;
  display: grid; place-items: center; gap: 2px;
  font-size: 0.65rem; font-weight: 650;
  transition: background .16s var(--ease), color .16s var(--ease), transform .12s var(--ease);
}
.tabs button:active { transform: scale(0.96); }
.tabs button svg { width: 22px; height: 22px; }
.tabs button.active {
  color: var(--on-accent);
  background: var(--accent);
  box-shadow: 0 6px 16px var(--glow);
}

.fab {
  position: absolute;
  right: 20px;
  bottom: calc(78px + env(safe-area-inset-bottom));
  width: 56px; height: 56px; border: 0; border-radius: 18px;
  background: var(--accent); color: var(--on-accent);
  display: grid; place-items: center;
  box-shadow: 0 12px 28px var(--glow);
  transition: transform .16s var(--ease);
  z-index: 28;
}
.fab:active { transform: scale(0.94); }
.fab svg { width: 26px; height: 26px; }

.toast {
  position: absolute;
  top: calc(12px + env(safe-area-inset-top));
  left: 16px; right: 16px; z-index: 60;
  padding: 12px 14px; border-radius: var(--radius-md);
  background: var(--bg-elev); border: 1px solid var(--line);
  box-shadow: var(--shadow-lg);
  font-size: 0.875rem; font-weight: 550;
  display: none;
}
.toast.show { display: block; animation: rise .26s var(--ease-out); }

.modal {
  position: absolute; inset: 0; z-index: 40;
  background: color-mix(in oklch, oklch(0.12 0.02 240) 55%, transparent);
  display: grid; align-items: end; justify-items: center;
  padding: 12px;
  animation: fade .2s var(--ease);
}
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
.sheet {
  width: min(100%, 430px);
  max-height: min(88dvh, 720px);
  overflow: auto;
  background: var(--bg-elev);
  border: 1px solid var(--line);
  border-radius: var(--radius-xl) var(--radius-xl) 22px 22px;
  padding: 10px 16px calc(18px + env(safe-area-inset-bottom));
  box-shadow: var(--shadow-lg);
  animation: sheetIn .28s var(--ease-out);
}
@keyframes sheetIn {
  from { transform: translateY(18px); opacity: 0.7; }
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
  font-size: 1.25rem; font-weight: 700; letter-spacing: -0.02em;
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
  padding: var(--space-5) var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px dashed color-mix(in oklch, var(--muted) 35%, transparent);
  text-align: center;
  background: color-mix(in oklch, var(--surface) 50%, transparent);
}
.empty h3 {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: 1.05rem; font-weight: 650;
}
.empty p { margin: 0 0 14px; color: var(--muted); font-size: 0.875rem; }

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
  width: var(--tap); height: var(--tap); border: 0; border-radius: 14px;
  background: var(--field); color: var(--text); border: 1px solid var(--line);
  display: grid; place-items: center; flex: none;
}
.icon-btn svg { width: 20px; height: 20px; }

.hidden { display: none !important; }
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); border: 0;
}

/* Calendar page */
.cal-page { display: flex; flex-direction: column; gap: 0; min-height: 100%; }
.cal-panel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: 12px 12px 4px;
  margin-bottom: 0;
  overflow: hidden;
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
  border-radius: 14px;
  background: transparent;
  color: var(--text);
  font-family: var(--font-display);
  font-size: 0.9rem; font-weight: 600;
  display: grid; place-items: center;
  position: relative;
  min-height: 40px;
  transition: background .15s var(--ease), color .15s var(--ease), transform .15s var(--ease);
}
.cal-cell.muted { opacity: 0; pointer-events: none; }
.cal-cell.mark::after {
  content: "";
  position: absolute; bottom: 5px;
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--accent);
}
.cal-cell.today {
  box-shadow: inset 0 0 0 1.5px color-mix(in oklch, var(--accent) 55%, transparent);
}
.cal-cell.sel {
  background: var(--accent);
  color: var(--on-accent);
  transform: scale(1.04);
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
`;
