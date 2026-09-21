import { z } from "zod";
import { foodSchema, type Food } from "./tracker-core";
const safeText = (v: unknown, max = 250) =>
  typeof v === "string" ? v.slice(0, max) : "";
const safeNumber = (v: unknown, max: number) => {
  const n =
    typeof v === "string" && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max
    ? n
    : null;
};
const safeKcal = (v: unknown) => safeNumber(v, 1000);
export const kjToKcal = (kj: number) => kj / 4.184;
export function offCalories(n: Record<string, unknown>): number | null {
  // Version 3.4 explicitly distinguishes kcal, kJ and serving energy.
  if (n["energy-kcal_unit"] && n["energy-kcal_unit"] !== "kcal") return null;
  const kcal = safeKcal(n["energy-kcal_100g"]);
  const kj =
    !n["energy-kj_unit"] || n["energy-kj_unit"] === "kJ"
      ? safeNumber(n["energy-kj_100g"], 4184)
      : null;
  // Conflicting energy declarations need a label check, not a guessed correction.
  if (
    kcal !== null &&
    kj !== null &&
    Math.abs(kcal - kjToKcal(kj)) > Math.max(2, kcal * 0.05)
  )
    return null;
  // Never substitute a serving field or the ambiguous generic energy field.
  return kcal ?? (kj === null ? null : kjToKcal(kj));
}
const nutrients = [
  "protein",
  "carbohydrate",
  "fat",
  "fiber",
  "sugar",
  "salt",
] as const;
export type NutrientKey = (typeof nutrients)[number];
export function nutrientAmount(
  food: Food,
  key: NutrientKey,
  amount: number,
  unit: Food["unit"],
): number | null {
  const value = food.nutrients100?.[key];
  if (
    value == null ||
    !unit ||
    unit !== food.unit ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 1e10
  )
    return null;
  return (value * amount) / 100;
}
export function localizedFoodName(food: Food, language: "nb" | "en"): string {
  return food.source === "Egen registrering" || food.source === "Lagret måltid"
    ? food.name
    : food.names?.[language] || food.name;
}
export const normalizeFoodQuery = (s: string) =>
  s
    .toLocaleLowerCase("nb")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ø/g, "o")
    .trim();
