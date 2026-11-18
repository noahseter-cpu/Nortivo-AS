// Served only after the private wrapper authorizes the current administrator.
// The token remains in memory and is never inserted into URLs, storage or HTML.
export const corePrivateBrowserScript = `(() => {
  'use strict';
  const send = window.fetch.bind(window);
  const tutorPaths = new Set(['/admin/projects/vibb/api/tutor', '/.netlify/functions/admin-vibb/api/tutor']);
  window.fetch = async function(input, init) {
    const request = input instanceof Request ? input : null;
    const target = new URL(request ? request.url : String(input), window.location.href);
    const method = String(init?.method || request?.method || 'GET').toUpperCase();
    if (target.origin !== window.location.origin || !tutorPaths.has(target.pathname) || method !== 'POST') return send(input, init);
    const proof = await send('/.netlify/functions/admin-session', { credentials: 'same-origin', cache: 'no-store' });
    if (!proof.ok) throw new Error('Sign in again with a current security code.');
    const session = await proof.json();
    if (typeof session.csrfToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken)) throw new Error('Private request security is unavailable.');
    const headers = new Headers(init?.headers || request?.headers || {});
    headers.set('x-csrf-token', session.csrfToken);
    return send(input, { ...init, credentials: 'same-origin', headers });
  };
})();`;

export function injectCorePrivateBrowser(html) {
  if (typeof html !== 'string') throw new TypeError('Expected a trusted private HTML document.');
  const tag = '<script src="/admin/projects/vibb/core-csrf.js"></script>';
  if (html.includes(tag)) return html;
  return /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, head => head + tag) : tag + html;
}
