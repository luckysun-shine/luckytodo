/** Schedule local Web Notifications for due todos / plan reminders (no APNs). */
export async function ensurePermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const r = await Notification.requestPermission();
  return r === 'granted';
}

/** Keep at most 60 future reminders. */
export async function reschedule(entities) {
  const ok = await ensurePermission();
  if (!ok) return 0;
  // Browser cannot cancel prior notifications easily without service worker tags;
  // we register near-term ones with unique tags.
  const now = Date.now();
  const upcoming = [];
  for (const e of entities) {
    if (e.deletedAt) continue;
    if (e.entityType === 'todo' && e.payload.remindAt) {
      upcoming.push({
        id: `todo-${e.id}`,
        title: e.payload.title,
        at: new Date(e.payload.remindAt).getTime(),
        body: '待办提醒',
      });
    }
    if (e.entityType === 'plan' && e.payload.reminder) {
      const [hh, mm] = String(e.payload.reminder).split(':').map(Number);
      const d = new Date();
      d.setHours(hh || 20, mm || 0, 0, 0);
      if (d.getTime() <= now) d.setDate(d.getDate() + 1);
      upcoming.push({
        id: `plan-${e.id}-${d.toISOString().slice(0, 10)}`,
        title: e.payload.title,
        at: d.getTime(),
        body: '计划提醒',
      });
    }
  }
  upcoming.sort((a, b) => a.at - b.at);
  const slice = upcoming.filter((x) => x.at > now).slice(0, 60);
  for (const item of slice) {
    const delay = item.at - now;
    if (delay > 2147483647) continue;
    setTimeout(() => {
      try {
        new Notification(item.title, { body: item.body, tag: item.id });
      } catch {
        /* ignore */
      }
    }, delay);
  }
  return slice.length;
}
