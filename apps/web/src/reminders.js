/** Schedule reminders: Capacitor LocalNotifications when native, else Web Notification. */
import * as native from './native.js';

export async function ensurePermission() {
  return native.requestNotifyPermission();
}

function milestoneRemindAt(ms) {
  if (!ms?.dueDate || !ms.remind || !ms.remindTime) return null;
  if (ms.status === 'done') return null;
  const [hh, mm] = String(ms.remindTime).split(':').map(Number);
  const d = new Date(`${ms.dueDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(hh || 9, mm || 0, 0, 0);
  return d.getTime();
}

/** Keep at most 60 future reminders. */
export async function reschedule(entities) {
  const ok = await ensurePermission();
  if (!ok) return 0;
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
    if (e.entityType === 'event' && e.payload.remindAt) {
      upcoming.push({
        id: `event-${e.id}`,
        title: e.payload.title,
        at: new Date(e.payload.remindAt).getTime(),
        body: '日程提醒',
      });
    }
    if (e.entityType === 'plan' && !e.payload.archived) {
      if (e.payload.reminder) {
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
      for (const ms of e.payload.milestones || []) {
        const at = milestoneRemindAt(ms);
        if (!at || at <= now) continue;
        upcoming.push({
          id: `ms-${e.id}-${ms.id}`,
          title: `${e.payload.title} · ${ms.title}`,
          at,
          body: '里程碑提醒',
        });
      }
    }
  }
  upcoming.sort((a, b) => a.at - b.at);
  const slice = upcoming.filter((x) => x.at > now).slice(0, 60);
  const useNative = native.isNative();
  for (const item of slice) {
    if (useNative) {
      await native.scheduleLocal({
        id: item.id,
        title: item.title,
        body: item.body,
        at: item.at,
      });
      continue;
    }
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
