package family.luckytodo.app.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

public final class WidgetUpdater {
    private WidgetUpdater() {}

    public static void reloadAll(Context context) {
        Context app = context.getApplicationContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(app);
        int[] todayIds = manager.getAppWidgetIds(new ComponentName(app, TodayRemindersWidgetProvider.class));
        if (todayIds.length > 0) {
            Intent intent = new Intent(app, TodayRemindersWidgetProvider.class);
            intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, todayIds);
            app.sendBroadcast(intent);
        }
        int[] calIds = manager.getAppWidgetIds(new ComponentName(app, FamilyCalendarWidgetProvider.class));
        if (calIds.length > 0) {
            Intent intent = new Intent(app, FamilyCalendarWidgetProvider.class);
            intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, calIds);
            app.sendBroadcast(intent);
        }
    }
}
