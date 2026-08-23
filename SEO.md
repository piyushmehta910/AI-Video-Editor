# Search Engine Optimization (SEO) & Metadata: ClipForge AI Studio

## 1. SEO Architecture & Strategy

ClipForge AI Studio is structured to maximize organic search discovery for high-intent queries (e.g. *"browser video editor"*, *"client-side AI video editor"*, *"webcodecs video editor"*, *"free privacy-first video editor"*).

The marketing landing page (`/`) is lightweight, semantic, and fast to ensure maximum Core Web Vitals scores (LCP < 1.2s, CLS < 0.05, FID < 50ms).

---

## 2. Meta Tags & Social Graph Metadata

### 2.1 Essential Document Meta Tags
```html
<title>ClipForge AI Studio — Browser-Native AI Video Editor</title>
<meta name="description" content="Edit videos directly in your browser with an autonomous AI Director. Zero server uploads, WebCodecs hardware performance, auto-captions, and 3D model rendering." />
<meta name="keywords" content="video editor, browser video editor, AI video editor, WebCodecs, WebGPU, Whisper captions, client side video editing, 3D video, open source video editor" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="theme-color" content="#0b0d13" />
```

### 2.2 OpenGraph (Facebook / LinkedIn / Discord)
```html
<meta property="og:type" content="website" />
<meta property="og:url" content="https://clipforge.studio/" />
<meta property="og:title" content="ClipForge AI Studio — Browser-Native AI Video Editor" />
<meta property="og:description" content="Client-side AI video editing workstation. 100% private, zero uploads, hardware-accelerated WebCodecs export." />
<meta property="og:image" content="https://clipforge.studio/og-banner.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
```

### 2.3 Twitter / X Cards
```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="ClipForge AI Studio — Browser-Native AI Video Editor" />
<meta name="twitter:description" content="Autonomous AI Director paired with WebCodecs & WebGPU. No video uploads to servers." />
<meta name="twitter:image" content="https://clipforge.studio/twitter-card.png" />
```

---

## 3. JSON-LD Structured Data Schema

Injected into `index.html` to generate Google Rich Snippets:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "ClipForge AI Studio",
  "url": "https://clipforge.studio",
  "description": "Browser-native video editor with an autonomous AI Director and 100% client-side WebCodecs processing.",
  "applicationCategory": "MultimediaApplication",
  "operatingSystem": "All modern browsers (Chrome, Edge, Safari, Firefox)",
  "browserRequirements": "Requires WebCodecs and WebAssembly support",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "featureList": [
    "Non-linear multi-track timeline",
    "Autonomous AI Director with tool calling",
    "Client-side Whisper speech-to-text captions",
    "RNNoise WebAssembly audio cleanup",
    "Three.js 3D GLB video rendering",
    "Hardware-accelerated MP4 export via WebCodecs"
  ]
}
</script>
```

---

## 4. Performance & Core Web Vitals Alignment

- **Static Landing Route**: Rendered without heavy 3D or WebGPU bundles.
- **Font Optimization**: Uses system font fallbacks (`Inter`, system-ui) to avoid layout shifts (CLS = 0).
- **Responsive Media Queries**: Images on the landing page include explicit `width` and `height` attributes to prevent layout reflow.
