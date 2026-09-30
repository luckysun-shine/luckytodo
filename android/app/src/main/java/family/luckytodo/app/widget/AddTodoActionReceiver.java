package family.luckytodo.app.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.widget.Toast;

/** Quick-add a todo draft from the family calendar widget (mirrors iOS AddTodoIntent). */
public class AddTodoActionReceiver extends BroadcastReceiver {
    public static final String ACTION_ADD_TODO = "family.luckytodo.app.action.ADD_TODO_DRAFT";
    public static final String EXTRA_DAY = "day";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_ADD_TODO.equals(intent.getAction())) return;
        String day = intent.getStringExtra(EXTRA_DAY);
        try {
            WidgetStore.appendTodoDraft(context, day);
            WidgetUpdater.reloadAll(context);
            Toast.makeText(context.getApplicationContext(), "已添加「新待办」，打开 App 可继续编辑", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(context.getApplicationContext(), "添加失败", Toast.LENGTH_SHORT).show();
        }
    }
}
