import { test, expect } from "@playwright/test";
import {
  emptyState,
  amountOre,
  finances,
  netSpent,
  put,
  kcal,
  foodSchema,
  dailyCalories,
  balance,
  stepStats,
  goalAt,
  weekDates,
  monthDates,
  allowance,
  validateState,
  mergeStates,
  csvTransactions,
  shiftDate,
  validDate,
} from "../lib/tracker-core";
import { fromOFF, fromMatvare } from "../lib/food-adapters";
const tx = (
  amount: number,
  date = "2026-09-16",
  type: "expense" | "income" | "refund" = "expense",
  id = crypto.randomUUID(),
) => ({ id, amount, type, date, categoryId: "cat-0", title: "Test", note: "" });
const fixture = () =>
  foodSchema.parse({
    id: "fixture",
    name: "Fictional fixture",
    source: "Egen registrering",
    kcal100: 40,
    unit: "ml",
  });
test("exact øre and Norwegian comma", () => {
  expect(amountOre("125,50")).toBe(12550);
  expect(amountOre("2 300")).toBe(230000);
  expect(amountOre("0,29")).toBe(29);
  expect(() => amountOre("12,345")).toThrow();
  expect(() => amountOre("1e3")).toThrow();
  expect(() => amountOre("-2")).toThrow();
});
test("2300 − 125 − 90 = 2085; overall cap independent", () => {
  const s = emptyState();
  s.budgets.push({
    month: "2026-09",
    total: 230000,
    categories: { "cat-0": 230000 },
  });
  s.transactions.push(tx(12500), tx(9000));
  expect(finances(s, "2026-09").remaining).toBe(208500);
  expect(finances(s, "2026-09").spent).toBe(21500);
});
test("overspend retains signed amount", () => {
  const s = emptyState();
  s.budgets.push({ month: "2026-09", total: 230000, categories: {} });
  s.transactions.push(tx(235000));
  expect(finances(s, "2026-09").remaining).toBe(-5000);
});
test("edits dates categories deletes and refunds derive totals", () => {
  const s = emptyState();
  s.transactions.push(tx(12500), tx(9000));
  s.transactions[0].date = "2026-08-31";
  expect(finances(s, "2026-09").spent).toBe(9000);
  s.transactions[1].categoryId = "cat-1";
  expect(netSpent(s.transactions.filter((x) => x.categoryId === "cat-0"))).toBe(
    12500,
  );
  s.transactions.push(tx(5000, "2026-09-18", "refund"));
  expect(finances(s, "2026-09").spent).toBe(4000);
  expect(finances(s, "2026-09").income).toBe(0);
  s.transactions = s.transactions.filter((x) => x.type !== "expense");
  expect(finances(s, "2026-09").spent).toBe(-5000);
});
test("opening balance excludes already-included dates", () => {
  const s = emptyState();
  s.settings.opening = { date: "2026-09-01", amount: 100000 };
  s.transactions.push(
    tx(8000, "2026-08-31"),
    tx(5000, "2026-09-01"),
    tx(2000, "2026-09-03", "refund"),
  );
  expect(balance(s, "2026-09-16")).toBe(97000);
  expect(balance(s, "2026-08-31")).toBeNull();
});
test("monthly budgets preserve old month and zero differs from unset", () => {
  const s = emptyState();
  s.budgets.push({ month: "2026-08", total: 230000, categories: {} });
  put(s.budgets, { month: "2026-09", total: 0, categories: {} }, "month");
  expect(finances(s, "2026-08").remaining).toBe(230000);
  expect(finances(s, "2026-09").remaining).toBe(0);
  expect(finances(s, "2026-10").remaining).toBeNull();
});
test("daily step update replaces rather than adds, zero participates in average", () => {
  const s = emptyState();
  put(
    s.activity,
    { date: "2026-09-16", steps: 6000, burned: null, note: "" },
    "date",
  );
  put(
    s.activity,
    { date: "2026-09-16", steps: 7000, burned: null, note: "" },
    "date",
  );
  put(
    s.activity,
    { date: "2026-09-15", steps: 0, burned: null, note: "" },
    "date",
  );
  expect(s.activity.length).toBe(2);
  expect(stepStats(s, weekDates("2026-09-16"))).toEqual({
    total: 7000,
    count: 2,
    average: 3500,
  });
  expect(() =>
    validateState({ ...s, activity: [{ ...s.activity[0], steps: -1 }] }),
  ).toThrow();
});
test("nutrition fixture 40 kcal per100ml ×500ml =200", () => {
  expect(kcal(fixture(), 500)).toBe(200);
  expect(() => kcal({ ...fixture(), kcal100: null }, 500)).toThrow();
  expect(() => kcal({ ...fixture(), unit: null }, 500)).toThrow();
  expect(() => kcal(fixture(), 0)).toThrow();
});
test("manual and itemised totals are mutually exclusive without deleting snapshots", () => {
  const s = emptyState();
  const food = fixture();
  s.logs.push({
    id: "l",
    date: "2026-09-16",
    group: "Annet",
    food: structuredClone(food),
    amount: 500,
    kcal: 200,
    note: "",
  });
  put(s.modes, { date: "2026-09-16", mode: "manual", total: 1500 }, "date");
  expect(dailyCalories(s, "2026-09-16")).toBe(1500);
  expect(s.logs.length).toBe(1);
  s.modes[0].mode = "items";
  food.kcal100 = 80;
  expect(dailyCalories(s, "2026-09-16")).toBe(200);
  expect(s.transactions).toHaveLength(0);
});
test("goals apply only from effective date", () => {
  const s = emptyState();
  s.goals.push(
    { id: "a", date: "2026-09-01", steps: 5000, calories: null },
    { id: "b", date: "2026-09-20", steps: 8000, calories: 2000 },
  );
  expect(goalAt(s, "2026-09-16")?.steps).toBe(5000);
  expect(goalAt(s, "2026-08-31")).toBeUndefined();
});
test("calendar dates leap years Monday-first and last-day allowance", () => {
  expect(monthDates("2024-02")).toHaveLength(29);
  expect(monthDates("2026-02")).toHaveLength(28);
  expect(weekDates("2026-09-16")[0]).toBe("2026-09-14");
  expect(shiftDate("2026-03-29", 1)).toBe("2026-03-30");
  expect(validDate("2026-02-29")).toBe(false);
  expect(allowance(20000, "2026-09", "2026-09-30")).toBe(20000);
  expect(allowance(-50, "2026-09", "2026-09-30")).toBeNull();
  expect(allowance(100, "2026-08", "2026-09-16")).toBeNull();
  expect(allowance(100, "2026-10", "2026-09-16")).toBeNull();
});
test("backup validation duplicates references nonfinite values", () => {
  const s = emptyState();
  s.transactions.push(tx(5000));
  const backup = validateState(JSON.parse(JSON.stringify(s)));
  expect(mergeStates(s, backup).transactions.length).toBe(1);
  expect(() => validateState({ ...s, version: 99 })).toThrow();
  expect(() =>
    validateState({
      ...s,
      transactions: [s.transactions[0], s.transactions[0]],
    }),
  ).toThrow();
  expect(() =>
    validateState({
      ...s,
      transactions: [{ ...s.transactions[0], categoryId: "missing" }],
    }),
  ).toThrow();
  expect(() =>
    validateState({
      ...s,
      transactions: [{ ...s.transactions[0], amount: Infinity }],
    }),
  ).toThrow();
  expect(s.transactions.length).toBe(1);
});
test("product adapters do not conflate kJ missing or ambiguous units", () => {
  expect(
    fromOFF({
      code: "0123456789012",
      product_name: "Test",
      nutriments: { energy_100g: 400, energy_unit: "kJ" },
    })?.kcal100,
  ).toBeNull();
  expect(
    fromOFF({
      code: "0123456789012",
      product_name: "Test",
      nutriments: { "energy-kcal_100g": 40 },
    })?.unit,
  ).toBeNull();
  expect(
    fromOFF({
      code: "0123456789012",
      product_name: "Test",
      nutriments: { "energy-kcal_100g": 40 },
    })?.barcode,
  ).toBe("0123456789012");
  expect(
    fromMatvare({
      foodId: "test",
      foodName: "Test",
      calories: { quantity: 400, unit: "kJ" },
    })?.kcal100,
  ).toBeNull();
});
test("CSV neutralises spreadsheet formulas", () => {
  const s = emptyState();
  s.transactions.push({ ...tx(100), title: "=1+1" });
  expect(csvTransactions(s)).toContain("'=1+1");
});
