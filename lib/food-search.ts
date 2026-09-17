import { z } from "zod";
import { Capacitor } from "@capacitor/core";
import { foodSchema, type Food } from "./tracker-core";
import { cacheRead, cacheWrite } from "./tracker-store";
export async function searchFood(
  provider: "mvt" | "off",
  query: string,
  signal: AbortSignal,
  barcode = false,
) {
  const params = new URLSearchParams({
    provider,
    [barcode ? "barcode" : "q"]: query,
  });
  const bundled = provider === "mvt" && Capacitor.isNativePlatform();
  const key = `v2:${params.toString()}`;
  const cached = (await cacheRead(key)) as { at: number; foods: Food[] } | null;
  if (!bundled && cached && (!navigator.onLine || Date.now() - cached.at < 86400000))
    return cached.foods.map((x) => foodSchema.parse(x));
  if (!navigator.onLine && !bundled)
    throw Error(
      "Du er frakoblet. Bruk lagrede matvarer, favoritter eller egne produkter.",
    );
  const timeout = AbortSignal.timeout(20000);
  let r: Response;
  try {
    r = Capacitor.isNativePlatform()
      ? await (
          await import("./food-provider")
        ).GET(new Request(`https://localhost/api/foods?${params}`))
      : await fetch(`/api/foods?${params}`, {
          signal: AbortSignal.any([signal, timeout]),
        });
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  } catch (e) {
    if (signal.aborted) throw e;
    throw Error(
      "Ingen kontakt med matkilden. Prøv igjen, eller bruk en lagret matvare.",
    );
  }
  const data = z
    .object({
      error: z.string().optional(),
      foods: z.array(z.unknown()).optional(),
    })
    .parse(await r.json());
  if (!r.ok) throw Error(data.error ?? "Matkilden er utilgjengelig.");
  if (!Array.isArray(data.foods))
    throw Error("Matkilden sendte et ukjent svar.");
  const foods = data.foods.map((x: unknown) => foodSchema.parse(x));
  await cacheWrite(key, { foods, at: Date.now() });
  return foods as Food[];
}
