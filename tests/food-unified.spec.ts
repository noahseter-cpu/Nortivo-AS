import { test, expect } from "./legacy-test";
import "fake-indexeddb/auto";
import {
  fromMatvare,
  fromOFF,
  foodMatches,
  rankFoods,
  nutrientAmount,
  localizedFoodName,
  kjToKcal,
} from "../lib/food-adapters";
import { searchFoods, searchFood } from "../lib/food-search";
import { foodSchema, kcal } from "../lib/tracker-core";
import { GET } from "../lib/food-provider";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import snapshot from "../lib/data/matvaretabellen.json" with { type: "json" };

test("official bilingual names find the same foods and retain distinct preparation variants", async () => {
  const controller = new AbortController();
  const apple = await searchFood("mvt", "apple", controller.signal);
  const eple = await searchFood("mvt", "eple", controller.signal);
  expect(apple.length).toBeGreaterThan(0);
  expect(apple.some((a) => eple.some((e) => e.id === a.id))).toBe(true);
  expect(
    apple.some((f) =>
      localizedFoodName(f, "en").toLowerCase().includes("apple"),
    ),
  ).toBe(true);
  for (const raw of snapshot.foods) {
    const food = fromMatvare(raw)!;
    expect(food, raw.foodId).not.toBeNull();
    expect(food.names?.en).toBe(raw.foodNameEn);
    expect(foodMatches(food, raw.foodNameEn)).toBe(true);
  }
});

test("source nutrients preserve unknown versus zero and scale only the confirmed basis", () => {
  const food = fromMatvare({
    foodId: "fixture",
    foodName: "Synthetic food",
    calories: { quantity: 250, unit: "kcal" },
    constituents: [
      { nutrientId: "Protein", quantity: 0, unit: "g" },
      { nutrientId: "Fett", quantity: 10, unit: "g" },
      { nutrientId: "Fiber", unit: "g" },
    ],
  })!;
  expect(kcal(food, 150)).toBe(375);
  expect(nutrientAmount(food, "protein", 150, "g")).toBe(0);
  expect(nutrientAmount(food, "fat", 150, "g")).toBe(15);
  expect(nutrientAmount(food, "fiber", 150, "g")).toBeNull();
  expect(nutrientAmount(food, "fat", 150, "ml")).toBeNull();
  expect(nutrientAmount(food, "fat", -10, "g")).toBeNull();
  expect(nutrientAmount(food, "fat", Infinity, "g")).toBeNull();
  const drink = foodSchema.parse({ ...food, kcal100: 40, unit: "ml" });
  expect(kcal(drink, 500)).toBe(200);
  expect(kcal(drink, 12.5)).toBe(5);
});

test("explicit kJ conversion is recorded while serving energy and density remain unknown", () => {
  const food = fromOFF({
    code: "0123456789012",
    product_name: "Synthetic drink",
    quantity: "500 ml",
    nutriments: {
      "energy-kj_100g": 167.36,
      "energy-kj_unit": "kJ",
      proteins_100g: 0,
      fat_100g: 0,
    },
  })!;
  expect(kjToKcal(167.36)).toBeCloseTo(40, 10);
  expect(food.kcal100).toBeCloseTo(40, 10);
  expect(food.originalEnergy).toEqual({
    value: 167.36,
    unit: "kJ",
    basis: "100-unknown",
  });
  expect(food.unit).toBeNull();
  expect(food.portion).toBeNull();
  expect(food.nutrients100?.protein).toBe(0);
  expect(food.nutrients100?.fiber).toBeNull();
  expect(
    fromOFF({ code: "12345678", nutriments: { "energy-kcal_serving": 200 } })
      ?.kcal100,
  ).toBeNull();
});

test("ranking favours exact identity and deduplicates IDs without merging variants", () => {
  const make = (id: string, name: string, markets: string[] = []) =>
    foodSchema.parse({
      id,
      name,
      source: "Open Food Facts",
      kcal100: 40,
      unit: "ml",
      markets,
    });
  const a = make("a", "Apple juice"),
    b = make("b", "Apple juice, no sugar", ["en:norway"]),
    c = make("c", "Apple juice");
  expect(rankFoods([b, a, a, c], "Apple juice").map((f) => f.id)).toEqual([
    "a",
    "c",
    "b",
  ]);
  const custom = foodSchema.parse({
    ...a,
    source: "Egen registrering",
    name: "Min egen drikk",
    names: { en: "Apple juice" },
  });
  expect(localizedFoodName(custom, "en")).toBe("Min egen drikk");
});

test("a failed remote source leaves local results and reports a partial search", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw Error("Synthetic network failure");
  };
  const events: Array<{ count: number; pending: boolean }> = [];
  try {
    const result = await searchFoods(
      "apple",
      new AbortController().signal,
      {},
      (r) => events.push({ count: r.foods.length, pending: r.pending }),
    );
    expect(result.foods.length).toBeGreaterThan(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].source).toBe("Open Food Facts");
    expect(result.pending).toBe(false);
    expect(events.some((e) => e.count > 0)).toBe(true);
  } finally {
    globalThis.fetch = original;
  }
  const controller = new AbortController();
  controller.abort();
  await expect(searchFoods("apple", controller.signal)).rejects.toThrow();
});

test("provider errors are localized without exposing technical errors", async () => {
  const response = await GET(
    new Request(
      "https://localhost/api/foods?provider=invalid&q=apple&language=en",
    ),
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: "This food source is not supported.",
    messageKey: "Ukjent matkilde.",
  });
});

test("a cancelled native bridge cannot leave the source promise pending", async () => {
  const native = Capacitor.isNativePlatform,
    get = CapacitorHttp.get;
  Capacitor.isNativePlatform = () => true;
  CapacitorHttp.get = () => new Promise(() => {});
  const controller = new AbortController();
  try {
    const result = GET(
      new Request(
        "https://localhost/api/foods?provider=off&barcode=1234567890128",
        { signal: controller.signal },
      ),
    );
    controller.abort();
    const response = await result;
    expect(response.status).toBe(502);
    expect((await response.json() as {messageKey:string}).messageKey).toBe(
      "Søket tok for lang tid. Prøv igjen.",
    );
  } finally {
    Capacitor.isNativePlatform = native;
    CapacitorHttp.get = get;
  }
});

test("unified UI makes no request per keypress and exposes partial results", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/foods?**", async (route) => {
    requests++;
    await route.fulfill({
      status: 503,
      json: { error: "Matkilden er utilgjengelig." },
    });
  });
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Hovedmeny" })
    .getByRole("button", { name: "Mat og kalorier", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Søk etter mat", exact: true })
    .fill("apple");
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "Søk", exact: true }).click();
  await expect(
    page.locator(".external-results .food-result").first(),
  ).toBeVisible();
  await expect(
    page.getByText("Open Food Facts: Matkilden er utilgjengelig."),
  ).toBeVisible();
  expect(requests).toBe(1);
  await page
    .getByRole("combobox", { name: "Matmarked", exact: true })
    .selectOption("world");
  await expect(
    page.getByRole("combobox", { name: "Matmarked", exact: true }),
  ).toHaveValue("world");
  await page.reload();
  await page
    .getByRole("navigation", { name: "Hovedmeny" })
    .getByRole("button", { name: "Mat og kalorier", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Matmarked", exact: true }),
  ).toHaveValue("world");
});
