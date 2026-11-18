import { createSupabaseStore } from '../netlify/terminal/store.mjs';
import { createDurableWorker } from '../netlify/product/worker.mjs';

if (process.env.PRODUCT_ENABLED !== 'true' || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('The persistent product worker needs PRODUCT_ENABLED and its dedicated database credentials.');
const legacy = createSupabaseStore(process.env);
if (!legacy.product) throw new Error('Apply the additive product migration and use the current store adapter before starting this worker.');
const worker = createDurableWorker({ store: legacy.product, env: process.env, onError: event => process.stderr.write(`${JSON.stringify({ type: 'product_worker_error', code: /^[A-Z][A-Z0-9_]{1,64}$/.test(event.code||'')?event.code:'WORKER_FAILURE', ...(/^[a-f0-9-]{36}$/i.test(event.ownerId||'')?{ownerId:event.ownerId}:{}) })}\n`) });
await worker.start();
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => { await worker.stop(); process.exit(0); });
