import { useApiConfigStore } from '@/api/config/store'
import { needsProxy, proxyFetch } from '@/api/proxy'

export const NVIDIA_VISION_MODELS = [
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    name: 'Nemotron-3-Nano Omni 30B Reasoning (Recommended)',
    desc: 'NVIDIA multimodal omni reasoning model for deep visual scene analysis and image-to-text',
  },
  {
    id: 'meta/llama-3.2-11b-vision-instruct',
    name: 'Llama 3.2 11B Vision',
    desc: 'High-speed visual reasoning and captioning',
  },
  {
    id: 'meta/llama-3.2-90b-vision-instruct',
    name: 'Llama 3.2 90B Vision',
    desc: 'Flagship high-resolution multimodal understanding',
  },
] as const

export const DEFAULT_NVIDIA_VISION_MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'

export interface VisionAnalysisOptions {
  prompt?: string
  model?: string
  maxTokens?: number
  temperature?: number
  signal?: AbortSignal
}

export interface VisionAnalysisResult {
  text: string
  modelUsed: string
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

/**
 * Converts a Blob or File into a base64 Data URL string (`data:image/...;base64,...`).
 */
export async function blobToDataUrl(blob: Blob | File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Perform Image-to-Text / Multimodal Vision analysis using OpenRouter or NVIDIA NIM.
 * Defaults to active provider (e.g. OpenRouter Gemini Flash or NVIDIA Nemotron).
 */
export async function analyzeImageWithVision(
  imageInput: Blob | File | string,
  options: VisionAnalysisOptions = {},
): Promise<VisionAnalysisResult> {
  const { config } = useApiConfigStore.getState()
  const openRouterCfg = config.openRouter
  const nimCfg = config.nvidiaNim

  let url: string
  let apiKey: string
  let model: string

  if (openRouterCfg.apiKey) {
    url = `${(openRouterCfg.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '')}/chat/completions`
    apiKey = openRouterCfg.apiKey
    model = options.model || openRouterCfg.model || 'google/gemini-2.0-flash-exp:free'
  } else if (nimCfg.apiKey) {
    url = `${(nimCfg.baseUrl || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '')}/chat/completions`
    apiKey = nimCfg.apiKey
    model = options.model || DEFAULT_NVIDIA_VISION_MODEL
  } else {
    throw new Error('No Vision AI provider configured. Please add an OpenRouter or NVIDIA NIM API key in Settings.')
  }

  // Format data URL
  let dataUrl: string
  if (typeof imageInput === 'string') {
    dataUrl = imageInput.startsWith('data:') ? imageInput : `data:image/jpeg;base64,${imageInput}`
  } else {
    dataUrl = await blobToDataUrl(imageInput)
  }

  const prompt =
    options.prompt ||
    'Analyze this video frame / image in detail for a professional video editor. Describe the main subject, background setting, lighting and mood, color palette, camera framing/angle, and any visible text or logos.'

  const payload = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
          },
          {
            type: 'image_url',
            image_url: {
              url: dataUrl,
            },
          },
        ],
      },
    ],
    max_tokens: options.maxTokens ?? 1024,
    temperature: options.temperature ?? 0.2,
  }

  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  }

  const timeoutMs = 60000
  const res = needsProxy(url)
    ? await proxyFetch(url, { ...init, signal: undefined }, timeoutMs)
    : await fetch(url, init)

  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    throw new Error(`Vision Error (${res.status}): ${errorText.slice(0, 300)}`)
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  }

  const outputText = json.choices?.[0]?.message?.content?.trim() || ''
  return {
    text: outputText,
    modelUsed: model,
    usage: json.usage,
  }
}

/**
 * Perform Image-to-Text / Multimodal Vision analysis using NVIDIA NIM.
 * Maintained for backward compatibility.
 */
export async function analyzeImageWithNvidiaVision(
  imageInput: Blob | File | string,
  options: VisionAnalysisOptions = {},
): Promise<VisionAnalysisResult> {
  return analyzeImageWithVision(imageInput, options)
}

/**
 * Extract on-screen text and graphic titles from an image using Nemotron Omni Reasoning.
 */
export async function extractOcrWithNemotron(
  imageInput: Blob | File | string,
  model?: string,
): Promise<string> {
  const result = await analyzeImageWithNvidiaVision(imageInput, {
    model: model || DEFAULT_NVIDIA_VISION_MODEL,
    prompt:
      'Extract all on-screen text, subtitles, logos, names, and titles visible in this image. List them in order of visual prominence with their estimated position (top, center, bottom, left, right). If no text is present, respond with "NO_TEXT".',
  })
  return result.text
}

/**
 * Generate a concise 1-sentence scene caption for timeline markers or thumbnail previews.
 */
export async function generateSceneCaptionWithNemotron(
  imageInput: Blob | File | string,
  model?: string,
): Promise<string> {
  const result = await analyzeImageWithNvidiaVision(imageInput, {
    model: model || DEFAULT_NVIDIA_VISION_MODEL,
    prompt:
      'Provide a single concise, cinematic sentence summarizing what is happening in this video scene.',
    maxTokens: 128,
  })
  return result.text
}
