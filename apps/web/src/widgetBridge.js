/** Publish IndexedDB entities for home-screen widgets (iOS App Group / Android filesDir). */
import * as api from './api.js';
import * as db from './db.js';
import { isNative } from './native.js';

function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function localDayFromIso(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return dayKey(d);
}

function timeLabelFromIso(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function plugin() {
  return window.Capacitor?.Plugins?.WidgetBridge || null;
}

export async function publishWidgetSnapshot() {
  const me = api.getMember();
  const loggedIn = !!me;
  const today = dayKey();
  const all = (await db.allEntities()).filter((e) => !e.deletedAt);
  const reminders = [];
  const marked = new Set();
  const dayItems = {};

  const pushDay = (key, item) => {
    if (!key) return;
    marked.add(key);
    (dayItems[key] ||= []).push(item);
  };

  for (const e of all) {
    if (e.entityType === 'todo') {
      const due = e.payload.dueAt;
      const key = localDayFromIso(due);
      const done = (e.payload.completions || {})[me?.id] === 'done';
      if (key) {
        pushDay(key, {
          id: `todo-${e.id}`,
          entityId: e.id,
          entityType: 'todo',
          title: e.payload.title || '待办',
          timeLabel: timeLabelFromIso(due) || '待办',
        });
      }
      if (e.payload.remindAt) {
        const rk = localDayFromIso(e.payload.remindAt);
        if (rk === today && !done) {
          reminders.push({
            id: `rem-todo-${e.id}`,
            entityId: e.id,
            entityType: 'todo',
            title: e.payload.title || '待办',
            timeLabel: timeLabelFromIso(e.payload.remindAt) || '提醒',
            sortKey: timeLabelFromIso(e.payload.remindAt) || '99:99',
            done: false,
          });
        }
      }
    }
    if (e.entityType === 'event') {
      const key = localDayFromIso(e.payload.startAt);
      pushDay(key, {
        id: `event-${e.id}`,
        entityId: e.id,
        entityType: 'event',
        title: e.payload.title || '日程',
        timeLabel: e.payload.allDay ? '全天' : timeLabelFromIso(e.payload.startAt),
      });
      if (e.payload.remindAt) {
        const rk = localDayFromIso(e.payload.remindAt);
        if (rk === today) {
          reminders.push({
            id: `rem-event-${e.id}`,
            entityId: e.id,
            entityType: 'event',
            title: e.payload.title || '日程',
            timeLabel: timeLabelFromIso(e.payload.remindAt) || '提醒',
            sortKey: timeLabelFromIso(e.payload.remindAt) || '99:99',
            done: false,
          });
        }
      }
    }
    if (e.entityType === 'plan' && !e.payload.archived) {
      if (e.payload.reminder) {
        reminders.push({
          id: `rem-plan-${e.id}`,
          entityId: e.id,
          entityType: 'plan',
          title: e.payload.title || '计划',
          timeLabel: e.payload.reminder,
          sortKey: e.payload.reminder,
          done: false,
        });
      }
      for (const ms of e.payload.milestones || []) {
        if (!ms.dueDate || ms.status === 'done') continue;
        pushDay(ms.dueDate, {
          id: `ms-${e.id}-${ms.id}`,
          entityId: e.id,
          entityType: 'plan',
          title: `${e.payload.title} · ${ms.title}`,
          timeLabel: ms.remindTime || '里程碑',
        });
        if (ms.dueDate === today && ms.remind && ms.remindTime) {
          reminders.push({
            id: `rem-ms-${ms.id}`,
            entityId: e.id,
            entityType: 'plan',
            title: ms.title,
            timeLabel: ms.remindTime,
            sortKey: ms.remindTime,
            done: false,
          });
        }
      }
      marked.add(today);
    }
  }

  reminders.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const snapshot = {
    updatedAt: new Date().toISOString(),
    loggedIn,
    memberName: me?.displayName || null,
    reminders: reminders.slice(0, 20),
    markedDays: [...marked].sort(),
    dayItems,
  };

  // Always cache for PWA preview / debug
  try {
    localStorage.setItem('lt_widget_snapshot', JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }

  const bridge = plugin();
  if (bridge?.writeSnapshot) {
    await bridge.writeSnapshot({ snapshot });
  }
  return snapshot;
}

export async function consumeWidgetDrafts() {
  const bridge = plugin();
  if (!bridge?.consumeDrafts) return [];
  const res = await bridge.consumeDrafts();
  const drafts = res?.drafts || [];
  for (const d of drafts) {
    if (d.kind === 'event') {
      const start = `${d.day}T${d.startTime || '09:00'}:00`;
      const endDate = new Date(start);
      endDate.setHours(endDate.getHours() + 1);
      await api.saveLocalEntity('event', {
        title: d.title || '新日程',
        allDay: false,
        startAt: new Date(start).toISOString(),
        endAt: endDate.toISOString(),
        reminderKind: 'none',
        remindAt: null,
        participantIds: [api.getMember()?.id].filter(Boolean),
        attachmentIds: [],
        createdBy: api.getMember()?.id,
      });
    } else {
      const due = d.day ? new Date(`${d.day}T18:00:00`).toISOString() : null;
      await api.saveLocalEntity('todo', {
        title: d.title || '新待办',
        notes: '来自主屏组件',
        dueAt: due,
        reminderKind: due ? 'due' : 'none',
        remindAt: due,
        assigneeIds: [api.getMember()?.id].filter(Boolean),
        completions: {},
        attachmentIds: [],
        createdBy: api.getMember()?.id,
      });
    }
  }
  if (drafts.length) await publishWidgetSnapshot();
  return drafts;
}

export function handleDeepLink(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'luckytodo:') return null;
    const tab = u.searchParams.get('tab');
    const type = u.searchParams.get('type');
    const id = u.searchParams.get('id');
    const day = u.searchParams.get('day');
    return { path: u.hostname || u.pathname.replace(/^\//, ''), tab, type, id, day };
  } catch {
    return null;
  }
}

export { isNative };
