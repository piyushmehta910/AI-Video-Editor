/**
 * Single source of truth for hosts that may be called through the CORS proxy.
 *
 * Consumed by the browser client (needsProxy in src/api/proxy.ts), the
 * dev-server middleware (server/proxy.ts) and the production serverless
 * function (api/proxy.ts). Keeping one list guarantees the client never
 * routes a host the server would reject (and vice versa).
 */

export const PROXY_ALLOWED_HOSTS: readonly string[] = [
  'integrate.api.nvidia.com',
  'opencode.ai',
  'api.deezer.com',
  'api.elevenlabs.io',
  'openrouter.ai',
  'api.firecrawl.dev',
  'api.sketchfab.com',
  'api.giphy.com',
  'musicbrainz.org',
  'api.unsplash.com',
  'api.pexels.com',
  'pixabay.com',
  'api.polyhaven.com',
]

export function isAllowedProxyUrl(url: string): boolean {
  try {
    return PROXY_ALLOWED_HOSTS.includes(new URL(url).hostname)
  } catch {
    return false
  }
}
