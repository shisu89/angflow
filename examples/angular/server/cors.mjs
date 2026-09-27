/**
 * Origin policy shared by the reference agent proxies.
 *
 * CORS headers alone don't protect the API key: a browser still SENDS a
 * cross-site POST (it only hides the response), so any page the developer
 * visits could spend their key through a wildcard-CORS localhost proxy.
 * Requests carrying a non-allowlisted Origin are therefore rejected outright.
 *
 * Default allowlist: http(s)://localhost:<any> and http(s)://127.0.0.1:<any>.
 * Extend with ANGFLOW_ALLOWED_ORIGINS (comma-separated exact origins).
 * Requests without an Origin header (curl, server-to-server) are allowed —
 * the proxy only listens on 127.0.0.1.
 */
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function isOriginAllowed(origin, allowlistEnv = process.env.ANGFLOW_ALLOWED_ORIGINS) {
  if (origin === undefined) return true;
  if (LOCAL_ORIGIN.test(origin)) return true;
  const extra = (allowlistEnv ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return extra.includes(origin);
}

/** CORS headers for an allowed request (echoes the origin; never `*`). */
export function corsHeaders(origin) {
  return {
    ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-angflow-model',
  };
}
