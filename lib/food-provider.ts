import { z } from "zod";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { fromMatvare, fromOFF } from "@/lib/food-adapters";
import type { Food } from "@/lib/tracker-core";
const memo = new Map<string, { at: number; foods: Food[] }>();
let library: Food[] | null = null;
let libraryTime = 0;
let libraryRequest: Promise<Food[]> | null = null;
const rate: Record<string, number[]> = { search: [], barcode: [] };
const fields =
  "code,product_name,product_name_nb,brands,nutriments,nutrition_data_per,quantity,product_quantity_unit,serving_size,image_front_small_url,countries_tags";
async function upstream(url: string, off = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const staging = process.env.OFF_STAGING === "1";
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent":
        "Nortivo/0.3.0 (+https://noah-hverdag-tracker.noahrare.chatgpt.site; personal tracker)",
    };
    if (off && staging) headers.Authorization = "Basic b2ZmOm9mZg==";
    const r = Capacitor.isNativePlatform()
      ? await (async () => {
          const response = await CapacitorHttp.get({
            url,
            headers,
            connectTimeout: 15000,
            readTimeout: 15000,
            responseType: "json",
            disableRedirects: true,
          });
          return new Response(JSON.stringify(response.data), {
            status: response.status,
            headers: { "Content-Type": "application/json" },
          });
        })()
      : await fetch(url, {
          headers,
          signal: controller.signal,
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
      const data = await upstream(
        "https://www.matvaretabellen.no/api/nb/foods.json",
      );
      if (!data || !Array.isArray(data.foods))
        throw Error("Uventet svar fra Matvaretabellen.");
      const foods = data.foods.map(fromMatvare).filter(Boolean) as Food[];
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
  if (provider !== "mvt" && provider !== "off")
    return Response.json({ error: "Ukjent matkilde." }, { status: 400 });
  if (
    (barcode && !/^\d{7,14}$/.test(barcode)) ||
    (!barcode && !brand && (q.length < 2 || q.length > 100))
  )
    return Response.json(
      { error: "Skriv minst to bokstaver eller en gyldig strekkode." },
      { status: 400 },
    );
  const cacheKey = JSON.stringify([provider, q, barcode, brand]);
  const cached = memo.get(cacheKey);
  if (cached && Date.now() - cached.at < 3600000)
    return Response.json({ foods: cached.foods, cached: true });
  try {
    let foods: Food[] = [];
    if (provider === "mvt") {
      const terms = q.toLocaleLowerCase("nb").split(/\s+/);
      foods = (await getLibrary())
        .filter((f) =>
          terms.every((t) => f.name.toLocaleLowerCase("nb").includes(t)),
        )
        .sort(
          (a, b) =>
            Number(
              b.name
                .toLocaleLowerCase("nb")
                .startsWith(q.toLocaleLowerCase("nb")),
            ) -
            Number(
              a.name
                .toLocaleLowerCase("nb")
                .startsWith(q.toLocaleLowerCase("nb")),
            ),
        )
        .slice(0, 40);
    } else {
      const kind = barcode ? "barcode" : "search";
      rate[kind] = rate[kind].filter((x) => Date.now() - x < 60000);
      if (rate[kind].length >= (barcode ? 12 : 8))
        return Response.json(
          { error: "Søkegrensen er nådd. Vent et minutt før du prøver igjen." },
          { status: 429, headers: { "Retry-After": "60" } },
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
          lc: "nb",
          cc: "no",
          sort_by: "unique_scans_n",
        });
        url = `${root}/cgi/search.pl?${params}`;
      }
      const data = await upstream(url, true);
      if (barcode) {
        const food = data?.product ? fromOFF(data.product) : null;
        foods = food ? [food] : [];
      } else {
        if (!data || !Array.isArray(data.products))
          throw Error("Uventet svar fra Open Food Facts.");
        foods = [...data.products]
          .sort(
            (a, b) =>
              Number(
                Array.isArray(b.countries_tags) &&
                  b.countries_tags.includes("en:norway"),
              ) -
              Number(
                Array.isArray(a.countries_tags) &&
                  a.countries_tags.includes("en:norway"),
              ),
          )
          .map(fromOFF)
          .filter(Boolean) as Food[];
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
    return Response.json(
      {
        error:
          e instanceof Error && e.name === "AbortError"
            ? "Søket tok for lang tid. Prøv igjen."
            : e instanceof Error
              ? e.message
              : "Kunne ikke hente matvarer.",
      },
      { status },
    );
  }
}
