import { test, expect } from "@playwright/test";
import { emptyState, validateState } from "../lib/tracker-core";
test("v2 update retains records and profile while adding system theme", () => {
  const old: any = emptyState();
  old.version = 2;
  delete old.settings.theme;
  old.settings.name = "Existing user";
  old.transactions.push({
    id: "old",
    type: "expense",
    amount: 12345,
    categoryId: "cat-0",
    date: "2026-09-01",
    title: "Keep me",
    note: "",
  });
  const updated = validateState(old);
  expect(updated.version).toBe(3);
  expect(updated.settings.theme).toBe("system");
  expect(updated.transactions).toEqual(old.transactions);
  expect(updated.settings.name).toBe("Existing user");
});
test.describe("Android layout and appearance", () => {
  test.skip(!process.env.MOBILE_PROFILE_TEST, "Standalone mobile build");
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 892 });
    await page.goto("/");
    await page.getByRole("button", { name: "Gjør dette senere" }).click();
  });
  test("dialogs stay within the screen with keyboard-sized and landscape viewports", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "Legg til utgift", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    for (const size of [
      { width: 412, height: 892 },
      { width: 412, height: 360 },
      { width: 892, height: 360 },
      { width: 320, height: 400 },
    ]) {
      await page.setViewportSize(size);
      await page.getByRole("textbox", { name: "Beløp i kroner" }).fill("40");
      await expect
        .poll(async () => {
          const b = await dialog.boundingBox();
          return (
            !!b &&
            b.x >= 0 &&
            b.y >= 0 &&
            b.x + b.width <= size.width + 1 &&
            b.y + b.height <= size.height + 1
          );
        })
        .toBe(true);
      await page
        .getByRole("button", { name: "Lagre", exact: true })
        .scrollIntoViewIfNeeded();
      await expect(
        page.getByRole("button", { name: "Lagre", exact: true }),
      ).toBeInViewport();
    }
    await page.setViewportSize({ width: 412, height: 892 });
    await expect(dialog).toHaveCSS("opacity", "1");
    await page.screenshot({
      path: ".sites-runtime/arc-popup-light.png",
    });
    await page.getByRole("button", { name: "Lagre", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.reload();
    await expect(page.locator(".money-panel")).toContainText("40");
  });
  test("dark switch persists, system follows device, every page and popup is themed", async ({
    page,
  }) => {
    await expect(page.locator(".brand-mobile")).toContainText("Arc");
    await page
      .getByRole("button", { name: "Bytt lyst eller mørkt tema" })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    for (const name of [
      "Økonomi",
      "Mat og kalorier",
      "Aktivitet",
      "Historikk",
      "Innstillinger",
      "Oversikt",
    ]) {
      await page
        .getByRole("navigation", { name: "Hovedmeny" })
        .getByRole("button", { name, exact: true })
        .click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await page
          .locator(".panel")
          .first()
          .evaluate((e) => getComputedStyle(e).backgroundColor),
      ).toBe("rgb(34, 41, 37)");
    }
    await page.screenshot({
      path: ".sites-runtime/arc-dark-mobile.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Legg til utgift", exact: true })
      .click();
    expect(
      await page
        .getByRole("dialog")
        .evaluate((e) => getComputedStyle(e).backgroundColor),
    ).toBe("rgb(34, 41, 37)");
    expect(
      await page
        .getByRole("textbox", { name: "Beløp i kroner" })
        .evaluate((e) => getComputedStyle(e).backgroundColor),
    ).toBe("rgb(34, 41, 37)");
    await page.setViewportSize({ width: 412, height: 360 });
    await page
      .getByRole("button", { name: "Lagre", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(page.getByRole("dialog")).toHaveCSS("opacity", "1");
    await page.screenshot({
      path: ".sites-runtime/arc-popup-dark-keyboard.png",
    });
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: ".sites-runtime/arc-dark-desktop.png",
    });
    await page
      .getByRole("navigation", { name: "Hovedmeny" })
      .getByRole("button", { name: "Innstillinger", exact: true })
      .click();
    await page.getByRole("button", { name: "System", exact: true }).click();
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});
