import { z } from "zod";
import { foodSchema, type Food } from "./tracker-core";
const safeText = (v: unknown, max = 250) =>
  typeof v === "string" ? v.slice(0, max) : "";
const safeKcal = (v: unknown) => {
  const n =
    typeof v === "string" && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1000
    ? n
    : null;
};
export function offCalories(n: Record<string, unknown>): number | null {
  // Read only the explicit kcal/100 field, never serving energy or generic kJ.
  if (n["energy-kcal_unit"] && n["energy-kcal_unit"] !== "kcal") return null;
  const kcal = safeKcal(n["energy-kcal_100g"]);
  const kj = n["energy-kj_100g"];
  // Conflicting energy declarations need a label check, not a guessed correction.
  if (
    kcal !== null &&
    typeof kj === "number" &&
    Number.isFinite(kj) &&
    Math.abs(kcal - kj / 4.184) > Math.max(20, kcal * 0.2)
  )
    return null;
  return kcal;
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
      uri: z.string().optional(),
      calories: z
        .object({
          quantity: z.number().optional(),
          unit: z.string().optional(),
        })
        .optional(),
      portions: z
        .array(
          z.object({
            quantity: z.number().optional(),
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
  return foodSchema.parse({
    ...base,
    id: `mvt:${x.foodId}`,
    name: x.foodName,
    source: "Matvaretabellen",
    sourceId: x.foodId,
    url: x.uri ?? "",
    kcal100: x.calories?.unit === "kcal" ? safeKcal(x.calories.quantity) : null,
    unit: "g",
    portion: portion?.quantity ?? null,
    portionName: portion?.portionName ?? "Porsjon",
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
  return foodSchema.parse({
    ...base,
    id: `off:${x.code}`,
    name:
      safeText(x.product_name_nb) ||
      safeText(x.product_name) ||
      `Produkt ${x.code}`,
    brand: safeText(x.brands),
    source: "Open Food Facts",
    sourceId: x.code,
    barcode: x.code,
    url: `https://world.openfoodfacts.org/product/${encodeURIComponent(x.code)}`,
    image: image.startsWith("https://images.openfoodfacts.org/") ? image : "",
    packageSize: safeText(x.quantity),
    kcal100: n.success ? offCalories(n.data) : null,
    unit: null,
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
