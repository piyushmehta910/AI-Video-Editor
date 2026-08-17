import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { forwardProxyRequest, type ProxyPayload } from './server/proxy.js'

/**
 * Dev-server twin of the Vercel serverless function (api/proxy.ts). Lets the
 * browser call CORS-blocked providers during `vite dev`.
 */
function apiProxyDevMiddleware(): Plugin {
  return {
    name: 'api-proxy-dev',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }
        const chunks: Buffer[] = []
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }
        let payload: ProxyPayload = {}
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as ProxyPayload
        } catch {
          res.statusCode = 400
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'Invalid JSON body' }))
          return
        }
        const result = await forwardProxyRequest(payload)
        res.statusCode = result.status
        res.statusMessage = result.statusText
        for (const [key, value] of Object.entries(result.headers)) {
          res.setHeader(key, value)
        }
        res.end(result.body)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), apiProxyDevMiddleware()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})