export function foodMatches(food: Food, query: string): boolean {
  const haystack = normalizeFoodQuery(
    [
      food.name,
      food.brand,
      food.names?.nb,
      food.names?.en,
      ...(food.searchKeywords ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  );
  return normalizeFoodQuery(query)
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}
export function rankFoods(
  foods: Food[],
  query: string,
  market: "no" | "world" = "no",
): Food[] {
  const q = normalizeFoodQuery(query);
  const score = (food: Food) => {
    const names = [
      food.name,
      food.names?.nb,
      food.names?.en,
      `${food.brand} ${food.name}`,
    ]
      .filter(Boolean)
      .map((s) => normalizeFoodQuery(s!));
    return (
      (food.barcode === query ? 1000 : 0) +
      (names.includes(q)
        ? 200
        : names.some((n) => n.startsWith(q + ",") || n.startsWith(q + " "))
          ? 120
          : foodMatches(food, q)
            ? 60
            : 0) +
      (market === "no" && food.markets?.includes("en:norway") ? 12 : 0)
    );
  };
  // Only identical source IDs deduplicate; similar products and variants stay separate.
  return [...new Map(foods.map((food) => [food.id, food])).values()].sort(
    (a, b) => score(b) - score(a),
  );
}
const base = {
  brand: "",
  url: "",
  image: "",
  barcode: "",
  portion: null,
  portionName: "Porsjon",
  packageSize: "",
  favorite: false,
  confirmed: false,
};
export function fromMatvare(raw: unknown): Food | null {
  const p = z
    .object({
      foodId: z.string(),
      foodName: z.string(),
      foodNameEn: z.string().optional(),
      searchKeywords: z.array(z.string()).optional(),
      sourceVersion: z.string().optional(),
      constituents: z
        .array(
          z.object({
            nutrientId: z.string(),
            quantity: z.number().nullable().optional(),
            unit: z.string().optional(),
          }),
        )
        .optional(),
      portionsEn: z
        .array(
          z.object({
            quantity: z.number().nullable().optional(),
            portionName: z.string().optional(),
          }),
        )
        .optional(),
      uri: z.string().optional(),
      calories: z
        .object({
          quantity: z.number().nullable().optional(),
          unit: z.string().optional(),
        })
        .optional(),
      portions: z
        .array(
          z.object({
            quantity: z.number().nullable().optional(),
            unit: z.string().optional(),
            portionName: z.string().optional(),
          }),
        )
        .optional(),
    })
    .safeParse(raw);
  if (!p.success) return null;
  const x = p.data;
  const portion = x.portions?.find(
    (p) => p.unit === "g" && p.quantity && p.quantity > 0,
  );
  const ids = {
    protein: "Protein",
    carbohydrate: "Karbo",
    fat: "Fett",
    fiber: "Fiber",
    sugar: "Mono+Di",
    salt: "NaCl",
  };
  const nutrients100 = Object.fromEntries(
    nutrients.map((key) => {
      const nutrient = x.constituents?.find((n) => n.nutrientId === ids[key]);
      return [
        key,
        nutrient?.unit === "g" ? safeNumber(nutrient.quantity, 100) : null,
      ];
    }),
  );
  const calories =
    x.calories?.unit === "kcal" ? safeKcal(x.calories.quantity) : null;
  return foodSchema.parse({
    ...base,
    id: `mvt:${x.foodId}`,
    name: x.foodName,
    names: { nb: x.foodName, en: x.foodNameEn },
    searchKeywords: x.searchKeywords,
    sourceVersion: x.sourceVersion,
    markets: ["en:norway"],
    nutrients100,
    originalEnergy:
      calories === null
        ? undefined
        : { value: calories, unit: "kcal", basis: "100g" },
    source: "Matvaretabellen",
    sourceId: x.foodId,
    url: x.uri ?? "",
    kcal100: calories,
    unit: "g",
    portion: portion?.quantity ?? null,
    portionName: portion?.portionName ?? "Porsjon",
    portionNames: portion
      ? {
          nb: portion.portionName,
          en: x.portionsEn?.find((p) => p.quantity === portion.quantity)
            ?.portionName,
        }
      : undefined,
    confirmed: true,
  });
}
export function fromOFF(raw: unknown): Food | null {
  const p = z.record(z.unknown()).safeParse(raw);
  if (!p.success) return null;
  const x = p.data;
  if (typeof x.code !== "string") return null;
  const n = z.record(z.unknown()).safeParse(x.nutriments);
  const image = safeText(x.image_front_small_url, 1000);
  const nn = n.success ? n.data : {};
  const calories = offCalories(nn);
  const unit = x.nutrition_data_per === "100ml" ? "ml" : null;
  const originalKcal = safeKcal(nn["energy-kcal_100g"]);
  const originalKj = safeNumber(nn["energy-kj_100g"], 4184);
  const fields = {
    protein: "proteins",
    carbohydrate: "carbohydrates",
    fat: "fat",
    fiber: "fiber",
    sugar: "sugars",
    salt: "salt",
  };
  return foodSchema.parse({
    ...base,
    id: `off:${x.code}`,
    name:
      safeText(x.product_name_nb) ||
      safeText(x.product_name) ||
      `Produkt ${x.code}`,
    names: {
      nb: safeText(x.product_name_nb) || undefined,
      en: safeText(x.product_name_en) || undefined,
    },
    brand: safeText(x.brands),
    source: "Open Food Facts",
    sourceId: x.code,
    barcode: x.code,
    url: `https://world.openfoodfacts.org/product/${encodeURIComponent(x.code)}`,
    image: image.startsWith("https://images.openfoodfacts.org/") ? image : "",
    packageSize: safeText(x.quantity),
    kcal100: calories,
    nutrients100: Object.fromEntries(
      nutrients.map((key) => [key, safeNumber(nn[`${fields[key]}_100g`], 100)]),
    ),
    unit,
    markets: Array.isArray(x.countries_tags)
      ? x.countries_tags
          .filter((v): v is string => typeof v === "string")
          .slice(0, 50)
      : [],
    sourceVersion: "Open Food Facts API 3.4 / search legacy",
    originalEnergy:
      calories === null
        ? undefined
        : {
            value: originalKcal ?? originalKj,
            unit: originalKcal === null ? "kJ" : "kcal",
            basis: unit === "ml" ? "100ml" : "100-unknown",
          },
  });
}

export function preferredFood(food: Food, saved: Food[]): Food {
  return (
    [...saved]
      .reverse()
      .find(
        (f) => f.source === "Egen registrering" && f.sourceId === food.id,
      ) ??
    saved.find((f) => f.id === food.id) ??
    food
  );
}
