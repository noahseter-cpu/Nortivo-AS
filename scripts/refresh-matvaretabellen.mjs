// Public provider data only; never read or modify personal records.
import fs from "node:fs/promises";
const source = "https://www.matvaretabellen.no/api/nb/foods.json";
const englishSource = "https://www.matvaretabellen.no/api/en/foods.json";
const datasets = await Promise.all(
  [source, englishSource].map(async (url) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error(`Matvaretabellen: ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.foods) || data.foods.length < 1000)
      throw Error("Unexpected dataset; existing snapshot retained");
    return data.foods;
  }),
);
const english = new Map(datasets[1].map((food) => [food.foodId, food]));
const nutrientIds = new Set([
  "Protein",
  "Karbo",
  "Fett",
  "Fiber",
  "Mono+Di",
  "NaCl",
]);
const foods = datasets[0].map(
  ({
    foodId,
    foodName,
    uri,
    calories,
    portions,
    searchKeywords,
    constituents,
  }) => {
    const en = english.get(foodId);
    if (!en?.foodName)
      throw Error(
        `Missing official English name for ${foodId}; existing snapshot retained`,
      );
    return {
      foodId,
      foodName,
      foodNameEn: en.foodName,
      uri,
      calories,
      portions,
      portionsEn: en.portions,
      searchKeywords: [...(searchKeywords ?? []), ...(en.searchKeywords ?? [])],
      constituents: (constituents ?? []).filter((n) =>
        nutrientIds.has(n.nutrientId),
      ),
    };
  },
);
const file = new URL("../lib/data/matvaretabellen.json", import.meta.url);
const temp = new URL("../lib/data/matvaretabellen.json.tmp", import.meta.url);
await fs.writeFile(
  temp,
  JSON.stringify({
    source,
    englishSource,
    retrieved: new Date().toISOString().slice(0, 10),
    foods,
  }),
);
await fs.rename(temp, file);
console.log(
  `Updated ${foods.length} bilingual public foods with source nutrients. Rebuild the APK to distribute this snapshot.`,
);
