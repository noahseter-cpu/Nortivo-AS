import { test, expect } from "@playwright/test";
import { fromOFF, preferredFood } from "../lib/food-adapters";
import { foodSchema, kcal } from "../lib/tracker-core";
test("energy units and conflicting declarations cannot silently become calories", () => {
  const product = (nutriments: any) =>
    fromOFF({ code: "12345678", product_name: "Fixture", nutriments });
  expect(product({ "energy-kcal_100g": "29" })?.kcal100).toBe(29);
  expect(
    product({ "energy-kcal_100g": 121, "energy-kcal_unit": "kJ" })?.kcal100,
  ).toBeNull();
  expect(
    product({ "energy-kcal_100g": 290, "energy-kj_100g": 121 })?.kcal100,
  ).toBeNull();
  expect(
    product({ "energy-kcal_100g": 29, "energy-kj_100g": 121 })?.kcal100,
  ).toBe(29);
  expect(product({ "energy-kcal_serving": 145 })?.kcal100).toBeNull();
});
test("personal correction wins over later provider results, without mutating history", () => {
  const source = fromOFF({
    code: "12345678",
    product_name: "Fixture",
    nutriments: { "energy-kcal_100g": 20 },
  })!;
  const old = structuredClone(source);
  const corrected = foodSchema.parse({
    ...source,
    id: "custom:fixture",
    source: "Egen registrering",
    sourceId: source.id,
    kcal100: 29,
    unit: "ml",
  });
  expect(preferredFood(source, [source, corrected])).toEqual(corrected);
  expect(kcal(corrected, 500)).toBe(145);
  expect(source).toEqual(old);
});
test("own product can be saved and logged in one mobile flow", async ({
  page,
}) => {
  test.skip(!process.env.MOBILE_PROFILE_TEST, "mobile build");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Gjør dette senere" }).click();
  await page
    .getByRole("navigation", { name: "Hovedmeny" })
    .getByRole("button", { name: "Mat og kalorier", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Legg inn eget produkt", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Produktnavn", exact: true })
    .fill("Testdrikk fra etiketten");
  await page
    .getByRole("textbox", { name: "kcal per 100", exact: true })
    .fill("29");
  await page.getByLabel("Næringsgrunnlag").selectOption("ml");
  await page.getByLabel("Logg også det jeg spiste").check();
  await page
    .getByRole("textbox", {
      name: "Mengde spist eller drukket (ml)",
      exact: true,
    })
    .fill("500");
  await expect(page.locator(".portion-preview")).toContainText("145");
  await page.screenshot({ path: ".sites-runtime/audit/custom-food.png" });
  await page.getByRole("button", { name: "Logg maten", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".food-diary")).toContainText("145");
  await page.reload();
  await page
    .getByRole("navigation", { name: "Hovedmeny" })
    .getByRole("button", { name: "Mat og kalorier", exact: true })
    .click();
  await expect(page.locator(".food-diary")).toContainText("145");
  await page.screenshot({
    path: ".sites-runtime/audit/custom-food-page.png",
    fullPage: true,
  });
});
