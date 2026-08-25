/**
 * Unified catalog of LLM & AI Models across all generation modules.
 */

export interface ModelOption {
  id: string
  name: string
  provider: 'nvidia-nim' | 'openrouter' | 'opencode-zen'
  tag?: string
  description?: string
  isFree?: boolean
  contextWindow?: string
}

export const OPENROUTER_FREE_MODELS: ModelOption[] = [
  {
    id: 'openrouter/free',
    name: 'OpenRouter Auto-Free',
    provider: 'openrouter',
    tag: 'Auto-Routing',
    description: 'Automatically routes to the best currently available free endpoint',
    isFree: true,
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash (Free)',
    provider: 'openrouter',
    tag: 'Ultra Fast',
    description: 'Low-latency instant responses with 1M context window',
    isFree: true,
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'Nemotron 3.5 Lightning (Free)',
    provider: 'openrouter',
    tag: 'Fast Logic',
    description: 'NVIDIA lightweight reasoning tuned for structured tool calls',
    isFree: true,
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    name: 'Nemotron 3 Super 120B (Free)',
    provider: 'openrouter',
    tag: 'Heavyweight',
    description: 'Massive 120B parameter free reasoning model',
    isFree: true,
  },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    name: 'Nemotron 3 Ultra 550B (Free)',
    provider: 'openrouter',
    tag: '550B Giant',
    description: 'Ultra-scale MoE model for deep complex planning',
    isFree: true,
  },
  {
    id: 'nvidia/nemotron-nano-9b-v2:free',
    name: 'Nemotron Nano 9B v2 (Free)',
    provider: 'openrouter',
    tag: 'Compact',
    description: 'Snappy response time for quick inline edit commands',
    isFree: true,
  },
  {
    id: 'google/gemma-4-31b-it:free',
    name: 'Gemma 4 31B Instruct (Free)',
    provider: 'openrouter',
    tag: 'Google Open',
    description: 'Google open weights instruct model for creative video scripting',
    isFree: true,
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    name: 'Gemma 4 26B-A4B (Free)',
    provider: 'openrouter',
    tag: 'Efficient',
    description: 'Fast Google architecture for script brainstorming',
    isFree: true,
  },
  {
    id: 'cohere/north-mini-code:free',
    name: 'Cohere North Mini Code (Free)',
    provider: 'openrouter',
    tag: 'Code & Tools',
    description: 'Precision command parsing & timeline tool invocation',
    isFree: true,
  },
  {
    id: 'openai/gpt-oss-20b:free',
    name: 'GPT OSS 20B (Free)',
    provider: 'openrouter',
    tag: 'General',
    description: 'Reliable general-purpose language understanding',
    isFree: true,
  },
  {
    id: 'liquid/lfm-2.5-2.6b:free',
    name: 'Liquid LFM 2.6B (Free)',
    provider: 'openrouter',
    tag: 'Liquid NN',
    description: 'Next-gen non-transformer architecture for long sequences',
    isFree: true,
  },
  {
    id: 'z-ai/glm-5.2:free',
    name: 'GLM 5.2 (Free)',
    provider: 'openrouter',
    tag: 'Multilingual',
    description: 'Strong bilingual and multi-language comprehension',
    isFree: true,
  },
  {
    id: 'poolside/laguna-s-2.1:free',
    name: 'Laguna S 2.1 (Free)',
    provider: 'openrouter',
    tag: 'Fast Logic',
    description: 'Optimized reasoning for script structuring',
    isFree: true,
  },
]

export const OPENROUTER_PAID_MODELS: ModelOption[] = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    tag: 'Flagship',
    description: 'Top-tier creative writing, slide layouts, and code generation',
    isFree: false,
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'openrouter',
    tag: 'Deep Reasoning',
    description: 'Advanced chain-of-thought planning and structured output',
    isFree: false,
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'openrouter',
    tag: 'Multimodal',
    description: 'Omni-model for storytelling, scripts, and editing',
    isFree: false,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'openrouter',
    tag: 'Open Weights',
    description: 'Reliable general-purpose generation',
    isFree: false,
  },
]

export const OPENROUTER_MODELS: ModelOption[] = [...OPENROUTER_FREE_MODELS, ...OPENROUTER_PAID_MODELS]

