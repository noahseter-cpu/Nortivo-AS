import { test, expect } from "@playwright/test";
import type { State } from "../lib/tracker-core";

test("source food selection shows scaled nutrients and preserves its snapshot", async ({
  page,
}) => {
  await page.route("**/api/locale", (r) =>
    r.fulfill({ json: { country: "GB" } }),
  );
  await page.route("**/api/foods?**", (r) =>
    r.fulfill({ json: { foods: [] } }),
  );
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Food & calories", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search for food", exact: true })
    .fill("apple");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .locator(".external-results .food-result")
    .first()
    .getByRole("button")
    .first()
    .click();
  const amount = page.getByRole("textbox", {
    name: "Amount eaten or drunk (g)",
    exact: true,
  });
  await amount.fill("150");
  await expect(page.locator(".food-nutrients").first()).toBeVisible();
  const energy = Number(
    await page
      .getByRole("textbox", { name: "kcal per 100", exact: true })
      .inputValue(),
  );
  await expect(page.locator(".portion-preview")).toContainText(
    String(energy * 1.5),
  );
  await page
    .getByRole("textbox", { name: "kcal per 100", exact: true })
    .fill("99");
  await expect(page.locator(".food-nutrients").first()).toContainText(
    "Unknown",
  );
  await expect(
    page.locator(".food-nutrients").first().locator("dd"),
  ).toHaveText(Array(6).fill("Unknown"));
  await page
    .getByRole("textbox", { name: "kcal per 100", exact: true })
    .fill(String(energy));
  await expect(page.locator(".food-nutrients").first()).not.toContainText(
    "Unknown",
  );
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.screenshot({
      path: `outputs/release-1.0/source-food-form-en-${width}.png`,
    });
    const box = await page.getByRole("dialog").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
  }
  await page.getByRole("button", { name: "Log food", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const saved = await stored(page);
  expect(saved.logs[0].amount).toBe(150);
  expect(saved.logs[0].food.source).toBe("Matvaretabellen");
  expect(saved.logs[0].food.nutrients100).toBeDefined();
  await page.reload();
  expect((await stored(page)).logs).toEqual(saved.logs);
});

async function stored(page: import("@playwright/test").Page) {
  return page.evaluate(
    () =>
      new Promise<State>((resolve, reject) => {
        const r = indexedDB.open("noah-tracker-private-v1", 1);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result;
          const get = db
            .transaction("records")
            .objectStore("records")
            .get("state");
          get.onsuccess = () => {
            resolve(get.result);
            db.close();
          };
        };
      }),
  );
}
for (const [country, system, expected] of [
  ["NO", "en-US", "nb"],
  ["GB", "nb-NO", "en"],
  ["SE", "nb-NO", "en"],
  ["DK", "nb-NO", "en"],
  [null, "nb-NO", "en"],
] as const) {
  test(`first-use country ${country} overrides system ${system}`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ locale: system });
    const page = await context.newPage();
    await page.route("**/api/locale", (r) => r.fulfill({ json: { country } }));
    await page.goto(baseURL!);
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect
      .poll(async () => (await stored(page))?.settings.language)
      .toBe(expected);
    await expect(page.locator("html")).toHaveAttribute("lang", expected);
    await context.close();
  });
}
test("a manual choice beats a slow country result, survives restart and travel", async ({
  page,
}) => {
  let release: (() => void) | undefined;
  await page.route("**/api/locale", async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({ json: { country: "NO" } }).catch(() => {});
  });
  await page.goto("/");
  await expect.poll(() => Boolean(release)).toBe(true);
  await page
    .getByRole("combobox", { name: "Språk / Language" })
    .selectOption("en");
  await expect
    .poll(async () => (await stored(page))?.settings.languageSource)
    .toBe("manual");
  release?.();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await page.unroute("**/api/locale");
  await page.route("**/api/locale", (r) =>
    r.fulfill({ json: { country: "NO" } }),
  );
  await page.reload();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
test("money remains NOK and exact through both languages and editing", async ({
  page,
}) => {
  await page.route("**/api/locale", (r) =>
    r.fulfill({ json: { country: "GB" } }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: /^Set a budget for the month/ })
    .click();
  await page
    .getByRole("textbox", { name: "Food (kr)", exact: true })
    .fill("2300");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  for (const amount of ["120", "80"]) {
    await page
      .getByRole("button", { name: "Add expense", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Amount in NOK", exact: true })
      .fill(amount);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
  await expect(page.locator(".budget-remaining")).toContainText("2,100");
  const before = await stored(page);
  await page
    .getByRole("combobox", { name: "Språk / Language" })
    .selectOption("nb");
  await expect(page.locator("html")).toHaveAttribute("lang", "nb");
  await expect(page.locator(".budget-remaining")).toContainText("2 100");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Legg til utgift", exact: true }),
  ).toBeVisible();
  const after = await stored(page);
  expect(after.transactions).toEqual(before.transactions);
  expect(after.budgets).toEqual(before.budgets);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Økonomi", exact: true })
    .click();
  await expect(page.locator(".money-summary")).toContainText("200 kr");
  await page
    .locator(".record")
    .filter({ hasText: "120 kr" })
    .getByRole("button", { name: "Rediger registrering" })
    .click();
  await page.getByRole("textbox", { name: "Beløp i kroner" }).fill("100,50");
  await page.getByRole("button", { name: "Lagre", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(
    (await stored(page)).transactions.reduce((sum, tx) => sum + tx.amount, 0),
  ).toBe(18050);
});
test("both languages and themes fit mobile and desktop", async ({ page }) => {
  test.setTimeout(60000);
  await page.route("**/api/locale", (r) =>
    r.fulfill({ json: { country: "GB" } }),
  );
  await page.goto("/");
  for (const language of ["en", "nb"] as const) {
    const labels =
      language === "en"
        ? [
            "Overview",
            "Money",
            "Food & calories",
            "Activity",
            "History",
            "Settings",
          ]
        : [
            "Oversikt",
            "Økonomi",
            "Mat og kalorier",
            "Aktivitet",
            "Historikk",
            "Innstillinger",
          ];
    const currentLanguage = await page.locator("html").getAttribute("lang");
    await page
      .getByRole("navigation")
      .getByRole("button", {
        name: currentLanguage === "nb" ? "Innstillinger" : "Settings",
        exact: true,
      })
      .click();
    await page
      .getByRole("combobox", { name: "Språk / Language" })
      .selectOption(language);
    for (const theme of ["light", "dark"]) {
      await page.emulateMedia({
        colorScheme: theme as "light" | "dark",
        reducedMotion: "reduce",
      });
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({
          width,
          height: width === 1440 ? 1000 : 844,
        });
        for (const name of labels) {
          await page
            .getByRole("navigation")
            .getByRole("button", { name, exact: true })
            .click();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${language} ${theme} ${width} ${name}`,
          ).toBe(true);
        }
        if (width !== 320) {
          await page
            .getByRole("navigation")
            .getByRole("button", { name: labels[2], exact: true })
            .click();
          await page.screenshot({
            path: `outputs/release-1.0/food-${language}-${theme}-${width}.png`,
            fullPage: true,
          });
        }
      }
    }
  }
});
