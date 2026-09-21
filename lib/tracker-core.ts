import { z } from "zod";
import { profileSchema } from "./profile";
import { getLanguage, getLocale, t } from "./i18n";
export const id = () => crypto.randomUUID();
export const today = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  s >= "1900-01-01" &&
  s <= "2200-12-31" &&
  Number.isFinite(new Date(s + "T12:00:00Z").getTime()) &&
  new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;
export const dateSchema = z.string().refine(validDate, "Ugyldig dato");
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const key = z.string().min(1).max(160),
  text = z.string().max(1000),
  nonnegative = z.number().finite().nonnegative().max(1e10),
  ore = z.number().int().nonnegative().max(1e12);
export const categorySchema = z.object({
  id: key,
  name: z.string().trim().min(1).max(70),
  archived: z.boolean(),
});
export const transactionSchema = z.object({
  id: key,
  type: z.enum(["expense", "income", "refund"]),
  amount: ore.positive(),
  categoryId: key,
  date: dateSchema,
  title: text,
  note: text,
});
export const foodSchema = z.object({
  id: key,
  name: z.string().trim().min(1).max(250),
  brand: text.default(""),
  source: z.enum([
    "Matvaretabellen",
    "Open Food Facts",
    "Egen registrering",
    "Lagret måltid",
  ]),
  sourceId: text.default(""),
  url: text.default(""),
  image: text.default(""),
  barcode: z.string().max(40).default(""),
  kcal100: nonnegative.nullable(),
  unit: z.enum(["g", "ml", "portion"]).nullable(),
  portion: nonnegative.positive().nullable().default(null),
  portionName: text.default("Porsjon"),
  packageSize: text.default(""),
  favorite: z.boolean().default(false),
  confirmed: z.boolean().default(false),
  names: z.object({ nb: text.optional(), en: text.optional() }).optional(),
  portionNames: z
    .object({ nb: text.optional(), en: text.optional() })
    .optional(),
  nutrients100: z
    .object({
      protein: nonnegative.nullable(),
      carbohydrate: nonnegative.nullable(),
      fat: nonnegative.nullable(),
      fiber: nonnegative.nullable(),
      sugar: nonnegative.nullable(),
      salt: nonnegative.nullable(),
    })
    .optional(),
  markets: z.array(z.string().max(100)).max(500).optional(),
  sourceVersion: text.optional(),
  originalEnergy: z
    .object({
      value: nonnegative,
      unit: z.enum(["kcal", "kJ"]),
      basis: z.enum(["100g", "100ml", "100-unknown"]),
    })
    .optional(),
  searchKeywords: z.array(z.string().max(250)).max(500).optional(),
});
export const logSchema = z.object({
  id: key,
  date: dateSchema,
  group: z.enum(["Frokost", "Lunsj", "Middag", "Mellommåltid", "Annet"]),
  food: foodSchema,
  amount: nonnegative.positive(),
  kcal: nonnegative,
  note: text.default(""),
});
const activitySchema = z.object({
  date: dateSchema,
  steps: z.number().int().min(0).max(500000).nullable(),
  burned: nonnegative.nullable(),
  note: text,
});
const goalSchema = z.object({
  id: key,
  date: dateSchema,
  steps: z.number().int().min(1).max(500000).nullable(),
  calories: nonnegative.positive().nullable(),
});
const budgetSchema = z.object({
  month: monthSchema,
  total: ore.nullable(),
  categories: z.record(ore),
});
const modeSchema = z.object({
  date: dateSchema,
  mode: z.enum(["items", "manual"]),
  total: nonnegative.nullable(),
});
const mealSchema = z.object({
  id: key,
  name: z.string().min(1).max(150),
  servings: nonnegative.positive(),
  ingredients: z
    .array(z.object({ food: foodSchema, amount: nonnegative.positive() }))
    .min(1)
    .max(100),
});
export const stateSchema = z.object({
  version: z.literal(4),
  profile: profileSchema.nullable(),
  profilePromptSeen: z.boolean(),
  revision: z.number().int().nonnegative(),
  categories: z.array(categorySchema).max(500),
  transactions: z.array(transactionSchema).max(100000),
  budgets: z.array(budgetSchema).max(4000),
  activity: z.array(activitySchema).max(100000),
  goals: z.array(goalSchema).max(10000),
  foods: z.array(foodSchema).max(20000),
  logs: z.array(logSchema).max(100000),
  meals: z.array(mealSchema).max(5000),
  modes: z.array(modeSchema).max(100000),
  settings: z.object({
    language: z.enum(["nb", "en"]).nullable(),
    languageSource: z
      .enum(["manual", "legacy", "country", "fallback"])
      .nullable(),
    foodMarket: z.enum(["no", "world"]).default("no"),
    theme: z.enum(["system", "light", "dark"]),
    name: z.string().max(60),
    opening: z
      .object({
        amount: z.number().int().min(-1e12).max(1e12),
        date: dateSchema,
      })
      .nullable(),
    warning: z.number().min(1).max(99),
    danger: z.number().min(100).max(200),
    setup: z.boolean(),
  }),
});
export type State = z.infer<typeof stateSchema>;
export type Food = z.infer<typeof foodSchema>;
export type FoodLog = z.infer<typeof logSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Meal = z.infer<typeof mealSchema>;
export function emptyState(): State {
  return {
    version: 4,
    profile: null,
    profilePromptSeen: false,
    revision: 0,
    categories: [
      "Mat",
      "Transport",
      "Shopping",
      "Abonnementer",
      "Underholdning",
      "Annet",
    ].map((name, i) => ({ id: `cat-${i}`, name, archived: false })),
    transactions: [],
    budgets: [],
    activity: [],
    goals: [],
    foods: [],
    logs: [],
    meals: [],
    modes: [],
    settings: {
      language: null,
      languageSource: null,
      foodMarket: "no",
      theme: "system",
      name: "",
      opening: null,
      warning: 80,
      danger: 100,
      setup: false,
    },
  };
}
export function amountOre(raw: string, signed = false) {
  const normal = raw.trim().replace(/[\u00a0\u202f]/g, " ");
  // A space is allowed only as a complete group of three, never "12 34" => 1234.
  if (
    normal.includes(" ") &&
    !/^-?\d{1,3}(?: \d{3})+(?:[,.]\d{1,2})?$/.test(normal)
  )
    throw Error(t("Skriv et gyldig beløp, for eksempel 125,50."));
  const s = normal.replace(/ /g, "");
  if (!(signed ? /^-?\d+(?:[,.]\d{1,2})?$/ : /^\d+(?:[,.]\d{1,2})?$/).test(s))
    throw Error(t("Skriv et gyldig beløp, for eksempel 125,50."));
  const negative = s.startsWith("-");
  const [a, b = ""] = s.replace("-", "").split(/[,.]/);
  const n = (Number(a) * 100 + Number(b.padEnd(2, "0"))) * (negative ? -1 : 1);
  if (!Number.isSafeInteger(n) || Math.abs(n) > 1e12)
    throw Error(t("Beløpet er for stort."));
  return n;
}
export function decimal(raw: string, allowZero = true) {
  if (!/^\d+(?:[,.]\d+)?$/.test(raw.trim()))
    throw Error(t("Skriv et gyldig tall."));
  const foreignSeparator = getLanguage() === "nb" ? "." : ",";
  const parts = raw.trim().split(foreignSeparator);
  if (
    parts.length === 2 &&
    /^[1-9]\d{0,2}$/.test(parts[0]) &&
    parts[1].length === 3
  )
    throw Error(
      t(
        "Tallet er tvetydig. Bruk desimaltegnet for valgt språk, og ingen tusenskilletegn.",
      ),
    );
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n) || n > 1e10 || n < 0 || (!allowZero && n === 0))
    throw Error(t("Skriv et gyldig positivt tall."));
  return n;
}
export const money = (v: number) =>
  new Intl.NumberFormat(getLocale(), {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: v % 100 === 0 ? 0 : 2,
  }).format(v / 100);
