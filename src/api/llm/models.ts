/**
 * Unified catalog of LLM & AI Models across all generation modules.
 */

export interface ModelOption {
  id: string
  name: string
  provider: 'openrouter' | 'opencode-zen' | 'nvidia-nim'
  tag?: string
  description?: string
  isFree?: boolean
  deprecated?: boolean
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
    contextWindow: '200K',
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'Nemotron 3.5 Lightning (Free)',
    provider: 'openrouter',
    tag: '1M Context',
    description: 'NVIDIA lightweight reasoning with massive 1M context window',
    isFree: true,
    contextWindow: '1M',
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    name: 'Nemotron 3 Super 120B (Free)',
    provider: 'openrouter',
    tag: '120B Heavyweight',
    description: 'Massive 120B parameter reasoning model with 262K context',
    isFree: true,
    contextWindow: '262K',
  },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    name: 'Nemotron 3 Ultra 550B (Free)',
    provider: 'openrouter',
    tag: '550B Giant',
    description: 'Ultra-scale MoE model with 1M context window for complex video plans',
    isFree: true,
    contextWindow: '1M',
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    name: 'Nemotron 3 Nano Omni (Free)',
    provider: 'openrouter',
    tag: 'Omni Reasoning',
    description: 'Multimodal reasoning model tuned for rapid timeline edits',
    isFree: true,
    contextWindow: '256K',
  },
  {
    id: 'minimax/minimax-m3:free',
    name: 'MiniMax M3 (Free)',
    provider: 'openrouter',
    tag: '1M Context',
    description: 'Top-tier 1M context model for extensive scripts and storyboards',
    isFree: true,
    contextWindow: '1M',
  },
  {
    id: 'minimax/minimax-m2.7:free',
    name: 'MiniMax M2.7 (Free)',
    provider: 'openrouter',
    tag: 'Creative Script',
    description: 'Fast creative generation for scripts, dialogue, and pacing',
    isFree: true,
    contextWindow: '196K',
  },
  {
    id: 'google/gemma-4-31b-it:free',
    name: 'Gemma 4 31B Instruct (Free)',
    provider: 'openrouter',
    tag: 'Google Open',
    description: 'High-capability Google open weights instruct model for video editing',
    isFree: true,
    contextWindow: '262K',
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    name: 'Gemma 4 26B-A4B (Free)',
    provider: 'openrouter',
    tag: 'Fast Google',
    description: 'High-efficiency Google architecture with 262K context',
    isFree: true,
    contextWindow: '262K',
  },
  {
    id: 'thinkingmachines/inkling:free',
    name: 'Thinking Machines Inkling (Free)',
    provider: 'openrouter',
    tag: '1M Reasoning',
    description: 'Deep reasoning model with 1M context for full project architecture',
    isFree: true,
    contextWindow: '1M',
  },
  {
    id: 'thinkingmachines/inkling-small:free',
    name: 'Thinking Machines Inkling Small (Free)',
    provider: 'openrouter',
    tag: '1M Fast',
    description: 'Lightweight 1M context reasoning model with instant responses',
    isFree: true,
    contextWindow: '1M',
  },
  {
    id: 'z-ai/glm-5.2:free',
    name: 'GLM 5.2 (Free)',
    provider: 'openrouter',
    tag: 'Multilingual',
    description: 'Strong bilingual and multilingual video script comprehension',
    isFree: true,
    contextWindow: '256K',
  },
  {
    id: 'cohere/north-mini-code:free',
    name: 'Cohere North Mini Code (Free)',
    provider: 'openrouter',
    tag: 'Structured Logic',
    description: 'Precision command parsing & structured tool call generation',
    isFree: true,
    contextWindow: '256K',
  },
  {
    id: 'liquid/lfm-2.5-2.6b:free',
    name: 'Liquid LFM 2.5 2.6B (Free)',
    provider: 'openrouter',
    tag: 'Liquid NN',
    description: 'Non-transformer neural architecture for ultra-low latency',
    isFree: true,
    contextWindow: '65K',
  },
  {
    id: 'poolside/laguna-s-2.1:free',
    name: 'Laguna S 2.1 (Free)',
    provider: 'openrouter',
    tag: 'Fast Logic',
    description: 'Optimized reasoning for video structure and scene beats',
    isFree: true,
    contextWindow: '262K',
  },
  {
    id: 'poolside/laguna-xs-2.1:free',
    name: 'Laguna XS 2.1 (Free)',
    provider: 'openrouter',
    tag: 'Lightweight',
    description: 'Ultra-fast sub-second model for quick timeline commands',
    isFree: true,
    contextWindow: '262K',
  },
  {
    id: 'inclusionai/ling-3.0-flash-sante:free',
    name: 'Ling 3.0 Flash Sante (Free)',
    provider: 'openrouter',
    tag: 'Health & Safe',
    description: 'Content-safe fast reasoning with 262K context',
    isFree: true,
    contextWindow: '262K',
  },
  {
    id: 'inclusionai/ling-3.0-flash-fin:free',
    name: 'Ling 3.0 Flash Fin (Free)',
    provider: 'openrouter',
    tag: 'Analytical',
    description: 'Structured analysis and precise parameter generation',
    isFree: true,
    contextWindow: '262K',
  },
  {
    id: 'dots-studio/dots-3-note-preview:free',
    name: 'Dots3-Note Preview (Free)',
    provider: 'openrouter',
    tag: '512K Longform',
    description: 'Extended 512K context note and storyboard processing',
    isFree: true,
    contextWindow: '512K',
  },
  {
    id: 'nvidia/nemotron-3.5-content-safety:free',
    name: 'Nemotron 3.5 Content Safety (Free)',
    provider: 'openrouter',
    tag: 'Safety Guard',
    description: 'NVIDIA guardrail model for video prompt safety verification',
    isFree: true,
    contextWindow: '128K',
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
    tag: 'Legacy NIM',
    description: 'Fast reasoning via NVIDIA NIM (Deprecated - use OpenRouter)',
    isFree: true,
    deprecated: true,
  },
  {
    id: 'deepseek-ai/deepseek-r1',
    name: 'DeepSeek R1 Reasoning',
    provider: 'nvidia-nim',
    tag: 'Legacy NIM',
    description: 'Advanced reasoning via NVIDIA NIM (Deprecated - use OpenRouter)',
    isFree: true,
    deprecated: true,
  },
  {
    id: 'nvidia/llama-3.1-nemotron-70b-instruct',
    name: 'Nemotron 70B Instruct',
    provider: 'nvidia-nim',
    tag: 'Legacy NIM',
    description: 'Fine-tuned by NVIDIA (Deprecated - use OpenRouter)',
    isFree: true,
    deprecated: true,
  },
  {
    id: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    name: 'Nemotron 3.5 Lightning 30B',
    provider: 'nvidia-nim',
    tag: 'Legacy NIM',
    description: 'Lightweight logic via NVIDIA NIM (Deprecated - use OpenRouter)',
    isFree: true,
    deprecated: true,
  },
  {
    id: 'deepseek-ai/deepseek-v4-flash-0731',
    name: 'DeepSeek V4 Flash',
    provider: 'nvidia-nim',
    tag: 'Legacy NIM',
    description: 'Inference speed model (Deprecated - use OpenRouter)',
    isFree: true,
    deprecated: true,
  },
  {
    id: 'mistralai/mixtral-8x22b-instruct-v0.1',
    name: 'Mixtral 8x22B',
    provider: 'nvidia-nim',
    tag: 'Legacy NIM',
    description: 'MoE architecture via NVIDIA NIM (Deprecated - use OpenRouter)',
    isFree: true,
    deprecated: true,
  },
  {
    id: 'qwen/qwen2.5-72b-instruct',
    name: 'Qwen 2.5 72B',
    provider: 'nvidia-nim',
    tag: 'Legacy NIM',
    description: 'High precision writing (Deprecated - use OpenRouter)',
    isFree: true,
    deprecated: true,
  },
  {
    id: 'meta/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B Instruct',
    provider: 'nvidia-nim',
    tag: 'Legacy NIM',
    description: 'Fast lightweight model (Deprecated - use OpenRouter)',
    isFree: true,
    deprecated: true,
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

