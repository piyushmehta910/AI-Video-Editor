import { forwardProxyRequest, type ProxyPayload } from '../server/proxy'

/**
 * Same-origin serverless proxy so the browser app can call providers that
 * block CORS (NVIDIA NIM, OpenCode Zen, Firecrawl, Deezer). Keys pass
 * through from the client; nothing is persisted server-side.
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    })
  }

  let payload: ProxyPayload
  try {
    payload = (await req.json()) as ProxyPayload
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const result = await forwardProxyRequest(payload)
  return new Response(result.body, {
    status: result.status,
    statusText: result.statusText,
    headers: result.headers,
  })
}