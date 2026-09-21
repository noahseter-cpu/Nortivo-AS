import { test, expect } from "@playwright/test";
import { indexedDB, IDBObjectStore } from "fake-indexeddb";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  emptyState,
  validateState,
  amountOre,
  decimal,
  inputNumber,
  money,
  num,
  dateLabel,
  categoryLabel,
  finances,
  foodSchema,
  kcal,
  mergeStates,
} from "../lib/tracker-core";
import { readState, updateState } from "../lib/tracker-store";
import {
  initializeLanguage,
  syncLanguage,
  setLanguage,
  languageForCountry,
  getLanguage,
} from "../lib/language";
import { messages, translate, errorMessage } from "../lib/i18n";
import { GET } from "../app/api/locale/route";

test.beforeEach(async () => {
  Object.defineProperty(globalThis, "indexedDB", {
    value: indexedDB,
    configurable: true,
  });
  await updateState((s) => Object.assign(s, emptyState()));
  const state = emptyState();
  state.settings.language = "en";
  syncLanguage(state);
});

test("country policy ignores system language and never infers Norway from language alone", async () => {
  expect(languageForCountry("NO")).toBe("nb");
  for (const value of ["SE", "DK", "US", "GB", "nb", "nb-NO", null, "", "XX"])
    expect(languageForCountry(value)).toBe("en");
  Object.defineProperty(globalThis, "navigator", {
    value: { language: "en-US" },
    configurable: true,
  });
  const norway = await initializeLanguage(await readState(), async () => "NO");
  expect(norway.settings.language).toBe("nb");
  await updateState((s) => Object.assign(s, emptyState()));
  Object.defineProperty(globalThis, "navigator", {
    value: { language: "nb-NO" },
    configurable: true,
  });
  expect(
    (await initializeLanguage(await readState(), async () => "SE")).settings
      .language,
  ).toBe("en");
  await updateState((s) => Object.assign(s, emptyState()));
  expect(
    (await initializeLanguage(await readState(), async () => null)).settings,
  ).toMatchObject({ language: "en", languageSource: "fallback" });
});

test("manual choice persists across restart, country changes and a delayed first lookup", async () => {
  let release!: (country: string) => void;
  const lookup = new Promise<string>((resolve) => {
    release = resolve;
  });
  const pending = initializeLanguage(await readState(), () => lookup);
  await setLanguage("en");
  release("NO");
  expect((await pending).settings).toMatchObject({
    language: "en",
    languageSource: "manual",
  });
  await initializeLanguage(await readState(), async () => "NO");
  expect(getLanguage()).toBe("en");
  await setLanguage("nb");
  await initializeLanguage(await readState(), async () => "US");
  expect(getLanguage()).toBe("nb");
});

test("legacy v1/2/3 upgrade and backup preserve every historical number and name", () => {
  const source = emptyState();
  source.transactions.push({
    id: "transaction",
    amount: 12000,
    date: "2026-09-01",
    type: "expense",
    categoryId: "cat-0",
    title: "Mine groceries",
    note: "Keep my notes",
  });
  source.activity.push({
    date: "2026-09-01",
    steps: 0,
    burned: null,
    note: "Keep zero",
  });
  source.budgets.push({
    month: "2026-09",
    total: 230000,
    categories: { "cat-0": 230000 },
  });
  source.foods.push(
    foodSchema.parse({
      id: "food",
      source: "Egen registrering",
      name: "My apple",
      unit: "g",
      kcal100: 250,
    }),
  );
  source.logs.push({
    id: "log",
    date: "2026-09-01",
    group: "Annet",
    amount: 150,
    kcal: 375,
    food: source.foods[0],
    note: "My food note",
  });
  for (const version of [1, 2, 3]) {
    const migrated = validateState({ ...source, version });
    expect(migrated.version).toBe(4);
    expect(migrated.settings.language).toBe("nb");
    for (const key of [
      "transactions",
      "activity",
      "budgets",
      "foods",
      "logs",
    ] as const)
      expect(migrated[key]).toEqual(source[key]);
    expect(validateState(JSON.parse(JSON.stringify(migrated)))).toEqual(
      migrated,
    );
  }
  const incoming = emptyState();
  incoming.settings.language = "en";
  const old = validateState({ ...source, version: 3 });
  expect(mergeStates(old, incoming).settings.language).toBe("nb");
  expect(() =>
    validateState({
      ...source,
      settings: { ...source.settings, language: "sv" },
    }),
  ).toThrow();
  expect(() =>
    validateState({ ...source, logs: [{ ...source.logs[0], kcal: 300 }] }),
  ).toThrow();
});

