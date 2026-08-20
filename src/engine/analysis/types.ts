import type { TranscriptionWord } from '@/engine/captions/whisper-engine'
import type { Scene } from '@/engine/analysis/scenes'

export interface StoredTranscript {
  assetId: string
  text: string
  segments: Array<{ start: number; end: number; text: string }>
  words?: TranscriptionWord[]
  sentences: Array<{ start: number; end: number; text: string }>
  language: string
  updatedAt: number
}

export interface StoredScenes {
  assetId: string
  duration: number
  scenes: Scene[]
  updatedAt: number
}

/** A persistent region of on-screen text (lower-third, title, ticker…), in normalized 0..1 frame coords. */
export interface OcrRegion {
  id: string
  x: number
  y: number
  w: number
  h: number
  text: string
  confidence: number
  /** Fraction of sampled frames in which this text was detected. */
  persistence: number
  /** Asset-relative seconds the text was visible. */
  start: number
  end: number
}

export interface StoredOcr {
  assetId: string
  regions: OcrRegion[]
  sampledFrames: number
  updatedAt: number
}