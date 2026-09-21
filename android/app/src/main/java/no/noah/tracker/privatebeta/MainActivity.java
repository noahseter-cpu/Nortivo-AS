package no.noah.tracker.privatebeta;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AppearancePlugin.class);
        registerPlugin(DeviceRegionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
