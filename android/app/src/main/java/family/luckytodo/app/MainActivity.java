package family.luckytodo.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import family.luckytodo.app.widget.WidgetBridgePlugin;
import family.luckytodo.app.widget.WidgetUpdater;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        WidgetUpdater.reloadAll(this);
    }
}
