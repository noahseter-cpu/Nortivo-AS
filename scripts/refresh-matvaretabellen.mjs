// Public provider data only; never read or modify personal records.
import fs from 'node:fs/promises';
const source = 'https://www.matvaretabellen.no/api/nb/foods.json';
const response = await fetch(source, {signal: AbortSignal.timeout(30000)});
if (!response.ok) throw Error(`Matvaretabellen: ${response.status}`);
const data = await response.json();
if (!Array.isArray(data.foods) || data.foods.length < 1000) throw Error('Unexpected dataset; existing snapshot retained');
const foods = data.foods.map(({foodId,foodName,uri,calories,portions,searchKeywords}) => ({foodId,foodName,uri,calories,portions,searchKeywords}));
await fs.writeFile(new URL('../lib/data/matvaretabellen.json', import.meta.url), JSON.stringify({source,retrieved:new Date().toISOString().slice(0,10),foods}));
console.log(`Updated ${foods.length} public foods. Rebuild the APK to distribute this snapshot.`);
