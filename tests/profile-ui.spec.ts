import { test, expect } from "@playwright/test";
test.skip(
  !process.env.MOBILE_PROFILE_TEST,
  "Run against standalone mobile build",
);
async function fill(page: any, age = "30") {
  await page
    .getByRole("textbox", { name: "Navn", exact: true })
    .fill("Test Noah");
  await page.getByRole("textbox", { name: "Høyde (cm)" }).fill("180");
  await page.getByRole("textbox", { name: "Vekt (kg)" }).fill("80");
  await page.getByRole("textbox", { name: "Alder (år)" }).fill(age);
  await page
    .getByRole("combobox", { name: "Beregningsgrunnlag", exact: true })
    .selectOption("male");
  await page
    .getByRole("combobox", { name: "Vanlig aktivitetsnivå", exact: true })
    .selectOption("light");
  await page
    .getByRole("combobox", {
      name: "Er et generelt voksenestimat egnet?",
      exact: true,
    })
    .selectOption("general");
}
test("onboarding opt-in goal, persistence, reload, and profile edit", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "La oss gjøre den til din." }),
  ).toBeVisible();
  await fill(page);
  await page.screenshot({
    path: ".impeccable/review/profile-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Se forslag", exact: true }).click();
  await expect(page.locator(".profile-estimate")).toContainText("2 850");
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Lagre profil", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hei, Test Noah" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hei, Test Noah" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Hovedmeny" })
    .getByRole("button", { name: "Innstillinger", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Endre profil og kaloriforslag" })
    .click();
  await expect(page.getByRole("textbox", { name: "Vekt (kg)" })).toHaveValue(
    "80",
  );
  await page.getByRole("textbox", { name: "Vekt (kg)" }).fill("81,5");
  await page.getByRole("button", { name: "Se forslag", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: ".impeccable/review/profile-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Lagre profil", exact: true }).click();
  const stored = await page.evaluate(
    async () =>
      new Promise<any>((resolve) => {
        const r = indexedDB.open("noah-tracker-private-v1", 1);
        r.onsuccess = () => {
          const db = r.result;
          const t = db.transaction("records");
          const g = t.objectStore("records").get("state");
          g.onsuccess = () => {
            resolve(g.result);
            db.close();
          };
        };
      }),
  );
  expect(stored.profile.weightKg).toBe(81.5);
  expect(stored.goals[0].calories).toBe(2850);
});
test("skip is remembered and under-18 profile has no auto-target", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Gjør dette senere" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Legg til utgift", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Hovedmeny" })
    .getByRole("button", { name: "Innstillinger", exact: true })
    .click();
  await page.getByRole("button", { name: "Opprett profil" }).click();
  await fill(page, "17");
  await page.getByRole("button", { name: "Se forslag", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Profil uten automatisk mål" }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Lagre profil", exact: true }).click();
  await page
    .getByRole("button", { name: "Endre profil og kaloriforslag" })
    .click();
  await expect(page.getByRole("textbox", { name: "Alder (år)" })).toHaveValue(
    "17",
  );
});