test("a failed language write does not change the visible or saved preference", async () => {
  await setLanguage("nb");
  const original = IDBObjectStore.prototype.put;
  try {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Quota reached", "QuotaExceededError");
    };
    await expect(setLanguage("en")).rejects.toThrow();
    expect(getLanguage()).toBe("nb");
    expect((await readState()).settings.language).toBe("nb");
  } finally {
    IDBObjectStore.prototype.put = original;
  }
});

test("switching language changes presentation while retaining NOK, quantities and date identity", async () => {
  const source = emptyState();
  source.categories[0].name = "My food";
  source.budgets.push({ month: "2026-09", total: 230000, categories: {} });
  for (const [i, amount] of [12000, 8000].entries())
    source.transactions.push({
      id: String(i),
      amount,
      date: "2026-09-01",
      type: "expense",
      categoryId: "cat-0",
      title: "Keep text",
      note: "",
    });
  await updateState((s) => Object.assign(s, source));
  await setLanguage("nb");
  expect(num(1.5)).toBe("1,5");
  expect(dateLabel("2026-09-21")).toContain("september");
  expect(categoryLabel({ id: "cat-0", name: "Mat" })).toBe("Mat");
  await setLanguage("en");
  expect(num(1.5)).toBe("1.5");
  expect(dateLabel("2026-09-21")).toContain("September");
  expect(money(230000)).toContain("NOK");
  expect(categoryLabel({ id: "cat-0", name: "Mat" })).toBe("Food");
  expect(categoryLabel({ id: "custom", name: "Mat" })).toBe("Mat");
  expect(categoryLabel({ id: "cat-0", name: "My food" })).toBe("My food");
  const saved = await readState();
  expect(saved.transactions).toEqual(source.transactions);
  expect(finances(saved, "2026-09")).toMatchObject({
    spent: 20000,
    remaining: 210000,
  });
});

