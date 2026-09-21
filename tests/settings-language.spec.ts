import { expect, test, type Page } from "@playwright/test";
import type { State } from "../lib/tracker-core";

async function start(page: Page) {
  await page.route("**/api/locale", (route) =>
    route.fulfill({ json: { country: "NO" } }),
  );
  await page.goto("/");
  await expect(page.locator(".app-shell, .profile-page")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "nb");
}

async function readStored(page: Page) {
  return page.evaluate(
    async () =>
      new Promise<State>((resolve, reject) => {
        const request = indexedDB.open("noah-tracker-private-v1", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction("records", "readonly");
          const value = transaction.objectStore("records").get("state");
          value.onsuccess = () => resolve(value.result);
          value.onerror = () => reject(value.error);
          transaction.oncomplete = () => db.close();
        };
      }),
  );
}

async function openSettings(page: Page) {
  if (await page.locator(".profile-page").isVisible()) {
    await page.getByRole("button", { name: "Gjør dette senere" }).click();
    await expect(page.locator(".app-shell")).toBeVisible();
  }
  await page
    .getByRole("navigation", { name: "Hovedmeny" })
    .getByRole("button", { name: "Innstillinger", exact: true })
    .click();
}

test("profile language changes preserve both form steps and the chosen calorie goal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  if (!(await page.locator(".profile-page").isVisible())) {
    await openSettings(page);
    await page.getByRole("button", { name: "Opprett profil" }).click();
  }
  await page
    .getByRole("textbox", { name: "Navn", exact: true })
    .fill("Ægir Test");
  await page.getByRole("textbox", { name: "Høyde (cm)" }).fill("180");
  await page.getByRole("textbox", { name: "Vekt (kg)" }).fill("80,5");
  await page.getByRole("textbox", { name: "Alder (år)" }).fill("30");
  await page
    .getByRole("combobox", { name: "Beregningsgrunnlag", exact: true })
    .selectOption("male");
  await page
    .getByRole("combobox", { name: "Vanlig aktivitetsnivå" })
    .selectOption("light");
  await page
    .getByRole("combobox", { name: "Er et generelt voksenestimat egnet?" })
    .selectOption("general");
  await page
    .getByRole("combobox", { name: "Språk / Language" })
    .selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("textbox", { name: "Name", exact: true }),
  ).toHaveValue("Ægir Test");
  await expect(page.getByRole("textbox", { name: "Weight (kg)" })).toHaveValue(
    "80,5",
  );
  await expect(
    page.getByRole("combobox", { name: "Usual activity level" }),
  ).toHaveValue("light");
  await page.getByRole("button", { name: "See estimate", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ægir Test, here is your estimate" }),
  ).toBeVisible();
  await page
    .getByRole("radio", { name: "Choose my own calorie goal", exact: true })
    .check();
  await page
    .getByRole("textbox", { name: "My calorie goal (kcal per day)" })
    .fill("2300");
  await page
    .getByRole("combobox", { name: "Språk / Language" })
    .selectOption("nb");
  await expect(
    page.getByRole("textbox", { name: "Mitt kalorimål (kcal per dag)" }),
  ).toHaveValue("2300");
  await page
    .getByRole("combobox", { name: "Språk / Language" })
    .selectOption("en");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.locator(".app-shell")).toBeVisible();
  const state = await readStored(page);
  expect(state.settings.language).toBe("en");
  expect(state.settings.name).toBe("Ægir Test");
  expect(state.profile!.weightKg).toBe(80.5);
  expect(state.profile!.equation).toBe("male");
  expect(state.profile!.activity).toBe("light");
  expect(state.goals.at(-1)!.calories).toBe(2300);
  await page.reload();
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: "Hi, Ægir Test" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("settings language preserves unsaved inputs and private category names", async ({
  page,
}) => {
  await start(page);
  await openSettings(page);
  await page
    .getByRole("textbox", { name: "Navn", exact: true })
    .fill("Mitt norske navn");
  await page
    .getByRole("textbox", { name: "Åpningssaldo (kr, valgfritt)" })
    .fill("2300,50");
  await page
    .getByRole("combobox", { name: "Språk / Language" })
    .selectOption("en");
  await expect(
    page.getByRole("textbox", { name: "Name", exact: true }),
  ).toHaveValue("Mitt norske navn");
  await expect(
    page.getByRole("textbox", { name: "Opening balance (NOK, optional)" }),
  ).toHaveValue("2300,50");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect
    .poll(async () => (await readStored(page)).settings.name)
    .toBe("Mitt norske navn");
  await page.getByRole("button", { name: "New", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New category" });
  await dialog
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Ærlig matbudsjett");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("Ærlig matbudsjett", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Språk / Language" })
    .selectOption("nb");
  await expect(
    page.getByText("Ærlig matbudsjett", { exact: true }),
  ).toBeVisible();
  const state = await readStored(page);
  expect(state.settings.opening!.amount).toBe(230050);
  expect(state.settings.name).toBe("Mitt norske navn");
  expect(state.categories.at(-1)!.name).toBe("Ærlig matbudsjett");
});

test("invalid backup errors are localized without exposing parser details", async ({
  page,
}) => {
  await start(page);
  await openSettings(page);
  await page
    .getByRole("combobox", { name: "Språk / Language" })
    .selectOption("en");
  await page.locator('input[type="file"]').setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("not json"),
  });
  await expect(page.getByRole("alert")).toHaveText(
    "Invalid backup. Your existing data has not changed.",
  );
  await page
    .getByRole("combobox", { name: "Språk / Language" })
    .selectOption("nb");
  await expect(page.getByRole("alert")).toHaveText(
    "Ugyldig sikkerhetskopi. Dine eksisterende data er uendret.",
  );
});