export const OPENCODE_ZEN_MODELS: ModelOption[] = [
  {
    id: 'deepseek-v4-flash-free',
    name: 'DeepSeek V4 Flash (Free)',
    provider: 'opencode-zen',
    tag: 'Free Tier',
    description: 'High-speed free reasoning model for script generation & timeline edits',
    isFree: true,
  },
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    provider: 'opencode-zen',
    tag: 'Pro Tier',
    description: 'Advanced reasoning for complete video reconstruction & pacing',
    isFree: false,
  },
  {
    id: 'deepseek-coder-6.7b-instruct',
    name: 'DeepSeek Coder 6.7B',
    provider: 'opencode-zen',
    tag: 'Code & Tools',
    description: 'Fine-tuned for structured JSON outputs and function calling',
    isFree: false,
  },
  {
    id: 'nemotron-3-ultra',
    name: 'Nemotron 3 Ultra',
    provider: 'opencode-zen',
    tag: 'Ultra Scale',
    description: 'Massive scale reasoning engine',
    isFree: false,
  },
  {
    id: 'nemotron-3-super',
    name: 'Nemotron 3 Super',
    provider: 'opencode-zen',
    tag: 'High Throughput',
    description: 'Fast response times for real-time video commands',
    isFree: false,
  },
]

export const NVIDIA_NIM_MODELS: ModelOption[] = [
  {
    id: 'meta/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    provider: 'nvidia-nim',
    tag: 'Recommended',
    description: 'Fast, high-fidelity reasoning and viral script generation',
    isFree: true,
  },
  {
    id: 'deepseek-ai/deepseek-r1',
    name: 'DeepSeek R1 Reasoning',
    provider: 'nvidia-nim',
    tag: 'Deep Reasoning',
    description: 'Advanced chain-of-thought planning and structured output',
    isFree: true,
  },
  {
    id: 'nvidia/llama-3.1-nemotron-70b-instruct',
    name: 'Nemotron 70B Instruct',
    provider: 'nvidia-nim',
    tag: 'NVIDIA Optimized',
    description: 'Fine-tuned by NVIDIA for structured instructions & code',
    isFree: true,
  },
  {
    id: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    name: 'Nemotron 3.5 Lightning 30B',
    provider: 'nvidia-nim',
    tag: 'Lightning Fast',
    description: 'Sub-second response time for rapid timeline operations',
    isFree: true,
  },
  {
    id: 'deepseek-ai/deepseek-v4-flash-0731',
    name: 'DeepSeek V4 Flash',
    provider: 'nvidia-nim',
    tag: 'High Speed',
    description: 'Optimized inference speed for real-time scripting',
    isFree: true,
  },
  {
    id: 'mistralai/mixtral-8x22b-instruct-v0.1',
    name: 'Mixtral 8x22B',
    provider: 'nvidia-nim',
    tag: 'Multilingual',
    description: 'Powerful MoE architecture for diverse languages',
    isFree: true,
  },
  {
    id: 'qwen/qwen2.5-72b-instruct',
    name: 'Qwen 2.5 72B',
    provider: 'nvidia-nim',
    tag: 'High Precision',
    description: 'Exceptional creative writing and technical precision',
    isFree: true,
  },
  {
    id: 'meta/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B Instruct',
    provider: 'nvidia-nim',
    tag: 'Lightweight',
    description: 'Fast lightweight model for short edits',
    isFree: true,
  },
]

export const ALL_LLM_MODELS: ModelOption[] = [
  ...OPENROUTER_MODELS,
  ...OPENCODE_ZEN_MODELS,
  ...NVIDIA_NIM_MODELS,
]

export const ALL_FREE_MODELS: ModelOption[] = ALL_LLM_MODELS.filter((m) => m.isFree)

export const WHISPER_MODELS = [
  { id: 'Xenova/whisper-tiny', name: 'Whisper Tiny (~39MB)', desc: 'Fastest transcription, low memory' },
  { id: 'Xenova/whisper-base', name: 'Whisper Base (~73MB)', desc: 'Recommended balance of speed and accuracy' },
  { id: 'Xenova/whisper-small', name: 'Whisper Small (~244MB)', desc: 'Higher accuracy for accented audio' },
  { id: 'Xenova/whisper-medium', name: 'Whisper Medium (~769MB)', desc: 'Maximum precision transcription' },
] as const

