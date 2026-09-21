import { z } from "zod";
import matvareSnapshot from "./data/matvaretabellen.json" with { type: "json" };
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import {
  fromMatvare,
  fromOFF,
  foodMatches,
  rankFoods,
} from "@/lib/food-adapters";
import type { Food } from "@/lib/tracker-core";
import { foodMessages } from "./locales/food";
const memo = new Map<string, { at: number; foods: Food[] }>();
let library: Food[] | null = null;
let libraryTime = 0;
let libraryRequest: Promise<Food[]> | null = null;
const rate: Record<string, number[]> = { search: [], barcode: [] };
const fields =
  "code,product_name,product_name_nb,product_name_en,brands,nutriments,nutrition_data_per,quantity,product_quantity_unit,serving_size,image_front_small_url,countries_tags";
async function untilAborted<T>(
  pending: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  signal.throwIfAborted();
  let abort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    abort = () =>
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([pending, aborted]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
async function upstream(url: string, off = false, signal?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const requestSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;
  try {
    const staging = process.env.OFF_STAGING === "1";
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent":
        "ArcByNortivo/1.0 (+https://github.com/noahseter-cpu/Nortivo-AS; personal tracker)",
    };
    if (off && staging) headers.Authorization = "Basic b2ZmOm9mZg==";
    const r = Capacitor.isNativePlatform()
      ? await (async () => {
          const response = await untilAborted(
            CapacitorHttp.get({
              url,
              headers,
              connectTimeout: 15000,
              readTimeout: 15000,
              responseType: "json",
              disableRedirects: true,
            }),
            requestSignal,
          );
          return new Response(JSON.stringify(response.data), {
            status: response.status,
            headers: { "Content-Type": "application/json" },
          });
        })()
      : await fetch(url, {
          headers,
          signal: requestSignal,
          redirect: "manual",
        });
    if (r.status === 404) return null;
    if (r.status === 429 || r.status === 503)
      throw Object.assign(
        Error(
          "Matkilden er opptatt eller har begrenset antall søk. Vent et minutt og prøv igjen.",
        ),
        { status: 429 },
      );
    if (!r.ok) throw Error("Matkilden svarte ikke. Prøv igjen senere.");
    return z.record(z.unknown()).parse(await r.json());
  } finally {
    clearTimeout(timer);
  }
}
async function getLibrary() {
  if (library && Date.now() - libraryTime < 86400000) return library;
  if (!libraryRequest)
    libraryRequest = (async () => {
      let data: { foods: unknown[] } = matvareSnapshot;
      let version = `Matvaretabellen ${matvareSnapshot.retrieved}`;
      if (!Capacitor.isNativePlatform()) {
        try {
          const [nb, en] = await Promise.all([
            upstream("https://www.matvaretabellen.no/api/nb/foods.json"),
            upstream("https://www.matvaretabellen.no/api/en/foods.json"),
          ]);
          if (!Array.isArray(nb?.foods) || !Array.isArray(en?.foods))
            throw Error("Invalid source response");
          const english = new Map(
            en.foods.map((f: Record<string, unknown>) => [f.foodId, f]),
          );
          data = {
            foods: nb.foods.map((f: Record<string, unknown>) => ({
              ...f,
              foodNameEn: english.get(f.foodId)?.foodName,
              portionsEn: english.get(f.foodId)?.portions,
              searchKeywords: [
                ...(Array.isArray(f.searchKeywords) ? f.searchKeywords : []),
                ...(Array.isArray(english.get(f.foodId)?.searchKeywords)
                  ? (english.get(f.foodId)!.searchKeywords as unknown[])
                  : []),
              ],
            })),
          };
          version = `Matvaretabellen ${new Date().toISOString().slice(0, 10)}`;
        } catch {
          // The source explicitly permits caching. Retain the dated, bilingual snapshot.
        }
      }
      if (!data || !Array.isArray(data.foods))
        throw Error("Uventet svar fra Matvaretabellen.");
      const foods = data.foods
        .map((raw) =>
          fromMatvare({ ...(raw as object), sourceVersion: version }),
        )
        .filter(Boolean) as Food[];
      if (!foods.length)
        throw Error("Matvaretabellen returnerte ingen lesbare matvarer.");
      library = foods;
      libraryTime = Date.now();
      return foods;
    })().finally(() => (libraryRequest = null));
  return libraryRequest;
}
export async function GET(request: Request) {
  const u = new URL(request.url);
  const provider = u.searchParams.get("provider");
  const q = (u.searchParams.get("q") ?? "").trim();
  const barcode = u.searchParams.get("barcode");
  const brand = u.searchParams.get("brand");
  const language = u.searchParams.get("language") === "en" ? "en" : "nb";
  const market = u.searchParams.get("market") === "world" ? "world" : "no";
  const fail = (messageKey: string, status: number, headers?: HeadersInit) =>
    Response.json(
      {
        messageKey,
        error:
          language === "en"
            ? (foodMessages[messageKey] ??
              foodMessages["Kunne ikke hente matvarer."])
            : messageKey,
      },
      { status, headers },
    );
  if (provider !== "mvt" && provider !== "off")
    return fail("Ukjent matkilde.", 400);
  if (
    (barcode && !/^\d{7,14}$/.test(barcode)) ||
    (!barcode && !brand && (q.length < 2 || q.length > 100))
  )
    return fail("Skriv minst to bokstaver eller en gyldig strekkode.", 400);
  const cacheKey = JSON.stringify([
    provider,
    q,
    barcode,
    brand,
    language,
    market,
  ]);
  const cached = memo.get(cacheKey);
  if (cached && Date.now() - cached.at < 3600000)
    return Response.json({ foods: cached.foods, cached: true });
  try {
    let foods: Food[] = [];
    if (provider === "mvt") {
      foods = rankFoods(
        (await getLibrary()).filter((f) => foodMatches(f, q)),
        q,
        market,
      ).slice(0, 40);
    } else {
      const kind = barcode ? "barcode" : "search";
      rate[kind] = rate[kind].filter((x) => Date.now() - x < 60000);
      if (rate[kind].length >= (barcode ? 12 : 8))
        return fail(
          "Søkegrensen er nådd. Vent et minutt før du prøver igjen.",
          429,
          { "Retry-After": "60" },
        );
      rate[kind].push(Date.now());
      const root =
        process.env.OFF_STAGING === "1"
          ? "https://world.openfoodfacts.net"
          : "https://world.openfoodfacts.org";
      let url: string;
      if (barcode)
        url = `${root}/api/v3.4/product/${encodeURIComponent(barcode)}.json?fields=${fields}`;
      else if (brand)
        url = `${root}/api/v2/search?brands_tags=${encodeURIComponent(brand.slice(0, 100))}&page_size=24&fields=${fields}`;
      else {
        const params = new URLSearchParams({
          search_terms: q,
          search_simple: "1",
          action: "process",
          json: "1",
          page_size: "24",
          fields,
          lc: language,
          cc: market === "no" ? "no" : "world",
          sort_by: "unique_scans_n",
        });
        url = `${root}/cgi/search.pl?${params}`;
      }
      const data = await upstream(url, true, request.signal);
      if (barcode) {
        const food = data?.product ? fromOFF(data.product) : null;
        foods = food ? [food] : [];
      } else {
        if (!data || !Array.isArray(data.products))
          throw Error("Uventet svar fra Open Food Facts.");
        foods = rankFoods(
          data.products.map(fromOFF).filter(Boolean) as Food[],
          q,
          market,
        );
      }
    }
    memo.set(cacheKey, { foods, at: Date.now() });
    if (memo.size > 100) memo.delete(memo.keys().next().value!);
    return Response.json(
      { foods },
      { headers: { "Cache-Control": "private, max-age=600" } },
    );
  } catch (e) {
    const status = (e as { status?: number }).status ?? 502;
    const message =
      e instanceof Error &&
      (e.name === "AbortError" || e.name === "TimeoutError")
        ? "Søket tok for lang tid. Prøv igjen."
        : e instanceof Error && foodMessages[e.message]
          ? e.message
          : "Kunne ikke hente matvarer.";
    return fail(message, status);
  }
}
