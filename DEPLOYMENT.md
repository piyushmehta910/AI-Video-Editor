# Deployment & Hosting Guide: ClipForge AI Studio

## 1. Production Build Pipeline

ClipForge AI Studio compiles to a set of static HTML, JavaScript, and CSS assets alongside a stateless API proxy function.

```bash
# 1. Type-check and build production bundle
npm run build

# Output directory: ./dist
```

The build script runs:
1. `tsc -b`: Strict project-wide TypeScript verification.
2. `vite build`: Rollup-based tree shaking, chunk code-splitting, CSS minification, and asset hashing.

---

## 2. Vercel Deployment (Recommended)

ClipForge is pre-configured for instant zero-configuration deployment to **Vercel**.

### 2.1 Configuration File (`vercel.json`)
```json
{
  "rewrites": [
    { "source": "/api/proxy", "destination": "/api/proxy.ts" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### 2.2 Serverless Proxy (`api/proxy.ts`)
- Runs as a lightweight edge / serverless Node.js function on Vercel.
- Forwards client requests to external APIs that omit browser CORS headers (e.g. Deezer MP3 search, NVIDIA NIM endpoints).

---

## 3. Required HTTP Security Headers (COOP / COEP)

To enable high-performance multithreaded WebAssembly workers, `SharedArrayBuffer`, and maximum WebCodecs performance, the following headers should be configured on your hosting provider:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### Cloudflare Pages / Netlify Header Configuration (`_headers`)
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
```

---

## 4. Alternative Static Hosting Targets

| Platform | Static Hosting | Proxy Support | Routing Setup |
| :--- | :--- | :--- | :--- |
| **Vercel** | ✅ Yes (`dist/`) | ✅ Built-in (`api/proxy.ts`) | Handled via `vercel.json` rewrites |
| **Cloudflare Pages** | ✅ Yes (`dist/`) | ✅ Cloudflare Functions | `_redirects` (`/* /index.html 200`) |
| **Netlify** | ✅ Yes (`dist/`) | ✅ Netlify Functions | `_redirects` (`/* /index.html 200`) |
| **GitHub Pages** | ✅ Yes | ❌ (Client-only mode) | 404.html SPA fallback redirect |

---

## 5. Deployment Verification Checklist

- [ ] `npm test` passes 100% of unit tests.
- [ ] `npm run lint` reports 0 errors.
- [ ] `npm run check:hooks` confirms zero React hook rule violations.
- [ ] `/editor` route loads without WebGPU hardware errors on target browser.
- [ ] Test MP4 export generates valid, playable video file with audio.
