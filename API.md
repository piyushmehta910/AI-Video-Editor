# External API & Proxy Integration Specification: ClipForge AI Studio

## 1. API Architecture & Privacy Model

ClipForge AI Studio employs a direct-to-provider API integration model where all external requests originate from the client. When third-party services restrict direct browser access via restrictive Cross-Origin Resource Sharing (CORS) headers, requests are forwarded through a lightweight, stateless forward proxy.

---

## 2. Supported External Providers

### 2.1 Large Language Model (LLM) Providers

Used by the **Autonomous AI Director** for conversational editing, scripting, motion generation, and scene planning.

| Provider | Default Endpoint | Supported Features |
| :--- | :--- | :--- |
| **NVIDIA NIM** | `https://integrate.api.nvidia.com/v1/chat/completions` | Structured tool calling, streaming, low-latency inference |
| **OpenCode Zen** | Custom LLM Gateway Endpoint | Step-by-step reasoning, plan staging |
| **OpenRouter** | `https://openrouter.ai/api/v1/chat/completions` | Universal access to Claude 3.5, GPT-4o, Gemini 2.0, DeepSeek R1 |

#### LLM Tool Calling Payload Format
```json
{
  "model": "meta/llama-3.1-70b-instruct",
  "messages": [
    { "role": "system", "content": "You are the AI Director inside ClipForge..." },
    { "role": "user", "content": "Trim the intro silent 2 seconds and add upbeat background music." }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "trim_clip",
        "description": "Adjust in/out trim points of a timeline clip",
        "parameters": {
          "type": "object",
          "properties": {
            "clipId": { "type": "string" },
            "trimIn": { "type": "number" },
            "trimOut": { "type": "number" }
          },
          "required": ["clipId"]
        }
      }
    }
  ],
  "temperature": 0.3
}
```

---

### 2.2 Text-to-Speech (TTS) Providers

| Provider | Endpoint | Formats | Features |
| :--- | :--- | :--- | :--- |
| **ElevenLabs** | `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}` | MP3, PCM 44.1kHz | Voice cloning, emotion stability, speed controls |
| **NVIDIA FastPitch** | `https://integrate.api.nvidia.com/v1/audio/tts` | WAV 22.05kHz | Fast generation, low-latency streaming |

---

### 2.3 Stock Photography & Video Search

ClipForge supports ranked multi-provider fallback ordering (e.g. Unsplash → Pexels → Pixabay).

| Provider | Base URL | Auth Mechanism | Rate Limit / Quota |
| :--- | :--- | :--- | :--- |
| **Unsplash** | `https://api.unsplash.com/search/photos` | `Authorization: Client-ID {key}` | 50 req/hr (demo), 5k req/hr (prod) |
| **Pexels** | `https://api.pexels.com/v1/search` | `Authorization: {key}` | 200 req/hr |
| **Pixabay** | `https://pixabay.com/api/` | `?key={key}` query param | 100 req/min |

---

### 2.4 3D Assets & Models

| Provider | Base URL | Format | Auth Requirement |
| :--- | :--- | :--- | :--- |
| **Poly Haven** | `https://api.polyhaven.com/files/{id}` | `.glb`, `.gltf`, `.hdr` | **Keyless / CC0 Public Domain** |
| **Sketchfab** | `https://api.sketchfab.com/v3/models` | `.gltf` | User API Token (`Authorization: Token {key}`) |

---

### 2.5 Music & Audio Search

| Provider | Base URL | Type | Auth Requirement |
| :--- | :--- | :--- | :--- |
| **Deezer** | `https://api.deezer.com/search` | 30s Preview MP3s | **Keyless** (Proxied for CORS) |
| **MusicBrainz** | `https://musicbrainz.org/ws/2/recording` | Metadata Search | **Keyless** (`User-Agent` required) |

---

### 2.6 Web Research & Scraping

- **Firecrawl**: `https://api.firecrawl.dev/v0/scrape` & `/search`
  - Scrapes clean markdown from web articles, blogs, and PDF URLs for automated video lesson generation.

---

### 2.7 Animated Stickers & GIFs

- **Giphy API**: `https://api.giphy.com/v1/gifs/search`
  - Searches trending and keyword-tagged animated GIFs, converted on-the-fly to video clips.

---

## 3. Internal CORS Proxy Specification

### 3.1 Endpoint
- **Local Dev**: `POST http://localhost:5173/api/proxy` (Vite middleware)
- **Production**: `POST https://{domain}/api/proxy` (Vercel Serverless Function)

### 3.2 Request Schema
```typescript
interface ProxyPayload {
  url: string                     // Destination target URL
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>// Headers forwarded to the upstream API
  body?: string                   // Stringified request body (JSON or text)
  timeoutMs?: number              // Client timeout limit (default: 30000ms)
}
```

### 3.3 Response Schema
```typescript
interface ProxyResponse {
  status: number                  // Upstream HTTP status code
  statusText: string              // Upstream HTTP status text
  headers: Record<string, string> // Upstream response headers
  body: string                    // Response body string
}
```

### 3.4 Proxy Security Model
- **No Caching of API Keys**: API keys sent in forwarded headers are passed directly to upstream servers and never logged.
- **SSRF Protections**: Targets must be valid HTTP/HTTPS URLs; private network loopback addresses (127.0.0.1, 192.168.x.x, 10.x.x.x) are blocked.
