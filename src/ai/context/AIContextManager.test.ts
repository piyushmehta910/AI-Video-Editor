import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AIContextManager } from './AIContextManager'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Clip, Asset, Track, Project } from '@/engine/types'

// Mock IndexedDB and DB methods
vi.mock('@/engine/storage/db', () => ({
  getRecord: vi.fn(),
  putRecord: vi.fn().mockResolvedValue('ok'),
  getAllRecords: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/engine/storage/opfs', () => ({
  readMediaFile: vi.fn().mockResolvedValue(new Blob([])),
}))

vi.mock('@/api/llm/understanding', () => ({
  getStoredTranscript: vi.fn().mockResolvedValue({
    assetId: 'video-1',
    text: 'Welcome to this complete AI video editor tutorial.',
    segments: [{ start: 0, end: 5, text: 'Welcome to this complete AI video editor tutorial.' }],
    sentences: [{ start: 0, end: 5, text: 'Welcome to this complete AI video editor tutorial.' }],
    words: [{ word: 'Welcome', start: 0, end: 0.5 }],
    language: 'en',
    updatedAt: Date.now(),
  }),
  storeTranscript: vi.fn().mockResolvedValue(undefined),
  getStoredScenes: vi.fn().mockResolvedValue({
    assetId: 'video-1',
    duration: 10,
    scenes: [{ id: '1', start: 0, end: 5, summary: 'Intro presenter talking to camera', keywords: ['intro', 'host'], importance: 0.9 }],
    updatedAt: Date.now(),
  }),
  storeScenes: vi.fn().mockResolvedValue(undefined),
  getStoredOcr: vi.fn().mockResolvedValue({
    assetId: 'video-1',
    regions: [
      {
        id: 'ocr-1',
        x: 0.1,
        y: 0.8,
        w: 0.4,
        h: 0.1,
        text: 'CLIPFORGE STUDIO 2026',
        confidence: 95,
        persistence: 0.8,
        start: 0,
        end: 4,
      },
    ],
    sampledFrames: 10,
    updatedAt: Date.now(),
  }),
  storeOcr: vi.fn().mockResolvedValue(undefined),
  transcribeAsset: vi.fn().mockResolvedValue(null),
}))

describe('AIContextManager', () => {
  let manager: AIContextManager

  beforeEach(() => {
    manager = AIContextManager.getInstance()
    const mockVideoClip: Clip = {
      id: 'c1',
      trackId: 'v1',
      assetId: 'video-1',
      name: 'Intro Shot',
      startTime: 0,
      duration: 5,
      sourceStart: 0,
      sourceEnd: 5,
      speed: 1,
      volume: 1,
      muted: false,
      position: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      opacity: 1,
      fadeIn: 0,
      fadeOut: 0,
      effects: [],
      transitions: {},
    }

    const mockAudioClip: Clip = {
      id: 'c2',
      trackId: 'a1',
      assetId: 'video-1',
      name: 'Intro Audio',
      startTime: 0,
      duration: 5,
      sourceStart: 0,
      sourceEnd: 5,
      speed: 1,
      volume: 0.9,
      muted: false,
      position: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      opacity: 1,
      fadeIn: 0,
      fadeOut: 0,
      effects: [],
      transitions: {},
    }

    const mockAsset: Asset = {
      id: 'video-1',
      name: 'intro.mp4',
      type: 'video',
      filePath: '/media/intro.mp4',
      duration: 10,
      mime: 'video/mp4',
      size: 1024000,
      importedAt: Date.now(),
    }

    const videoTrack: Track = {
      id: 'v1',
      type: 'video',
      name: 'Video 1',
      index: 0,
      locked: false,
      muted: false,
      hidden: false,
      clips: [mockVideoClip],
    }

    const audioTrack: Track = {
      id: 'a1',
      type: 'audio',
      name: 'Audio 1',
      index: 1,
      locked: false,
      muted: false,
      hidden: false,
      clips: [mockAudioClip],
    }

    const mockProject: Project = {
      id: 'test-proj',
      name: 'My AI Film',
      width: 1920,
      height: 1080,
      fps: 30,
      aspectRatio: '16:9',
      tracks: [videoTrack, audioTrack],
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    }

    useTimelineStore.setState({
      project: mockProject,
      assets: [mockAsset],
    })
  })

  it('retrieves moment context at timestamp including OCR, speech, and video', async () => {
    const moment = await manager.getMomentContext(2.5)

    expect(moment.time).toBe(2.5)
    expect(moment.videoClips).toHaveLength(1)
    expect(moment.videoClips[0].name).toBe('Intro Shot')
    expect(moment.spokenText).toContain('Welcome to this complete AI video editor tutorial.')
    expect(moment.onScreenText).toHaveLength(1)
    expect(moment.onScreenText[0].text).toBe('CLIPFORGE STUDIO 2026')
    expect(moment.hasSilence).toBe(false)
  })

  it('evaluates timeline health metrics and diagnostics', async () => {
    const health = await manager.evaluateTimelineHealth()

    expect(health.totalDuration).toBe(5)
    expect(health.clipCount).toBe(2)
    expect(Array.isArray(health.recommendations)).toBe(true)
  })

  it('compiles a comprehensive multimodal context document for AI Director', async () => {
    const context = await manager.getComprehensiveContext()

    expect(context.name).toBe('My AI Film')
    expect(context.resolution).toBe('1920×1080')
    expect(context.timelineManifest).toContain('Intro Shot')
    expect(context.speechTranscriptsSummary).toContain('Welcome to this complete')
    expect(context.ocrOnScreenTextSummary).toContain('CLIPFORGE STUDIO 2026')
    expect(context.scenesVisualSummary).toContain('Intro presenter talking to camera')
  })
})
