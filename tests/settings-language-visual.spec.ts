import { expect, test } from "@playwright/test";

test("bilingual settings and profile reflow at 320px and desktop", async ({
  page,
}) => {
  await page.route("**/api/locale", (route) =>
    route.fulfill({ json: { country: "GB" } }),
  );
  await page.goto("/");
  await expect(page.locator(".app-shell, .profile-page")).toBeVisible();
  if (await page.locator(".profile-page").isVisible()) {
    await page.getByRole("button", { name: "Do this later" }).click();
    await expect(page.locator(".app-shell")).toBeVisible();
  }
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  for (const language of ["en", "nb"] as const) {
    await page
      .getByRole("combobox", { name: "Språk / Language" })
      .selectOption(language);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({
        path: `outputs/release-1.0/settings-${language}-${width}.png`,
        fullPage: width === 1440,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page
    .getByRole("button", { name: "Opprett profil", exact: true })
    .click();
  for (const language of ["en", "nb"] as const) {
    await page
      .getByRole("combobox", { name: "Språk / Language" })
      .selectOption(language);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({
        path: `outputs/release-1.0/profile-${language}-${width}.png`,
        fullPage: width === 1440,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.getByRole("button", { name: "Gjør dette senere" }).click();
  await expect(page.locator(".app-shell")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 450 });
  await page
    .getByRole("button", { name: "Velg mitt kalorimål", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Dine mål" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(321);
  await dialog
    .getByRole("button", { name: "Lagre", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    dialog.getByRole("button", { name: "Lagre", exact: true }),
  ).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Velg mitt kalorimål", exact: true }),
  ).toBeFocused();
});
