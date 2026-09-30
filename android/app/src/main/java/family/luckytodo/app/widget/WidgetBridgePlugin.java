package family.luckytodo.app.widget;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void hasAppGroup(PluginCall call) {
        JSObject out = new JSObject();
        out.put("ok", true);
        out.put("group", "filesDir/widgets");
        out.put("platform", "android");
        call.resolve(out);
    }

    @PluginMethod
    public void writeSnapshot(PluginCall call) {
        JSObject snapshot = call.getObject("snapshot");
        if (snapshot == null) {
            call.reject("missing snapshot");
            return;
        }
        try {
            WidgetStore.saveSnapshot(getContext(), new JSONObject(snapshot.toString()));
            WidgetUpdater.reloadAll(getContext());
            JSObject out = new JSObject();
            out.put("ok", true);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("write failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void consumeDrafts(PluginCall call) {
        try {
            JSONArray drafts = WidgetStore.loadDrafts(getContext());
            WidgetStore.clearDrafts(getContext());
            JSObject out = new JSObject();
            out.put("drafts", new JSArray(drafts.toString()));
            call.resolve(out);
        } catch (Exception e) {
            call.reject("consume failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void reloadTimelines(PluginCall call) {
        WidgetUpdater.reloadAll(getContext());
        JSObject out = new JSObject();
        out.put("ok", true);
        call.resolve(out);
    }
}
