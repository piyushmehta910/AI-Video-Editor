import { useApiConfigStore } from '@/api/config/store'
import { getDirectorProvider } from '@/api/llm/director'
import { getActiveTtsProvider } from '@/api/tts'
import type { VideoBrief } from '@/ai/videoBrief'

export interface PreflightReport {
  /** Hard blockers — production cannot deliver the brief and must not start. */
  blockers: string[]
  /** Optional capabilities that will be skipped or degraded, disclosed up front. */
  warnings: string[]
}

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0)
}

/**
 * Validate that the providers a brief depends on are actually configured
 * BEFORE any timeline mutation happens.
 *
 * Rules:
 * - Script generation always needs an LLM → hard blocker when missing.
 * - Requested narration without a TTS provider → hard blocker (the run would
 *   silently produce something other than what was asked).
 * - Stock visuals / research are optional: missing keys downgrade to the next
 *   visual fallback and are disclosed instead of failing the run.
 */
export function validateBriefProviders(brief: VideoBrief): PreflightReport {
  const { config } = useApiConfigStore.getState()
  const blockers: string[] = []
  const warnings: string[] = []

  if (!getDirectorProvider()) {
    blockers.push(
      'No AI text provider is configured — the script cannot be written. Add an NVIDIA NIM, OpenCode Zen or OpenRouter key in Settings.',
    )
  }

  if (brief.narration === 'voiceover' && !getActiveTtsProvider()) {
    blockers.push(
      'Narration is requested but no TTS provider is available. Configure NVIDIA NIM Voice or ElevenLabs in Settings, or rerun the brief with "Silent visual video".',
    )
  }

  const stockConfigured =
    hasValue(config.stockImages.unsplash?.accessKey) ||
    hasValue(config.stockImages.pexels?.apiKey) ||
    hasValue(config.stockImages.pixabay?.apiKey)
  if ((brief.sourceStrategy === 'stock' || brief.sourceStrategy === 'mixed') && !stockConfigured) {
    warnings.push(
      'No stock-image API key found — stock scenes will fall back to generated motion/text visuals.',
    )
  }

  if (brief.useResearch && !hasValue(config.firecrawl?.apiKey)) {
    warnings.push('Web research was selected but no Firecrawl key is configured — continuing without researched facts.')
  }

  return { blockers, warnings }
}
