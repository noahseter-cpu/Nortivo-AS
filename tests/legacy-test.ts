import { test as base, expect } from "@playwright/test";

// Existing Bokmål journeys explicitly run in Norway. Country policy itself is
// covered separately with NO, foreign and unknown signals, without this fixture.
export const test = base.extend({
  page: async ({ page }, providePage) => {
    await page.route("**/api/locale", (route) =>
      route.fulfill({ json: { country: "NO", source: "network-country" } }),
    );
    await providePage(page);
  },
});
export { expect };
