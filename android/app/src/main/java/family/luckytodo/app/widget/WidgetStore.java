package family.luckytodo.app.widget;

import android.content.Context;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

/** Shared JSON snapshot / drafts used by App Widgets and WidgetBridge. */
public final class WidgetStore {
    public static final String SNAPSHOT_FILE = "widget-snapshot.json";
    public static final String DRAFTS_FILE = "widget-drafts.json";

    private WidgetStore() {}

    private static File dir(Context context) {
        File d = new File(context.getApplicationContext().getFilesDir(), "widgets");
        if (!d.exists()) {
            //noinspection ResultOfMethodCallIgnored
            d.mkdirs();
        }
        return d;
    }

    private static File file(Context context, String name) {
        return new File(dir(context), name);
    }

    public static JSONObject emptySnapshot() {
        try {
            JSONObject o = new JSONObject();
            o.put("updatedAt", "");
            o.put("loggedIn", false);
            o.put("memberName", JSONObject.NULL);
            o.put("reminders", new JSONArray());
            o.put("markedDays", new JSONArray());
            o.put("dayItems", new JSONObject());
            return o;
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    public static JSONObject loadSnapshot(Context context) {
        try {
            File f = file(context, SNAPSHOT_FILE);
            if (!f.exists()) return emptySnapshot();
            String raw = read(f);
            if (raw == null || raw.isEmpty()) return emptySnapshot();
            return new JSONObject(raw);
        } catch (Exception e) {
            return emptySnapshot();
        }
    }

    public static void saveSnapshot(Context context, JSONObject snapshot) throws Exception {
        write(file(context, SNAPSHOT_FILE), snapshot.toString());
    }

    public static JSONArray loadDrafts(Context context) {
        try {
            File f = file(context, DRAFTS_FILE);
            if (!f.exists()) return new JSONArray();
            String raw = read(f);
            if (raw == null || raw.isEmpty()) return new JSONArray();
            return new JSONArray(raw);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    public static void saveDrafts(Context context, JSONArray drafts) throws Exception {
        write(file(context, DRAFTS_FILE), drafts.toString());
    }

    public static void clearDrafts(Context context) throws Exception {
        saveDrafts(context, new JSONArray());
    }

    public static JSONObject appendTodoDraft(Context context, String day) throws Exception {
        String useDay = (day == null || day.isEmpty()) ? todayKey() : day;
        JSONObject draft = new JSONObject();
        draft.put("id", UUID.randomUUID().toString());
        draft.put("title", "新待办");
        draft.put("kind", "todo");
        draft.put("day", useDay);
        draft.put("startTime", JSONObject.NULL);
        draft.put("createdAt", isoNow());

        JSONArray drafts = loadDrafts(context);
        drafts.put(draft);
        saveDrafts(context, drafts);

        // Optimistic day item so the calendar widget updates immediately.
        JSONObject snap = loadSnapshot(context);
        JSONObject dayItems = snap.optJSONObject("dayItems");
        if (dayItems == null) dayItems = new JSONObject();
        JSONArray items = dayItems.optJSONArray(useDay);
        if (items == null) items = new JSONArray();
        JSONObject item = new JSONObject();
        item.put("id", draft.getString("id"));
        item.put("entityId", draft.getString("id"));
        item.put("entityType", "todo");
        item.put("title", draft.getString("title"));
        item.put("timeLabel", "待办");
        JSONArray next = new JSONArray();
        next.put(item);
        for (int i = 0; i < items.length(); i++) next.put(items.get(i));
        dayItems.put(useDay, next);
        snap.put("dayItems", dayItems);
        JSONArray marked = snap.optJSONArray("markedDays");
        if (marked == null) marked = new JSONArray();
        boolean has = false;
        for (int i = 0; i < marked.length(); i++) {
            if (useDay.equals(marked.optString(i))) {
                has = true;
                break;
            }
        }
        if (!has) marked.put(useDay);
        snap.put("markedDays", marked);
        snap.put("updatedAt", draft.getString("createdAt"));
        if (!snap.optBoolean("loggedIn", false)) snap.put("loggedIn", true);
        saveSnapshot(context, snap);
        return draft;
    }

    public static String todayKey() {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        fmt.setTimeZone(TimeZone.getDefault());
        return fmt.format(new Date());
    }

    public static String isoNow() {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        return fmt.format(new Date());
    }

    private static String read(File f) throws Exception {
        FileInputStream in = new FileInputStream(f);
        try {
            byte[] buf = new byte[(int) f.length()];
            int n = in.read(buf);
            if (n <= 0) return "";
            return new String(buf, 0, n, StandardCharsets.UTF_8);
        } finally {
            in.close();
        }
    }

    private static void write(File f, String raw) throws Exception {
        FileOutputStream out = new FileOutputStream(f);
        try {
            out.write(raw.getBytes(StandardCharsets.UTF_8));
            out.getFD().sync();
        } finally {
            out.close();
        }
    }
}
