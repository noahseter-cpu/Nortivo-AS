import { createRoot } from "react-dom/client";
import Tracker from "../components/tracker";
import "../app/globals.css";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
if (Capacitor.isNativePlatform()) {
  document.documentElement.dataset.native = "true";
  void App.addListener("backButton", () => {
    window.dispatchEvent(new Event("noah-back"));
  });
}
createRoot(document.getElementById("root")!).render(<Tracker />);
