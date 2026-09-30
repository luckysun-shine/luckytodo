package family.luckytodo.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;
import org.json.JSONObject;

public class FamilyCalendarWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        JSONObject snap = WidgetStore.loadSnapshot(context);
        for (int id : appWidgetIds) {
            int bucket = WidgetViews.sizeBucket(appWidgetManager, id);
            if (bucket < 1) bucket = 1;
            RemoteViews views = WidgetViews.buildCalendar(context, snap, bucket);
            appWidgetManager.updateAppWidget(id, views);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(
        Context context,
        AppWidgetManager appWidgetManager,
        int appWidgetId,
        Bundle newOptions
    ) {
        onUpdate(context, appWidgetManager, new int[] { appWidgetId });
    }
}
