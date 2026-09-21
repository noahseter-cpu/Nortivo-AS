import { z } from "zod";
import { Capacitor } from "@capacitor/core";
import { foodSchema, type Food } from "./tracker-core";
import { cacheRead, cacheWrite } from "./tracker-store";
import { fromMatvare, foodMatches, rankFoods } from "./food-adapters";
import { foodMessages } from "./locales/food";

export type SearchOptions = {
  language?: "nb" | "en";
  market?: "no" | "world";
  barcode?: boolean;
};
export type SearchIssue = {
  source: "Matvaretabellen" | "Open Food Facts";
  message: string;
};
export type FoodSearchResult = {
  foods: Food[];
  issues: SearchIssue[];
  pending: boolean;
};
let bundledFoods: Promise<Food[]> | null = null;

async function searchBundled(query: string, market: "no" | "world") {
  bundledFoods ??= import("./data/matvare-library").then(
    ({ default: snapshot }) =>
      snapshot.foods
        .map((raw) =>
          fromMatvare({
            ...raw,
            sourceVersion: `Matvaretabellen ${snapshot.retrieved}`,
          }),
        )
        .filter((food): food is Food => food !== null),
  );
  return rankFoods(
    (await bundledFoods).filter((food) => foodMatches(food, query)),
    query,
    market,
  ).slice(0, 40);
}

export async function searchFood(
  provider: "mvt" | "off",
  query: string,
  signal: AbortSignal,
  barcode = false,
  options: SearchOptions = {},
): Promise<Food[]> {
  signal.throwIfAborted();
  if (
    (barcode && !/^\d{7,14}$/.test(query)) ||
    (!barcode && (query.trim().length < 2 || query.length > 100))
  )
    throw Error("Skriv minst to bokstaver eller en gyldig strekkode.");
  const market = options.market ?? "no";
  if (provider === "mvt") {
    const foods = await searchBundled(query, market);
    signal.throwIfAborted();
    return foods;
  }
  const params = new URLSearchParams({
    provider,
    [barcode ? "barcode" : "q"]: query,
    market,
    language: options.language ?? "nb",
  });
  const key = `v4:${params.toString()}`;
  const cached = (await cacheRead(key).catch(() => null)) as {
    at: number;
    foods: unknown[];
  } | null;
  const parsedCache = cached && z.array(foodSchema).safeParse(cached.foods);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  if (parsedCache?.success && (offline || Date.now() - cached!.at < 86400000))
    return parsedCache.data;
  if (offline)
    throw Error(
      "Du er frakoblet. Bruk lagrede matvarer, favoritter eller egne produkter.",
    );
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(20000)]);
  let response: Response;
  try {
    response = Capacitor.isNativePlatform()
      ? await (
          await import("./food-provider")
        ).GET(
          new Request(`https://localhost/api/foods?${params}`, {
            signal: requestSignal,
          }),
        )
      : await fetch(`/api/foods?${params}`, { signal: requestSignal });
    signal.throwIfAborted();
  } catch {
    signal.throwIfAborted();
    throw Error(
      requestSignal.aborted
        ? "Søket tok for lang tid. Prøv igjen."
        : "Ingen kontakt med matkilden. Prøv igjen, eller bruk en lagret matvare.",
    );
  }
  const data = z
    .object({
      error: z.string().optional(),
      messageKey: z.string().optional(),
      foods: z.array(z.unknown()).optional(),
    })
    .safeParse(await response.json().catch(() => null));
  if (!data.success) throw Error("Matkilden sendte et ukjent svar.");
  if (!response.ok)
    throw Error(
      data.data.messageKey ?? data.data.error ?? "Matkilden er utilgjengelig.",
    );
  const foods = z.array(foodSchema).safeParse(data.data.foods);
  if (!foods.success) throw Error("Matkilden sendte et ukjent svar.");
  // Provider-cache failures must not prevent using a successful response.
  await cacheWrite(key, { foods: foods.data, at: Date.now() }).catch(
    () => undefined,
  );
  signal.throwIfAborted();
  return foods.data;
}

export async function searchFoods(
  query: string,
  signal: AbortSignal,
  options: SearchOptions = {},
  onProgress?: (result: FoodSearchResult) => void,
): Promise<FoodSearchResult> {
  const providers = options.barcode
    ? (["off"] as const)
    : (["mvt", "off"] as const);
  const foods: Food[] = [];
  const issues: SearchIssue[] = [];
  let completed = 0;
  const result = (): FoodSearchResult => ({
    foods: rankFoods(foods, query, options.market),
    issues: [...issues],
    pending: completed < providers.length,
  });
  await Promise.all(
    providers.map(async (provider) => {
      try {
        foods.push(
          ...(await searchFood(
            provider,
            query.trim(),
            signal,
            options.barcode,
            options,
          )),
        );
      } catch (error) {
        if (!signal.aborted)
          issues.push({
            source: provider === "mvt" ? "Matvaretabellen" : "Open Food Facts",
            message:
              error instanceof Error &&
              Object.hasOwn(foodMessages, error.message)
                ? error.message
                : "Kunne ikke hente matvarer.",
          });
      } finally {
        completed++;
        if (!signal.aborted) onProgress?.(result());
      }
    }),
  );
  signal.throwIfAborted();
  return result();
}
