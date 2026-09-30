package family.luckytodo.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import family.luckytodo.app.MainActivity;
import family.luckytodo.app.R;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

final class WidgetViews {
    private WidgetViews() {}

    static int sizeBucket(AppWidgetManager manager, int appWidgetId) {
        Bundle options = manager.getAppWidgetOptions(appWidgetId);
        int w = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110);
        int h = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110);
        if (w >= 250 && h >= 220) return 2;
        if (w >= 180) return 1;
        return 0;
    }

    static RemoteViews buildToday(Context context, JSONObject snap, int bucket) {
        if (bucket <= 0) return buildTodaySmall(context, snap);
        return buildTodayList(context, snap, bucket >= 2 ? 8 : 5, bucket >= 2);
    }

    private static RemoteViews buildTodaySmall(Context context, JSONObject snap) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today_small);
        views.setOnClickPendingIntent(R.id.widget_root, openUri(context, "luckytodo://home?tab=today", 1001));
        if (!snap.optBoolean("loggedIn", false)) {
            views.setTextViewText(R.id.widget_title, "今日提醒");
            views.setTextViewText(R.id.row_title_0, "登录后同步今日提醒");
            views.setTextViewText(R.id.row_meta_0, "打开 LuckyTodo 完成登录");
            return views;
        }
        List<JSONObject> open = openReminders(snap);
        views.setTextViewText(R.id.widget_title, "今日提醒");
        if (open.isEmpty()) {
            views.setTextViewText(R.id.row_title_0, "今天没有提醒");
            views.setTextViewText(R.id.row_meta_0, "点此打开应用添加");
            return views;
        }
        JSONObject first = open.get(0);
        views.setTextViewText(
            R.id.row_title_0,
            first.optString("timeLabel", "") + " " + first.optString("title", "")
        );
        views.setTextViewText(
            R.id.row_meta_0,
            open.size() > 1 ? "今日还有 " + (open.size() - 1) + " 条提醒" : "今天就这一条"
        );
        return views;
    }

    private static RemoteViews buildTodayList(Context context, JSONObject snap, int limit, boolean large) {
        RemoteViews views = new RemoteViews(
            context.getPackageName(),
            large ? R.layout.widget_today_large : R.layout.widget_today_medium
        );
        views.setOnClickPendingIntent(R.id.widget_root, openUri(context, "luckytodo://home?tab=today", 1002));
        views.setTextViewText(R.id.widget_title, "今日提醒");

        if (!snap.optBoolean("loggedIn", false)) {
            views.setViewVisibility(R.id.widget_empty, View.VISIBLE);
            views.setTextViewText(R.id.widget_empty, "登录后同步今日提醒");
            views.setTextViewText(R.id.widget_count, "0");
            for (int i = 0; i < limit; i++) setTodayRow(views, i, false, null, null);
            return views;
        }

        List<JSONObject> open = openReminders(snap);
        views.setTextViewText(R.id.widget_count, String.valueOf(open.size()));
        if (open.isEmpty()) {
            views.setViewVisibility(R.id.widget_empty, View.VISIBLE);
            views.setTextViewText(R.id.widget_empty, "今天没有提醒");
            for (int i = 0; i < limit; i++) setTodayRow(views, i, false, null, null);
            return views;
        }
        views.setViewVisibility(R.id.widget_empty, View.GONE);
        for (int i = 0; i < limit; i++) {
            if (i < open.size()) {
                JSONObject item = open.get(i);
                setTodayRow(views, i, true, item.optString("title", "提醒"), item.optString("timeLabel", ""));
                String type = item.optString("entityType", "todo");
                String id = item.optString("entityId", "");
                views.setOnClickPendingIntent(
                    todayRowId(i),
                    openUri(context, "luckytodo://item?type=" + type + "&id=" + Uri.encode(id), 2000 + i)
                );
            } else {
                setTodayRow(views, i, false, null, null);
            }
        }
        return views;
    }

    static RemoteViews buildCalendar(Context context, JSONObject snap, int bucket) {
        boolean large = bucket >= 2;
        RemoteViews views = new RemoteViews(
            context.getPackageName(),
            large ? R.layout.widget_calendar_large : R.layout.widget_calendar_medium
        );
        views.setOnClickPendingIntent(R.id.widget_root, openUri(context, "luckytodo://home?tab=cal", 1003));

        Calendar now = Calendar.getInstance();
        String today = WidgetStore.todayKey();
        views.setTextViewText(R.id.widget_month, String.format(Locale.CHINA, "%d月", now.get(Calendar.MONTH) + 1));
        views.setTextViewText(R.id.widget_subtitle, "今天");
        views.setOnClickPendingIntent(R.id.widget_add, addTodoPending(context, today));

        if (!snap.optBoolean("loggedIn", false)) {
            views.setViewVisibility(R.id.widget_empty, View.VISIBLE);
            views.setTextViewText(R.id.widget_empty, "登录后查看家庭日历");
            for (int i = 0; i < 4; i++) setCalRow(views, i, false, null, null);
            bindWeekStrip(views, new HashSet<>(), today, now);
            if (large) bindMonthGrid(views, new HashSet<>(), today, now);
            return views;
        }

        Set<String> marked = markedSet(snap);
        bindWeekStrip(views, marked, today, now);
        if (large) bindMonthGrid(views, marked, today, now);

        JSONArray items = null;
        JSONObject dayItems = snap.optJSONObject("dayItems");
        if (dayItems != null) items = dayItems.optJSONArray(today);
        int limit = large ? 4 : 3;
        if (items == null || items.length() == 0) {
            views.setViewVisibility(R.id.widget_empty, View.VISIBLE);
            views.setTextViewText(R.id.widget_empty, large ? "点右上角添加待办" : "今天还没有安排");
            for (int i = 0; i < 4; i++) setCalRow(views, i, false, null, null);
        } else {
            views.setViewVisibility(R.id.widget_empty, View.GONE);
            for (int i = 0; i < 4; i++) {
                if (i < items.length() && i < limit) {
                    JSONObject item = items.optJSONObject(i);
                    if (item == null) {
                        setCalRow(views, i, false, null, null);
                        continue;
                    }
                    String time = item.optString("timeLabel", "");
                    if (time.isEmpty()) time = "全天";
                    setCalRow(views, i, true, item.optString("title", "事项"), time);
                    String type = item.optString("entityType", "todo");
                    String id = item.optString("entityId", "");
                    views.setOnClickPendingIntent(
                        calRowId(i),
                        openUri(context, "luckytodo://item?type=" + type + "&id=" + Uri.encode(id), 3000 + i)
                    );
                } else {
                    setCalRow(views, i, false, null, null);
                }
            }
        }
        return views;
    }

    private static void bindWeekStrip(RemoteViews views, Set<String> marked, String today, Calendar now) {
        Calendar c = (Calendar) now.clone();
        int dow = c.get(Calendar.DAY_OF_WEEK);
        int shift = (dow + 5) % 7;
        c.add(Calendar.DAY_OF_MONTH, -shift);
        int[] dayIds = {
            R.id.week_d0, R.id.week_d1, R.id.week_d2, R.id.week_d3, R.id.week_d4, R.id.week_d5, R.id.week_d6
        };
        int[] markIds = {
            R.id.week_m0, R.id.week_m1, R.id.week_m2, R.id.week_m3, R.id.week_m4, R.id.week_m5, R.id.week_m6
        };
        for (int i = 0; i < 7; i++) {
            String key = dayKey(c);
            views.setTextViewText(dayIds[i], String.valueOf(c.get(Calendar.DAY_OF_MONTH)));
            boolean isToday = today.equals(key);
            views.setInt(dayIds[i], "setBackgroundResource", isToday ? R.drawable.widget_day_selected : R.drawable.widget_day_idle);
            views.setViewVisibility(markIds[i], marked.contains(key) && !isToday ? View.VISIBLE : View.INVISIBLE);
            c.add(Calendar.DAY_OF_MONTH, 1);
        }
    }

    private static void bindMonthGrid(RemoteViews views, Set<String> marked, String today, Calendar now) {
        Calendar c = (Calendar) now.clone();
        c.set(Calendar.DAY_OF_MONTH, 1);
        int shift = (c.get(Calendar.DAY_OF_WEEK) + 5) % 7;
        c.add(Calendar.DAY_OF_MONTH, -shift);
        int[] cellIds = monthCellIds();
        for (int i = 0; i < cellIds.length; i++) {
            String key = dayKey(c);
            boolean inMonth = c.get(Calendar.MONTH) == now.get(Calendar.MONTH);
            views.setTextViewText(cellIds[i], inMonth ? String.valueOf(c.get(Calendar.DAY_OF_MONTH)) : " ");
            if (!inMonth) {
                views.setInt(cellIds[i], "setBackgroundResource", R.drawable.widget_day_idle);
            } else if (today.equals(key)) {
                views.setInt(cellIds[i], "setBackgroundResource", R.drawable.widget_day_selected);
            } else if (marked.contains(key)) {
                views.setInt(cellIds[i], "setBackgroundResource", R.drawable.widget_day_marked);
            } else {
                views.setInt(cellIds[i], "setBackgroundResource", R.drawable.widget_day_idle);
            }
            c.add(Calendar.DAY_OF_MONTH, 1);
        }
    }

    private static String dayKey(Calendar c) {
        return String.format(
            Locale.US,
            "%04d-%02d-%02d",
            c.get(Calendar.YEAR),
            c.get(Calendar.MONTH) + 1,
            c.get(Calendar.DAY_OF_MONTH)
        );
    }

    private static List<JSONObject> openReminders(JSONObject snap) {
        List<JSONObject> out = new ArrayList<>();
        JSONArray arr = snap.optJSONArray("reminders");
        if (arr == null) return out;
        for (int i = 0; i < arr.length(); i++) {
            JSONObject r = arr.optJSONObject(i);
            if (r == null || r.optBoolean("done", false)) continue;
            out.add(r);
        }
        out.sort((a, b) -> a.optString("sortKey", "99:99").compareTo(b.optString("sortKey", "99:99")));
        return out;
    }

    private static Set<String> markedSet(JSONObject snap) {
        Set<String> set = new HashSet<>();
        JSONArray arr = snap.optJSONArray("markedDays");
        if (arr == null) return set;
        for (int i = 0; i < arr.length(); i++) set.add(arr.optString(i));
        return set;
    }

    private static PendingIntent openUri(Context context, String uri, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uri));
        intent.setClass(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(context, requestCode, intent, flags);
    }

    private static PendingIntent addTodoPending(Context context, String day) {
        Intent intent = new Intent(context, AddTodoActionReceiver.class);
        intent.setAction(AddTodoActionReceiver.ACTION_ADD_TODO);
        intent.putExtra(AddTodoActionReceiver.EXTRA_DAY, day);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(context, ("add-" + day).hashCode(), intent, flags);
    }

    private static void setTodayRow(RemoteViews views, int i, boolean visible, String title, String time) {
        int row = todayRowId(i);
        if (row == 0) return;
        views.setViewVisibility(row, visible ? View.VISIBLE : View.GONE);
        if (!visible) return;
        views.setTextViewText(todayTitleId(i), title == null ? "" : title);
        views.setTextViewText(todayTimeId(i), time == null ? "" : time);
    }

    private static void setCalRow(RemoteViews views, int i, boolean visible, String title, String time) {
        int row = calRowId(i);
        views.setViewVisibility(row, visible ? View.VISIBLE : View.GONE);
        if (!visible) return;
        views.setTextViewText(calTitleId(i), title == null ? "" : title);
        views.setTextViewText(calTimeId(i), time == null ? "" : time);
    }

    private static int todayRowId(int i) {
        switch (i) {
            case 0: return R.id.row_0;
            case 1: return R.id.row_1;
            case 2: return R.id.row_2;
            case 3: return R.id.row_3;
            case 4: return R.id.row_4;
            case 5: return R.id.row_5;
            case 6: return R.id.row_6;
            case 7: return R.id.row_7;
            default: return 0;
        }
    }

    private static int todayTitleId(int i) {
        switch (i) {
            case 0: return R.id.row_title_0;
            case 1: return R.id.row_title_1;
            case 2: return R.id.row_title_2;
            case 3: return R.id.row_title_3;
            case 4: return R.id.row_title_4;
            case 5: return R.id.row_title_5;
            case 6: return R.id.row_title_6;
            default: return R.id.row_title_7;
        }
    }

    private static int todayTimeId(int i) {
        switch (i) {
            case 0: return R.id.row_time_0;
            case 1: return R.id.row_time_1;
            case 2: return R.id.row_time_2;
            case 3: return R.id.row_time_3;
            case 4: return R.id.row_time_4;
            case 5: return R.id.row_time_5;
            case 6: return R.id.row_time_6;
            default: return R.id.row_time_7;
        }
    }

    private static int calRowId(int i) {
        switch (i) {
            case 0: return R.id.cal_row_0;
            case 1: return R.id.cal_row_1;
            case 2: return R.id.cal_row_2;
            default: return R.id.cal_row_3;
        }
    }

    private static int calTitleId(int i) {
        switch (i) {
            case 0: return R.id.cal_title_0;
            case 1: return R.id.cal_title_1;
            case 2: return R.id.cal_title_2;
            default: return R.id.cal_title_3;
        }
    }

    private static int calTimeId(int i) {
        switch (i) {
            case 0: return R.id.cal_time_0;
            case 1: return R.id.cal_time_1;
            case 2: return R.id.cal_time_2;
            default: return R.id.cal_time_3;
        }
    }

    private static int[] monthCellIds() {
        return new int[] {
            R.id.m0, R.id.m1, R.id.m2, R.id.m3, R.id.m4, R.id.m5, R.id.m6,
            R.id.m7, R.id.m8, R.id.m9, R.id.m10, R.id.m11, R.id.m12, R.id.m13,
            R.id.m14, R.id.m15, R.id.m16, R.id.m17, R.id.m18, R.id.m19, R.id.m20,
            R.id.m21, R.id.m22, R.id.m23, R.id.m24, R.id.m25, R.id.m26, R.id.m27,
            R.id.m28, R.id.m29, R.id.m30, R.id.m31, R.id.m32, R.id.m33, R.id.m34,
            R.id.m35, R.id.m36, R.id.m37, R.id.m38, R.id.m39, R.id.m40, R.id.m41
        };
    }
}
