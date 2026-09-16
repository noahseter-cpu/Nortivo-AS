import { test, expect } from "@playwright/test";
test("desktop overview screenshot and complete finance interaction", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Legg til utgift", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: ".impeccable/review/desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Gi måneden en ramme" }).click();
  await page
    .getByRole("textbox", { name: "Mat (kr)", exact: true })
    .fill("2300");
  await page.getByRole("button", { name: "Lagre", exact: true }).click();
  for (const amount of ["125", "90"]) {
    await page
      .getByRole("button", { name: "Legg til utgift", exact: true })
      .click();
    await page.getByRole("textbox", { name: "Beløp i kroner" }).fill(amount);
    await page.getByRole("button", { name: "Lagre", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
  await expect(page.locator(".budget-remaining")).toContainText("2 085");
  await page.reload();
  await expect(page.locator(".budget-remaining")).toContainText("2 085");
  await page
    .getByRole("button", { name: "Oppdater skritt", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Totalt antall skritt", exact: false })
    .fill("6840");
  await page.getByRole("button", { name: "Lagre", exact: true }).click();
  await expect(page.locator(".daily-stat").first()).toContainText("6 840");
  await page
    .getByRole("button", { name: "Oppdater skritt", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Totalt antall skritt", exact: false })
    .fill("7000");
  await page.getByRole("button", { name: "Lagre", exact: true }).click();
  await expect(page.locator(".daily-stat").first()).toContainText("7 000");
  await page
    .getByRole("button", { name: "Legg til utgift", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Legg til utgift", exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: ".impeccable/review/desktop-populated.png",
    fullPage: true,
  });
});
test("mobile and reduced motion navigation no overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Legg til utgift", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: ".impeccable/review/mobile.png",
    fullPage: true,
  });
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
  }
  await page
    .getByRole("button", { name: "Legg til utgift", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