export const num = (v: number) =>
  new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 }).format(v);
/** Editable numeric values retain precision and never include grouping separators. */
export const inputNumber = (v: number | null | undefined) =>
  v == null
    ? ""
    : new Intl.NumberFormat(getLocale(), {
        useGrouping: false,
        maximumSignificantDigits: 21,
      }).format(v);
export const dateLabel = (
  d: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
) =>
  new Intl.DateTimeFormat(getLocale(), { ...options, timeZone: "UTC" }).format(
    new Date(d + "T12:00:00Z"),
  );
export const monthLabel = (m: string) =>
  dateLabel(m + "-01", { month: "long", year: "numeric" });
export function shiftDate(d: string, n: number) {
  const t = new Date(d + "T12:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
export function shiftMonth(m: string, n: number) {
  const t = new Date(m + "-01T12:00:00Z");
  t.setUTCMonth(t.getUTCMonth() + n);
  return t.toISOString().slice(0, 7);
}
export function weekDates(d: string) {
  const day = new Date(d + "T12:00:00Z").getUTCDay();
  return Array.from({ length: 7 }, (_, i) => shiftDate(d, i - ((day + 6) % 7)));
}
export function monthDates(m: string) {
  const end = new Date(Number(m.slice(0, 4)), Number(m.slice(5)), 0).getDate();
  return Array.from(
    { length: end },
    (_, i) => `${m}-${String(i + 1).padStart(2, "0")}`,
  );
}
export function netSpent(t: Transaction[]) {
  return t.reduce(
    (s, x) =>
      s +
      (x.type === "expense" ? x.amount : x.type === "refund" ? -x.amount : 0),
    0,
  );
}
export function finances(s: State, m: string) {
  const tx = s.transactions.filter((x) => x.date.startsWith(m));
  const spent = netSpent(tx);
  const income = tx
    .filter((x) => x.type === "income")
    .reduce((a, x) => a + x.amount, 0);
  const b = s.budgets.find((x) => x.month === m);
  return {
    tx,
    spent,
    income,
    budget: b,
    remaining: b?.total == null ? null : b.total - spent,
  };
}
export function balance(s: State, asOf = today()) {
  const opening = s.settings.opening;
  const eligible = s.transactions.filter(
    (x) => x.date <= asOf && (!opening || x.date >= opening.date),
  );
  if (opening && asOf < opening.date) return null;
  if (!opening && !eligible.length) return null;
  return (
    (opening?.amount ?? 0) +
    eligible.reduce(
      (a, x) => a + (x.type === "expense" ? -x.amount : x.amount),
      0,
    )
  );
}
export function allowance(
  remaining: number | null,
  month: string,
  date = today(),
) {
  if (remaining === null || month !== date.slice(0, 7) || remaining < 0)
    return null;
  return Math.floor(
    remaining / (monthDates(month).length - Number(date.slice(8)) + 1),
  );
}
export function kcal(food: Food, amount: number) {
  if (
    food.kcal100 === null ||
    !["g", "ml", "portion"].includes(food.unit ?? "") ||
    !Number.isFinite(food.kcal100) ||
    food.kcal100 < 0 ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1e10
  )
    throw Error(t("Bekreft kalorier og måleenhet før du logger maten."));
  const result = Math.round(food.kcal100 * amount) / 100;
  if (!Number.isFinite(result) || result > 1e10)
    throw Error(t("Kalorimengden er for stor. Kontroller mengden."));
  return result;
}
export function dailyCalories(s: State, d: string) {
  const mode = s.modes.find((x) => x.date === d);
  if (mode?.mode === "manual") return mode.total;
  const logs = s.logs.filter((x) => x.date === d);
  return logs.length
    ? Math.round(logs.reduce((a, x) => a + x.kcal, 0) * 100) / 100
    : null;
}
export const goalAt = (s: State, d: string) =>
  [...s.goals]
    .filter((x) => x.date <= d)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
export function stepStats(s: State, dates: string[]) {
  const a = s.activity.filter(
    (x) => dates.includes(x.date) && x.steps !== null,
  );
  const total = a.reduce((sum, x) => sum + (x.steps ?? 0), 0);
  return {
    total,
    count: a.length,
    average: a.length ? total / a.length : null,
  };
}
export function put<T>(
  arr: T[],
  value: T,
  key: "id" | "date" | "month" = "id",
) {
  const k = (x: T) => (x as Record<string, unknown>)[key];
  const i = arr.findIndex((x) => k(x) === k(value));
  if (i < 0) arr.push(value);
  else arr[i] = value;
}
export function validateState(raw: unknown): State {
  // v1 data is migrated in memory and committed with the next successful write.
  if (
    raw &&
    typeof raw === "object" &&
    (raw as { version?: unknown }).version === 1
  )
    raw = { ...raw, version: 2, profile: null, profilePromptSeen: true };
  if (
    raw &&
    typeof raw === "object" &&
    (raw as { version?: unknown }).version === 2
  ) {
    const old = raw as { settings?: Record<string, unknown> };
    raw = {
      ...old,
      version: 3,
      settings: { ...old.settings, theme: "system" },
    };
  }
  if (
    raw &&
    typeof raw === "object" &&
    (raw as { version?: unknown }).version === 3
  ) {
    const old = raw as { settings?: Record<string, unknown> };
    // All released schemas were Norwegian; preserve that experience on upgrade.
    raw = {
      ...old,
      version: 4,
      settings: {
        ...old.settings,
        language: "nb",
        languageSource: "legacy",
        foodMarket: "no",
      },
    };
  }
  const s = stateSchema.parse(raw);
  for (const [rows, keyName] of [
    [s.categories, "id"],
    [s.transactions, "id"],
    [s.foods, "id"],
    [s.logs, "id"],
    [s.meals, "id"],
    [s.goals, "id"],
    [s.budgets, "month"],
    [s.activity, "date"],
    [s.modes, "date"],
  ] as [unknown[], string][]) {
    const keys = rows.map((r) => (r as Record<string, unknown>)[keyName]);
    if (new Set(keys).size !== keys.length)
      throw Error(t("Filen inneholder dupliserte ID-er eller datoer."));
  }
  if (new Set(s.goals.map((x) => x.date)).size !== s.goals.length)
    throw Error(t("Flere mål for samme dato."));
  const cats = new Set(s.categories.map((x) => x.id));
  if (
    s.transactions.some((x) => !cats.has(x.categoryId)) ||
    s.budgets.some((x) => Object.keys(x.categories).some((k) => !cats.has(k)))
  )
    throw Error(t("En kategori mangler i sikkerhetskopien."));
  // Each value is integer øre, but many individually valid amounts can exceed
  // IEEE-754's exact integer range. Bound every subset, balance and budget result.
  let largestBase = Math.abs(s.settings.opening?.amount ?? 0);
  for (const budget of s.budgets) {
    largestBase = Math.max(largestBase, budget.total ?? 0);
    for (const limit of Object.values(budget.categories))
      largestBase = Math.max(largestBase, limit);
  }
  const absoluteMoney = s.transactions.reduce(
    (sum, transaction) => sum + BigInt(transaction.amount),
    BigInt(largestBase),
  );
  if (absoluteMoney > BigInt(Number.MAX_SAFE_INTEGER))
    throw Error(
      t(
        "De samlede beløpene er for store til å beregnes nøyaktig. Kontroller beløpene i registreringene eller sikkerhetskopien.",
      ),
    );
  for (const log of s.logs) {
    if (Math.abs(kcal(log.food, log.amount) - log.kcal) > 0.011)
      throw Error(t("Kaloritotalen stemmer ikke med matregistreringen."));
  }
  for (const mode of s.modes) {
    if (mode.mode === "manual" && mode.total === null)
      throw Error(t("En manuell kaloritotal mangler."));
  }
  for (const meal of s.meals)
    for (const item of meal.ingredients) kcal(item.food, item.amount);
  return s;
}
export function mergeStates(current: State, incoming: State) {
  const s = structuredClone(current);
  for (const name of [
    "categories",
    "transactions",
    "foods",
    "logs",
    "meals",
    "goals",
    "budgets",
    "activity",
    "modes",
  ] as const) {
    const k =
      name === "budgets"
        ? "month"
        : name === "activity" || name === "modes" || name === "goals"
          ? "date"
          : "id";
    const existing = new Set(
      s[name].map((x) => (x as Record<string, unknown>)[k]),
    );
    for (const row of incoming[name])
      if (!existing.has((row as Record<string, unknown>)[k]))
        (s[name] as unknown[]).push(structuredClone(row));
  }
  return validateState(s);
}
export function csvTransactions(s: State) {
  const escape = (v: string) => '"' + v.replace(/"/g, '""') + '"';
  return (
    "\ufeff" +
    [
      [
        "ID",
        t("Dato"),
        t("Type"),
        t("Beløp NOK"),
        t("Kategori"),
        t("Tittel"),
        t("Notat"),
      ],
      ...s.transactions.map((x) => [
        x.id,
        x.date,
        t({ expense: "Utgift", income: "Inntekt", refund: "Refusjon" }[x.type]),
        (x.amount / 100)
          .toFixed(2)
          .replace(".", getLanguage() === "nb" ? "," : "."),
        categoryLabel(s.categories.find((c) => c.id === x.categoryId)),
        x.title,
        x.note,
      ]),
    ]
      .map((r) =>
        r.map((x) => escape(/^[=+@\-]/.test(x) ? "'" + x : x)).join(";"),
      )
      .join("\r\n")
  );
}

const originalCategories = [
  "Mat",
  "Transport",
  "Shopping",
  "Abonnementer",
  "Underholdning",
  "Annet",
];
/** Translate only untouched built-in categories; custom and renamed names are data. */
export function categoryLabel(category?: { id: string; name: string }) {
  if (!category) return "";
  const original = originalCategories[Number(category.id.replace(/^cat-/, ""))];
  return /^cat-[0-5]$/.test(category.id) && category.name === original
    ? t(original)
    : category.name;
}
