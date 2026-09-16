import { Capacitor, registerPlugin } from "@capacitor/core";
const Appearance = registerPlugin<{
  setTheme(options: { dark: boolean }): Promise<void>;
}>("Appearance");
export function applyAppearance(dark: boolean) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.classList.toggle("dark", dark);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#171c19" : "#faf9f6");
  if (Capacitor.isNativePlatform())
    void Appearance.setTheme({ dark }).catch(() => {});
}
