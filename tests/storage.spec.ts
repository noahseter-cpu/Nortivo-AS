import { test, expect } from "@playwright/test";
import { indexedDB } from "fake-indexeddb";
import { readState, updateState } from "../lib/tracker-store";
import { emptyState } from "../lib/tracker-core";
test.beforeAll(() => {
  Object.defineProperty(globalThis, "indexedDB", {
    value: indexedDB,
    configurable: true,
  });
});
test("atomic persistence validates before commit and reads across connections", async () => {
  await updateState((s) => Object.assign(s, emptyState()));
  await updateState((s) =>
    s.activity.push({
      date: "2026-09-16",
      steps: 0,
      note: "Saved",
      burned: null,
    }),
  );
  expect((await readState()).activity[0].steps).toBe(0);
  await expect(
    updateState((s) => {
      s.activity[0].steps = -5;
    }),
  ).rejects.toThrow();
  expect((await readState()).activity[0].steps).toBe(0);
});
test("concurrent writes read latest state in serialized IndexedDB transactions", async () => {
  await updateState((s) => Object.assign(s, emptyState()));
  await Promise.all([
    updateState((s) => (s.settings.name = "Noah updated")),
    updateState((s) => (s.settings.warning = 85)),
  ]);
  const s = await readState();
  expect(s.settings.name).toBe("Noah updated");
  expect(s.settings.warning).toBe(85);
});
