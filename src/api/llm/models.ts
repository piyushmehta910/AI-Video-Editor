/**
 * Unified catalog of LLM & AI Models across all generation modules.
 */

export interface ModelOption {
  id: string
  name: string
  provider: 'nvidia-nim' | 'openrouter' | 'opencode-zen'
  tag?: string
  description?: string
}

export const NVIDIA_NIM_MODELS: ModelOption[] = [
  {
    id: 'meta/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    provider: 'nvidia-nim',
    tag: 'Recommended',
    description: 'Fast, high-fidelity reasoning and viral script generation',
  },
  {
    id: 'deepseek-ai/deepseek-r1',
    name: 'DeepSeek R1 Reasoning',
    provider: 'nvidia-nim',
    tag: 'Deep Reasoning',
    description: 'Advanced chain-of-thought planning and structured output',
  },
  {
    id: 'nvidia/llama-3.1-nemotron-70b-instruct',
    name: 'Nemotron 70B Instruct',
    provider: 'nvidia-nim',
    tag: 'NVIDIA Optimized',
    description: 'Fine-tuned by NVIDIA for structured instructions & code',
  },
  {
    id: 'mistralai/mixtral-8x22b-instruct-v0.1',
    name: 'Mixtral 8x22B',
    provider: 'nvidia-nim',
    tag: 'Multilingual',
    description: 'Powerful MoE architecture for diverse languages',
  },
  {
    id: 'qwen/qwen2.5-72b-instruct',
    name: 'Qwen 2.5 72B',
    provider: 'nvidia-nim',
    tag: 'High Precision',
    description: 'Exceptional creative writing and technical precision',
  },
]

export const OPENROUTER_MODELS: ModelOption[] = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    tag: 'Flagship',
    description: 'Top-tier creative writing, slide layouts, and code generation',
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'openrouter',
    tag: 'Reasoning',
    description: 'Advanced reasoning and step-by-step structuring',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'openrouter',
    tag: 'Multimodal',
    description: 'Omni-model for storytelling, scripts, and editing',
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash (Free)',
    provider: 'openrouter',
    tag: 'Ultra Fast',
    description: 'Low-latency instant responses with 1M context',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'openrouter',
    tag: 'Open Weights',
    description: 'Reliable general-purpose generation',
  },
]

export const ALL_LLM_MODELS: ModelOption[] = [...NVIDIA_NIM_MODELS, ...OPENROUTER_MODELS]

export const WHISPER_MODELS = [
  { id: 'Xenova/whisper-tiny', name: 'Whisper Tiny (~39MB)', desc: 'Fastest transcription, low memory' },
  { id: 'Xenova/whisper-base', name: 'Whisper Base (~73MB)', desc: 'Recommended balance of speed and accuracy' },
  { id: 'Xenova/whisper-small', name: 'Whisper Small (~244MB)', desc: 'Higher accuracy for accented audio' },
  { id: 'Xenova/whisper-medium', name: 'Whisper Medium (~769MB)', desc: 'Maximum precision transcription' },
] as const
