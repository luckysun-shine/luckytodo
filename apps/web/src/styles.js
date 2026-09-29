export const css = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
  min-height: 100dvh;
  background: #0f0b18;
  color: #f6f3fb;
  font-family: "SF Pro Rounded", "PingFang SC", "Noto Sans SC", system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.45;
  -webkit-tap-highlight-color: transparent;
}
#app {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100dvh;
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
}
#app[data-theme="night"] {
  --bg: oklch(0.17 0.035 290);
  --bg-elev: oklch(0.23 0.04 292);
  --card: color-mix(in oklch, oklch(0.28 0.045 295) 88%, transparent);
  --text: oklch(0.98 0.01 300);
  --secondary: oklch(0.74 0.03 295);
  --accent: oklch(0.62 0.22 292);
  --accent-2: oklch(0.68 0.2 330);
  --on-accent: oklch(0.99 0.01 300);
  --done: oklch(0.8 0.16 163);
  --miss: oklch(0.72 0.18 18);
  --line: color-mix(in oklch, white 10%, transparent);
  --field: oklch(0.25 0.04 295);
}
#app[data-theme="day"] {
  --bg: oklch(0.97 0.01 280);
  --bg-elev: oklch(0.995 0.005 280);
  --card: oklch(1 0.004 280);
  --text: oklch(0.22 0.03 290);
  --secondary: oklch(0.48 0.03 280);
  --accent: oklch(0.52 0.2 292);
  --accent-2: oklch(0.58 0.18 330);
  --on-accent: #fff;
  --done: oklch(0.5 0.13 162);
  --miss: oklch(0.52 0.18 27);
  --line: color-mix(in oklch, var(--text) 12%, transparent);
  --field: oklch(0.99 0.005 280);
  color-scheme: light;
}
#app[data-theme="paper"] {
  --bg: oklch(0.955 0.02 88);
  --bg-elev: oklch(0.985 0.012 88);
  --card: oklch(0.99 0.01 88);
  --text: oklch(0.27 0.03 75);
  --secondary: oklch(0.45 0.04 70);
  --accent: oklch(0.55 0.13 48);
  --accent-2: oklch(0.62 0.12 30);
  --on-accent: oklch(0.985 0.01 88);
  --done: oklch(0.46 0.1 152);
  --miss: oklch(0.48 0.15 30);
  --line: color-mix(in oklch, var(--text) 14%, transparent);
  --field: oklch(0.99 0.01 88);
  color-scheme: light;
}
#app[data-font="large"] { font-size: 17.5px; }
.screen { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.top {
  display: flex; align-items: center; gap: 8px;
  min-height: 56px;
  padding: calc(12px + env(safe-area-inset-top)) 16px 8px;
}
.top h1 { flex: 1; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
.scroller { flex: 1; min-height: 0; overflow: auto; padding: 4px 16px 120px; }
.banner {
  margin: 0 16px 8px; padding: 10px 12px; border-radius: 12px;
  background: color-mix(in oklch, var(--accent) 18%, transparent);
  color: var(--text); font-size: 13px;
}
.card {
  background: var(--card); border: 1px solid var(--line);
  border-radius: 18px; padding: 14px 14px; margin: 0 0 10px;
  backdrop-filter: blur(12px);
}
.card h3 { margin: 0 0 4px; font-size: 16px; }
.card p, .muted { margin: 0; color: var(--secondary); font-size: 13px; }
.row { display: flex; align-items: center; gap: 10px; }
.grow { flex: 1; min-width: 0; }
.btn {
  appearance: none; border: 0; border-radius: 14px;
  padding: 12px 16px; font: inherit; font-weight: 600;
  background: var(--accent); color: var(--on-accent); cursor: pointer;
}
.btn.secondary { background: var(--field); color: var(--text); border: 1px solid var(--line); }
.btn.ghost { background: transparent; color: var(--accent); padding: 8px 10px; }
.btn.danger { background: color-mix(in oklch, var(--miss) 80%, black); color: white; }
.btn:disabled { opacity: 0.5; }
.field { display: grid; gap: 6px; margin: 0 0 12px; }
.field label { font-size: 13px; color: var(--secondary); }
.field input, .field textarea, .field select {
  width: 100%; border-radius: 12px; border: 1px solid var(--line);
  background: var(--field); color: var(--text);
  padding: 12px; font: inherit;
}
.tabs {
  position: absolute; left: 12px; right: 12px; bottom: calc(10px + env(safe-area-inset-bottom));
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px;
  padding: 8px; border-radius: 22px;
  background: color-mix(in oklch, var(--bg-elev) 88%, transparent);
  border: 1px solid var(--line); backdrop-filter: blur(18px);
}
.tabs button {
  border: 0; background: transparent; color: var(--secondary);
  padding: 8px 4px; border-radius: 14px; font: inherit; font-size: 11px; font-weight: 600;
}
.tabs button.active { color: var(--on-accent); background: var(--accent); }
.fab {
  position: absolute; right: 20px; bottom: calc(88px + env(safe-area-inset-bottom));
  width: 56px; height: 56px; border-radius: 18px; border: 0;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: white; font-size: 28px; font-weight: 700; box-shadow: 0 12px 30px color-mix(in oklch, var(--accent) 40%, transparent);
}
.toast {
  position: absolute; top: calc(12px + env(safe-area-inset-top)); left: 16px; right: 16px;
  z-index: 50; padding: 12px 14px; border-radius: 14px;
  background: var(--bg-elev); border: 1px solid var(--line);
  box-shadow: 0 10px 30px rgba(0,0,0,.25); display: none;
}
.toast.show { display: block; animation: in .25s ease; }
@keyframes in { from { transform: translateY(-8px); opacity: 0; } }
.modal {
  position: absolute; inset: 0; z-index: 40;
  background: color-mix(in oklch, black 45%, transparent);
  display: grid; place-items: end center; padding: 16px;
}
.modal .sheet {
  width: min(100%, 440px); background: var(--bg-elev);
  border: 1px solid var(--line); border-radius: 22px; padding: 18px;
}
.chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-radius: 999px; border: 1px solid var(--line);
  background: var(--field); font-size: 12px; color: var(--secondary);
}
.chip.on { border-color: var(--accent); color: var(--accent); }
.check {
  width: 28px; height: 28px; border-radius: 10px; border: 2px solid var(--line);
  display: grid; place-items: center; flex: none;
}
.check.on { background: var(--done); border-color: var(--done); color: #042; }
.avatar {
  width: 56px; height: 56px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  display: grid; place-items: center; font-weight: 700; position: relative; overflow: hidden;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar .cam {
  position: absolute; right: -2px; bottom: -2px; width: 22px; height: 22px;
  border-radius: 50%; background: var(--bg-elev); border: 1px solid var(--line);
  font-size: 11px; display: grid; place-items: center;
}
.seg { display: flex; gap: 8px; flex-wrap: wrap; }
.seg button { flex: 1; min-width: 88px; }
.h2 { margin: 18px 4px 10px; font-size: 13px; letter-spacing: .04em; text-transform: uppercase; color: var(--secondary); }
.stat { font-size: 40px; font-weight: 800; letter-spacing: -0.03em; }
.bar { height: 10px; border-radius: 999px; background: var(--field); overflow: hidden; }
.bar > i { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), var(--done)); }
.attach { display: flex; gap: 8px; overflow: auto; padding-bottom: 4px; }
.attach .thumb {
  width: 64px; height: 64px; border-radius: 12px; border: 1px solid var(--line);
  background: var(--field); display: grid; place-items: center; font-size: 11px; overflow: hidden; flex: none;
}
.attach .thumb img { width: 100%; height: 100%; object-fit: cover; }
.hidden { display: none !important; }
`;