test("large legacy histories migrate and round-trip without losing entries or applying new provider values", () => {
  const source = emptyState();
  source.settings.name = "Existing name";
  source.transactions = Array.from({ length: 12000 }, (_, i) => ({
    id: `tx-${i}`,
    amount: i + 1,
    date: "2026-09-01",
    type: "expense" as const,
    categoryId: "cat-0",
    title: `Title ${i}`,
    note: "Untranslated personal text",
  }));
  const snapshot = foodSchema.parse({
    id: "food",
    name: "Private snapshot",
    source: "Egen registrering",
    unit: "g",
    kcal100: 250,
  });
  source.logs = Array.from({ length: 12000 }, (_, i) => ({
    id: `log-${i}`,
    date: "2026-09-01",
    group: "Annet" as const,
    food: snapshot,
    amount: 150,
    kcal: 375,
    note: "",
  }));
  const migrated = validateState({ ...source, version: 3 });
  expect(migrated.transactions).toEqual(source.transactions);
  expect(migrated.logs).toEqual(source.logs);
  expect(migrated.settings.name).toBe("Existing name");
  expect(validateState(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);
  expect(emptyState().settings.name).toBe("");
});

test("money validation protects exact øre at the total boundary and aborts unsafe commits", async () => {
  const state = emptyState();
  const transaction = (id: string, amount: number) => ({
    id,
    amount,
    type: "expense" as const,
    date: "2026-09-01",
    categoryId: "cat-0",
    title: "Synthetic boundary fixture",
    note: "",
  });
  state.transactions = Array.from({ length: 9007 }, (_, i) =>
    transaction(String(i), 1e12),
  );
  state.transactions.push(
    transaction("remainder", Number.MAX_SAFE_INTEGER % 1e12),
  );
  expect(finances(validateState(state), "2026-09").spent).toBe(
    Number.MAX_SAFE_INTEGER,
  );
  await updateState((s) => Object.assign(s, state));
  await expect(
    updateState((s) => {
      s.transactions.push(transaction("one-more", 1));
    }),
  ).rejects.toThrow();
  expect((await readState()).transactions).toHaveLength(9008);
  expect(() =>
    validateState({
      ...state,
      settings: {
        ...state.settings,
        opening: { amount: -1, date: "2026-09-01" },
      },
    }),
  ).toThrow();
  // Refunds can make remaining budget positive; the cap must stay inside the bound too.
  const refunds = state.transactions.map((row) => ({
    ...row,
    type: "refund" as const,
  }));
  expect(() =>
    validateState({
      ...state,
      transactions: refunds,
      budgets: [{ month: "2026-09", total: 1, categories: {} }],
    }),
  ).toThrow();
});

test("numbers reject malformed grouping and ambiguous foreign thousands separators", async () => {
  for (const value of [
    "12 34",
    "1,234",
    "1.234",
    "1,234.50",
    "1.234,50",
    "1\t234",
    "1e3",
    "-1",
    "999999999999999",
  ])
    expect(() => amountOre(value)).toThrow();
  expect(amountOre("2 300,50")).toBe(230050);
  expect(amountOre("2\u202f300.50")).toBe(230050);
  for (const lang of ["nb", "en"] as const) {
    await setLanguage(lang);
    expect(amountOre("125,50")).toBe(12550);
    expect(amountOre("125.50")).toBe(12550);
    expect(decimal("1.5")).toBe(1.5);
    expect(decimal("1,5")).toBe(1.5);
    expect(() => decimal(lang === "nb" ? "1.234" : "1,234")).toThrow();
    expect(decimal(lang === "nb" ? "1,234" : "1.234")).toBe(1.234);
    expect(decimal(inputNumber(1.234))).toBe(1.234);
    expect(decimal(inputNumber(0.0000001))).toBe(0.0000001);
  }
});

test("synthetic nutrition covers mass, volume, decimals, true zero and upper bounds", () => {
  const food = foodSchema.parse({
    id: "synthetic",
    name: "Synthetic test data",
    source: "Egen registrering",
    kcal100: 250,
    unit: "g",
  });
  expect(kcal(food, 150)).toBe(375);
  expect(kcal(food, 1.5)).toBe(3.75);
  expect(kcal({ ...food, kcal100: 40, unit: "ml" }, 500)).toBe(200);
  expect(kcal({ ...food, kcal100: 0 }, 150)).toBe(0);
  for (const amount of [-1, 0, Infinity, 1e11])
    expect(() => kcal(food, amount)).toThrow();
  expect(() => kcal({ ...food, unit: null }, 150)).toThrow();
  expect(() => kcal({ ...food, unit: "kg" as "g" }, 150)).toThrow();
  expect(() => kcal({ ...food, kcal100: null }, 150)).toThrow();
});

test("web country route trusts only edge metadata and is never publicly cached", async () => {
  const spoofed = new Request("https://arc.example/api/locale", {
    headers: { "cf-ipcountry": "NO", "accept-language": "nb-NO" },
  });
  expect(await GET(spoofed).json()).toMatchObject({ country: null });
  Object.defineProperty(spoofed, "cf", { value: { country: "NO" } });
  const response = GET(spoofed);
  expect(await response.json()).toEqual({
    country: "NO",
    source: "network-country",
  });
  expect(response.headers.get("cache-control")).toContain("no-store");
});

test("all literal translation calls have English entries and interpolation tokens match", () => {
  const missing: string[] = [];
  const directories = ["components", "lib"];
  for (const directory of directories) {
    for (const file of readdirSync(directory).filter((file) =>
      /\.(ts|tsx)$/.test(file),
    )) {
      const path = join(directory, file);
      const source = ts.createSourceFile(
        path,
        readFileSync(path, "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          ["t", "tr"].includes(node.expression.text)
        ) {
          const argument = node.arguments[0];
          if (
            argument &&
            ts.isStringLiteralLike(argument) &&
            !(argument.text in messages)
          )
            missing.push(`${path}: ${argument.text}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  }
  expect(missing).toEqual([]);
  const tokens = (value: string) =>
    [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const [source, english] of Object.entries(messages)) {
    expect(english.trim(), source).not.toBe("");
    expect(tokens(english), source).toEqual(tokens(source));
  }
  expect(translate("Mat", "en")).toBe("Food");
  expect(errorMessage(new Error("AbortError: secret stack"))).toBe(
    "Something went wrong. Please try again.",
  );
});
