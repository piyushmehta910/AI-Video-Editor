# Security Architecture & Threat Model: ClipForge AI Studio

## 1. Threat Model & Core Security Guarantees

ClipForge AI Studio is engineered to eliminate the massive privacy and security risks associated with cloud video SaaS platforms.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ClipForge Security Guarantees                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Zero Video Retention: Media never leaves the user's browser origin.      │
│ 2. Encrypted Secrets: API keys are encrypted at rest using AES-256-GCM.     │
│ 3. Sandboxed AI Execution: Dynamic motion graphics execute in isolated      │
│    sandboxed iframes without DOM or origin access.                          │
│ 4. No Telemetry / Tracking: Zero tracking scripts or third-party loggers.   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Cryptographic Architecture

### 2.1 Key Derivation & Encryption Standards
All user API keys (NVIDIA NIM, ElevenLabs, Firecrawl, etc.) are encrypted before being written to IndexedDB or localStorage.

- **Algorithm**: `AES-GCM` (Advanced Encryption Standard in Galois/Counter Mode)
- **Key Length**: 256-bit
- **Initialization Vector (IV)**: 12-byte cryptographically secure random value (`crypto.getRandomValues`) generated per encryption operation.
- **Key Derivation Function**: `PBKDF2` with `SHA-256` hashing.
- **Iteration Count**: `100,000` iterations.
- **Salt**: 16-byte cryptographically secure random salt generated per encryption operation.

```
[ Plaintext Secret ]
         │
         ├──► [ crypto.subtle.importKey('raw') ] (Password)
         │                   │
         │                   ▼
         ├──► [ crypto.subtle.deriveKey(PBKDF2, Salt, 100k iters) ]
         │                   │
         │                   ▼
         └──► [ crypto.subtle.encrypt(AES-GCM, IV, DerivedKey) ]
                             │
                             ▼
         [ Salt (16B) + IV (12B) + Ciphertext + Auth Tag ] ──► Encrypted Hex
```

---

## 3. Sandboxing AI-Generated Code

The AI Director can generate dynamic HTML5/CSS/Canvas motion graphics. To prevent Cross-Site Scripting (XSS) or prototype pollution:
- Motion graphics execute inside an isolated `<iframe sandbox="allow-scripts">` without `allow-same-origin`.
- The iframe cannot access `localStorage`, `IndexedDB`, cookies, parent DOM elements, or network APIs.
- Frame rendering messages are transmitted strictly over `postMessage` with origin validation.

---

## 4. Filesystem & Path Sanitization

To protect the Origin Private File System (OPFS) from arbitrary directory traversal:
```typescript
function validatePathSegment(segment: string): void {
  if (!segment || segment.length === 0) throw new Error('Empty segment')
  if (segment.includes('/') || segment.includes('\\')) throw new Error('Path separators forbidden')
  if (segment === '.' || segment === '..' || segment.startsWith('.')) throw new Error('Dot paths forbidden')
  if (segment.length > 255) throw new Error('Segment length exceeds limit')
}
```

---

## 5. CORS Proxy SSRF Protections

The forward proxy (`server/proxy.ts` / `api/proxy.ts`) implements SSRF (Server-Side Request Forgery) safeguards:
1. Rejects URLs targeting loopback IP addresses (`127.0.0.1`, `localhost`, `::1`).
2. Rejects private RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
3. Enforces HTTPS on external vendor API endpoints.
4. Strips dangerous hop-by-hop HTTP headers before forwarding requests.
