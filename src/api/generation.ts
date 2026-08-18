import { needsProxy, proxyFetch } from './proxy'

export interface TtsRequest {
  apiKey: string
  endpoint: string
  voiceId: string
  text: string
  model?: string
  language?: string
  stability?: number
  similarity?: number
  style?: number
  speed?: number
  outputFormat?: string
  timeoutMs: number
}

/**
 * Synthesize speech with ElevenLabs. Uses the streaming endpoint when
 * available (`/v1/text-to-speech/{voice}/stream` → audio/mpeg) and falls back
 * to the non-streaming `/v1/text-to-speech/{voice}` for accounts/tiers that
 * reject the stream route. Returns the decoded audio blob.
 */
export async function synthesizeSpeech(req: TtsRequest): Promise<Blob> {
  const { apiKey, voiceId, text } = req
  if (!apiKey.trim()) throw new Error('ElevenLabs: missing API key')
  if (!voiceId.trim()) throw new Error('ElevenLabs: no voice selected')
  const base = req.endpoint.replace(/\/$/, '')
  const requestBody: Record<string, unknown> = {
    text,
    model_id: req.model ?? 'eleven_multilingual_v2',
    voice_settings: {
      stability: req.stability ?? 0.5,
      similarity_boost: req.similarity ?? 0.75,
      style: req.style ?? 0.3,
      use_speaker_boost: true,
      speed: req.speed ?? 1.0,
    },
  }
  if (req.language && req.language !== 'auto') requestBody.language_code = req.language
  const body = JSON.stringify(requestBody)
  const headers: Record<string, string> = {
    'xi-api-key': apiKey,
    'Content-Type': 'application/json',
    Accept: 'audio/mpeg',
  }

  // ElevenLabs defines output_format as a query parameter, not a JSON field.
  const outputFormat = encodeURIComponent(req.outputFormat ?? 'mp3_44100_128')
  const voiceUrl = `${base}/v1/text-to-speech/${encodeURIComponent(voiceId)}`
  const query = `?output_format=${outputFormat}`
  for (const url of [`${voiceUrl}/stream${query}`, `${voiceUrl}${query}`]) {
    const res = await fetchWithTimeout(url, { method: 'POST', headers, body }, req.timeoutMs)
    if (res.ok) {
      return await res.blob()
    }
    const text = await res.text().catch(() => '')
    // 404 on the streaming route just means this tier/region lacks it — fall
    // back to the non-streaming endpoint. Real auth/quota errors surface.
    if (res.status === 404 && url.endsWith('/stream')) continue
    throw new Error(`ElevenLabs HTTP ${res.status}: ${text.slice(0, 200) || res.statusText}`)
  }
  throw new Error('ElevenLabs: no usable TTS endpoint responded')
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  if (needsProxy(url)) {
    return proxyFetch(url, init, timeoutMs)
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
