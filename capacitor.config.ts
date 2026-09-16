import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "no.noah.tracker.privatebeta",
  appName: "Nortivo",
  webDir: "dist-mobile",
  android: { allowMixedContent: false, backgroundColor: "#faf9f6" },
  server: { androidScheme: "https" },
};
export default config;
