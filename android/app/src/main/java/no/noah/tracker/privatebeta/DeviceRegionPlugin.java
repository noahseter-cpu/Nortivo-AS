package no.noah.tracker.privatebeta;

import android.content.res.Resources;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** The device's selected region, not physical location or Google Play country. */
@CapacitorPlugin(name = "DeviceRegion")
public class DeviceRegionPlugin extends Plugin {
    @PluginMethod
    public void getRegion(PluginCall call) {
        android.os.LocaleList locales = Resources.getSystem().getConfiguration().getLocales();
        String country = locales.isEmpty() ? "" : locales.get(0).getCountry();
        JSObject result = new JSObject();
        result.put("country", country.matches("[A-Z]{2}") ? country : JSObject.NULL);
        call.resolve(result);
    }
}
