import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'node:path'
import { Readable } from 'node:stream'
import { forwardProxyRequest, type ProxyPayload } from './server/proxy.ts'

// Bundle analysis: ANALYZE=1 npm run build -> stats.html (treemap of every chunk)
const analyze = process.env.ANALYZE === '1'

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
        if (result.body instanceof Uint8Array) {
          res.end(result.body)
        } else {
          Readable.fromWeb(result.body as unknown as import('node:stream/web').ReadableStream).pipe(res)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    apiProxyDevMiddleware(),
    ...(analyze
      ? [
          visualizer({
            filename: 'stats.html',
            template: 'treemap',
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  build: {
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Pin heavy and independent libs to dedicated chunks
          if (id.includes('node_modules/@radix-ui') || id.includes('node_modules/lucide-react')) return 'vendor-ui'
          if (id.includes('node_modules/mediabunny') || id.includes('node_modules/gifuct-js')) return 'vendor-media'
          if (id.includes('node_modules/zustand') || id.includes('node_modules/zundo') || id.includes('node_modules/immer')) return 'vendor-state'
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})