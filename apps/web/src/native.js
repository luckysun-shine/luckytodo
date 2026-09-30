/** Capacitor native bridge — safe on browser / PWA; uses injected Plugins when packaged. */

function cap() {
  return window.Capacitor || null;
}

export function isNative() {
  const c = cap();
  try {
    return !!(c && typeof c.isNativePlatform === 'function' && c.isNativePlatform());
  } catch {
    return false;
  }
}

function plugin(name) {
  const c = cap();
  if (!c) return null;
  if (c.Plugins && c.Plugins[name]) return c.Plugins[name];
  try {
    if (typeof c.getPlugin === 'function') return c.getPlugin(name);
  } catch {
    /* ignore */
  }
  return null;
}

export async function initNative() {
  if (!isNative()) return { native: false };
  const StatusBar = plugin('StatusBar');
  const SplashScreen = plugin('SplashScreen');
  const App = plugin('App');

  try {
    const theme = localStorage.getItem('lt_theme') || 'day';
    const dark = theme === 'night';
    if (StatusBar?.setStyle) await StatusBar.setStyle({ style: dark ? 'LIGHT' : 'DARK' });
    if (StatusBar?.setBackgroundColor) await StatusBar.setBackgroundColor({ color: dark ? '#121212' : '#ffffff' });
  } catch {
    /* ignore */
  }
  try {
    if (SplashScreen?.hide) await SplashScreen.hide({ fadeOutDuration: 280 });
  } catch {
    /* ignore */
  }

  try {
    if (App?.addListener) {
      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
          return;
        }
        // Android hardware back on root screen: leave the app.
        if (typeof App.exitApp === 'function') App.exitApp();
      });
    }
  } catch {
    /* ignore */
  }

  return { native: true, plugins: true };
}

export async function requestNotifyPermission() {
  const LocalNotifications = plugin('LocalNotifications');
  if (LocalNotifications?.requestPermissions) {
    try {
      const p = await LocalNotifications.requestPermissions();
      return p.display === 'granted' || p === 'granted';
    } catch {
      /* fall through */
    }
  }
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

export async function scheduleLocal({ id, title, body, at }) {
  const when = at instanceof Date ? at : new Date(at);
  if (!(when.getTime() > Date.now())) return false;
  const LocalNotifications = plugin('LocalNotifications');
  if (LocalNotifications?.schedule) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.abs(hashId(String(id))) % 2147483647,
            title,
            body: body || '',
            schedule: { at: when },
            extra: { tag: String(id) },
          },
        ],
      });
      return true;
    } catch (e) {
      console.warn(e);
    }
  }
  return false;
}

export async function lightTap() {
  const Haptics = plugin('Haptics');
  if (!Haptics?.impact) return;
  try {
    await Haptics.impact({ style: 'LIGHT' });
  } catch {
    /* ignore */
  }
}

function hashId(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (isNative()) return;
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
