import { test, expect } from '@playwright/test';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { GET } from '../lib/food-provider';
import { fromMatvare } from '../lib/food-adapters';
import snapshot from '../lib/data/matvaretabellen.json' with { type: 'json' };
test('Android Matvaretabellen searches work without any network requests', async () => {
  const native = Capacitor.isNativePlatform;
  const get = CapacitorHttp.get;
  const fetchOriginal = globalThis.fetch;
  Capacitor.isNativePlatform = () => true;
  CapacitorHttp.get = async () => { throw Error('Network must not be used'); };
  globalThis.fetch = async () => { throw Error('Network must not be used'); };
  try {
    for (const query of ['banan', 'melk', 'kylling', 'brød']) {
      const response = await GET(new Request(`https://localhost/api/foods?provider=mvt&q=${encodeURIComponent(query)}`));
      expect(response.status).toBe(200);
      const {foods} = await response.json() as { foods: import("../lib/tracker-core").Food[] };
      expect(foods.length).toBeGreaterThan(0);
      expect(foods.every((f: any) => f.source === 'Matvaretabellen' && f.unit === 'g')).toBe(true);
      expect(foods.some((f: any) => f.kcal100 !== null)).toBe(true);
    }
  } finally { Capacitor.isNativePlatform = native; CapacitorHttp.get = get; globalThis.fetch = fetchOriginal; }
});
test('bundled nutrition preserves source calories and provenance', () => {
  expect(snapshot.foods.length).toBeGreaterThan(2000);
  let count = 0;
  for (const raw of snapshot.foods) {
    const food = fromMatvare(raw);
    if (!food) continue;
    count++;
    expect(food.kcal100).toBe(raw.calories?.unit === 'kcal' ? raw.calories.quantity : null);
    expect(food.url).toBe(raw.uri);
  }
  expect(count).toBeGreaterThan(2000);
});


test('mobile food search uses the bundled library while offline', async ({page}) => {
  test.skip(!process.env.MOBILE_PROFILE_TEST, 'Requires mobile preview');
  await page.goto('/');
  await page.getByRole('button', {name:'Gjør dette senere'}).click();
  await page.evaluate(() => {
    (window as any).Capacitor.isNativePlatform = () => true;
    Object.defineProperty(navigator, 'onLine', {get: () => false, configurable: true});
  });
  await page.getByRole('button', {name:/Søk etter mat|Søk etter matvare/}).click();
  await expect(page.getByRole('radio', {name:'Open Food Facts', exact:true})).toBeChecked();
  await page.getByRole('radio', {name:'Matvaretabellen', exact:true}).check();
  await page.getByRole('textbox', {name:'Søk etter mat', exact:true}).fill('banan');
  await page.getByRole('button', {name:'Søk', exact:true}).click();
  await expect(page.getByText('Banan, rå', {exact:true})).toBeVisible();
});
