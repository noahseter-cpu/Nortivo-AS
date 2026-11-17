import { TerminalError } from './security.mjs';

// Hosted runtime deliberately has no filesystem adapter or automatic sample database fallback.
export function createSupabaseStore(env = process.env, fetcher = fetch) {
  const base = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new TerminalError('STORAGE_NOT_CONFIGURED', 'The persistent trading workspace is not configured. Use the local terminal preview or configure its database.', 503);
  let origin;
  try { const url = new URL(base); if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/') throw new Error(); origin = url.origin; }
  catch { throw new TerminalError('STORAGE_NOT_CONFIGURED', 'Trading workspace storage is not configured correctly.', 503); }
  async function request(route, { method = 'GET', body, prefer = 'return=representation' } = {}) {
    let response;
    try {
      response = await fetcher(`${origin}/rest/v1/${route}`, {
        method, headers: { apikey: key, ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }), 'Content-Type': 'application/json', Prefer: prefer },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10_000), redirect: 'error',
      });
      if (!response.ok) {
        if (response.status === 409) throw new TerminalError('ACCOUNT_UNAVAILABLE', 'Account creation could not be completed. Try signing in or use a guest sandbox.', 409);
        throw new Error();
      }
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (error) {
      if (error instanceof TerminalError) throw error;
      throw new TerminalError('STORAGE_UNAVAILABLE', 'Trading workspace storage is temporarily unavailable. Your action was not confirmed; retry with the same request ID.', 503);
    }
  }
  const eq = value => encodeURIComponent(String(value));
  return {
    kind: 'supabase',
    async createUser(user, state) { await request('rpc/terminal_create_user', { method: 'POST', body: { p_user: user, p_state: state } }); },
    async findUserByEmail(email) { return (await request(`terminal_users?email=eq.${eq(email)}&kind=eq.user&limit=1`))?.[0] || null; },
    async createSession(session) { await request('terminal_sessions', { method: 'POST', body: session }); },
    async getSession(hash, now) {
      const sessions = await request(`terminal_sessions?token_hash=eq.${eq(hash)}&expires_at=gt.${now}&limit=1`);
      if (!sessions?.length) return null;
      const user = (await request(`terminal_users?id=eq.${eq(sessions[0].user_id)}&limit=1`))?.[0];
      if (!user || (user.expires_at && Number(user.expires_at) <= now)) return null;
      return { ...user, session_expires_at: Number(sessions[0].expires_at) };
    },
    async deleteSession(hash) { await request(`terminal_sessions?token_hash=eq.${eq(hash)}`, { method: 'DELETE' }); },
    async getState(userId) {
      const row = (await request(`terminal_states?user_id=eq.${eq(userId)}&limit=1`))?.[0];
      return row ? { revision: Number(row.revision), state: row.state,commandCount:Number(row.receipt_count) } : null;
    },
    async getReceipt(userId, requestId) { return (await request(`terminal_receipts?user_id=eq.${eq(userId)}&request_id=eq.${eq(requestId)}&select=digest,result&limit=1`))?.[0] || null; },
    async commitCommand(userId, revision, state, receipt) {
      return request('rpc/terminal_commit_command', { method: 'POST', body: { p_user_id:userId,p_revision:revision,p_state:state,p_request_id:receipt.requestId,p_digest:receipt.digest,p_result:receipt.result,p_now:receipt.now } });
    },
    async consumeRateLimit(key, limit, windowMs, now) {
      const result = await request('rpc/terminal_consume_limit', { method:'POST', body:{ p_key:key,p_limit:limit,p_window_ms:windowMs,p_now:now } });
      if (typeof result?.allowed !== 'boolean' || !Number.isFinite(result.retryAfterMs) || result.retryAfterMs<0) throw new TerminalError('STORAGE_UNAVAILABLE','Trading workspace storage requires its current migration before requests can continue.',503);
      return result;
    },
  };
}
