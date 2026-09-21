import { test, expect } from "@playwright/test";
import { calorieSuggestion, profileSchema, type Profile } from "../lib/profile";
import {
  emptyState,
  validateState,
  mergeStates,
  type State,
} from "../lib/tracker-core";
const p: Profile = {
  heightCm: 180,
  weightKg: 80,
  age: 30,
  equation: "male",
  activity: "light",
  suitability: "general",
  updatedAt: "2026-09-16",
};
test("maintenance estimate uses the explicit formula and selected activity", () => {
  expect(calorieSuggestion(p)).toMatchObject({
    eligible: true,
    resting: 1780,
    calories: 2850,
  });
  expect(calorieSuggestion({ ...p, equation: "female" })).toMatchObject({
    eligible: true,
    resting: 1614,
    calories: 2600,
  });
  const low = calorieSuggestion({ ...p, activity: "low" });
  expect(low).toMatchObject({ calories: 2500 });
});
test("unsuitable contexts and minors never receive an automatic calorie target", () => {
  for (const change of [
    { age: 17 },
    { age: 79 },
    { equation: "none" },
    { suitability: "pregnant" },
    { suitability: "medical" },
    { suitability: "none" },
  ])
    expect(calorieSuggestion({ ...p, ...change } as Profile).eligible).toBe(
      false,
    );
  for (const change of [
    { age: 20.5 },
    { weightKg: NaN },
    { heightCm: 0 },
    { weightKg: Infinity },
  ])
    expect(() => profileSchema.parse({ ...p, ...change })).toThrow();
});
test("v1 migration preserves all history and v2 profile backup round trips", () => {
  const s = emptyState();
  s.activity = [
    { date: "2026-09-01", steps: 5000, burned: null, note: "keep" },
  ];
  s.goals = [{ id: "goal", date: "2026-09-01", steps: 6000, calories: 2300 }];
  const old: Omit<State, "version" | "profile" | "profilePromptSeen"> & {
    version: 1;
    profile?: State["profile"];
    profilePromptSeen?: boolean;
  } = { ...s, version: 1 };
  delete old.profile;
  delete old.profilePromptSeen;
  const migrated = validateState(old);
  expect(migrated.version).toBe(4);
  expect(migrated.activity).toEqual(s.activity);
  expect(migrated.goals).toEqual(s.goals);
  expect(migrated.profile).toBeNull();
  migrated.profile = p;
  expect(validateState(JSON.parse(JSON.stringify(migrated))).profile).toEqual(
    p,
  );
  const incoming = emptyState();
  incoming.profile = { ...p, weightKg: 90 };
  expect(mergeStates(migrated, incoming).profile).toEqual(p);
});
