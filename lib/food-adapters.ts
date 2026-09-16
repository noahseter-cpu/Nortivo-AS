import { z } from "zod";
import { foodSchema, type Food } from "./tracker-core";
const safeText = (v: unknown, max = 250) =>
  typeof v === "string" ? v.slice(0, max) : "";
const safeKcal = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1000 ? v : null;
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
    kcal100: n.success ? safeKcal(n.data["energy-kcal_100g"]) : null,
    unit: null,
  });
}
