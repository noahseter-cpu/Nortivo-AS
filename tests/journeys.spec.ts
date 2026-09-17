import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function nav(page: any, name: string) {
  await page
    .getByRole("navigation", { name: "Hovedmeny" })
    .getByRole("button", { name, exact: true })
    .click();
}
async function custom(page: any) {
  await nav(page, "Mat og kalorier");
  await page.getByRole("button", { name: "Legg inn eget produkt", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Produktnavn", exact: true })
    .fill("Fiktiv testdrikk");
  await page
    .getByRole("textbox", { name: "kcal per 100", exact: true })
    .fill("40");
  await page.getByLabel("Næringsgrunnlag").selectOption("ml");
  await page
    .getByRole("button", { name: "Lagre produkt", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
test("saved food offline, stable snapshot, manual mode and meal aggregation", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await custom(page);
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Velg Fiktiv testdrikk", exact: true })
    .click();
  await page
    .getByRole("textbox", {
      name: "Mengde spist eller drukket (ml)",
      exact: true,
    })
    .fill("500");
  await expect(page.locator(".portion-preview")).toContainText("200");
  await page.getByRole("button", { name: "Logg maten", exact: true }).click();
  await expect(page.locator(".calorie-total")).toContainText("200");
  await page.getByRole("button", { name: "Føringsmåte", exact: true }).click();
  await page.getByRole("combobox").last().selectOption("manual");
  await page.getByRole("textbox", { name: "Dagens totale kcal" }).fill("1540");
  await page.getByRole("button", { name: "Lagre", exact: true }).click();
  await expect(page.locator(".calorie-total")).toContainText("1 540");
  await page.getByRole("button", { name: "Føringsmåte", exact: true }).click();
  await page.getByRole("combobox").last().selectOption("items");
  await page.getByRole("button", { name: "Lagre", exact: true }).click();
  await expect(page.locator(".calorie-total")).toContainText("200");
  await page.getByRole("tab", { name: "Måltider", exact: true }).click();
  await page
    .getByRole("button", { name: "Lag et måltid", exact: false })
    .click();
  await page
    .getByRole("textbox", { name: "Navn på måltidet" })
    .fill("Testmåltid");
  await page
    .getByRole("textbox", { name: "Mengde (ml)", exact: true })
    .fill("500");
  await page.getByRole("button", { name: "Legg til", exact: true }).click();
  await page.getByRole("button", { name: "Lagre måltid", exact: true }).click();
  await page.getByRole("button", { name: "Logg", exact: true }).click();
  await page.getByRole("textbox", { name: "Porsjoner spist" }).fill("0,5");
  await page.getByRole("button", { name: "Logg måltid", exact: true }).click();
  await expect(page.locator(".calorie-total")).toContainText("300");
  await nav(page, "Økonomi");
  await expect(page.locator(".money-summary").first()).toContainText("0 kr");
  await context.setOffline(false);
});
test("backup download restore duplicate merge invalid import protects data", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Legg til utgift", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Beløp i kroner" }).fill("125");
  await page.getByRole("button", { name: "Lagre", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await nav(page, "Innstillinger");
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Sikkerhetskopi", exact: true })
    .click();
  const dl = await downloadEvent;
  const path = await dl.path();
  const backup = await readFile(path!, "utf8");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(backup),
    });
  await expect(page.getByRole("dialog")).toContainText("1 transaksjoner");
  await page
    .getByRole("button", { name: "Gjenopprett data", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        '{"format":"noah-tracker-backup","version":1,"data":{}}',
      ),
    });
  await expect(
    page.getByRole("alert").filter({ hasText: "Ugyldig sikkerhetskopi" }),
  ).toBeVisible();
  await nav(page, "Økonomi");
  await expect(page.locator(".money-summary")).toContainText("125 kr");
  await expect(page.locator(".record")).toHaveCount(1);
});
test("rapid saves focus and storage failure never claim success", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Legg til utgift", exact: true }),
  ).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: "Legg til utgift", exact: true })
      .click();
    await page.keyboard.press("Escape");
  }
  await page
    .getByRole("button", { name: "Legg til utgift", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Beløp i kroner" }).fill("90");
  await page.getByRole("button", { name: "Lagre", exact: true }).dblclick();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".record")).toHaveCount(1);
  await page.evaluate(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: {
        open() {
          throw Error("Simulert lagringsfeil");
        },
      },
    });
  });
  await page
    .getByRole("button", { name: "Legg til utgift", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Beløp i kroner" }).fill("20");
  await page.getByRole("button", { name: "Lagre", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".money-intro>strong")).toContainText("90 kr");
  await expect(page.getByText("Simulert lagringsfeil").first()).toBeVisible();
});
test("missing products provider error and camera denial retain fallbacks", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "Mat og kalorier");
  await page.route("**/api/foods?**", (r) =>
    r.fulfill({ json: { foods: [] } }),
  );
  await page
    .getByRole("textbox", { name: "Søk etter mat", exact: true })
    .fill("ukjent");
  await page.getByRole("button", { name: "Søk", exact: true }).click();
  await expect(
    page.getByText("Fant ikke produktet", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/foods?**");
  await page.route("**/api/foods?**", (r) =>
    r.fulfill({
      status: 429,
      json: { error: "Søkegrensen er nådd. Vent et minutt." },
    }),
  );
  await page
    .getByRole("textbox", { name: "Søk etter mat", exact: true })
    .fill("rate limit");
  await page.getByRole("button", { name: "Søk", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Søkegrensen");
  await page.getByRole("button", { name: "Skann", exact: true }).click();
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied", "NotAllowedError");
    };
  });
  await page.getByRole("button", { name: "Åpne kamera", exact: true }).click();
  await expect(page.getByText(/Kameraet kunne ikke åpnes/)).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Skriv strekkoden" }),
  ).toBeVisible();
});
test("WebMCP registration and valid invalid calls in simulated supported context", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, "modelContext", {
      value: {
        registerTool(tool: unknown) {
          (window as any).trackerTool = tool;
        },
      },
    });
  });
  await page.goto("/");
  await expect
    .poll(() => page.evaluate(() => !!(window as any).trackerTool))
    .toBe(true);
  const result = await page.evaluate(() =>
    (window as any).trackerTool.execute({ date: "2026-09-16" }),
  );
  expect(result.transactionCount).toBe(0);
  expect(result.steps).toBeNull();
  const invalid = await page.evaluate(() => {
    try {
      (window as any).trackerTool.execute({ date: "no" });
      return false;
    } catch {
      return true;
    }
  });
  expect(invalid).toBe(true);
});
