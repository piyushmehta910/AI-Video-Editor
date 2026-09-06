import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from './editorStore'
import { getToolMeta, TOOL_SECTIONS } from '@/ui/common/toolSections'

describe('editorStore - rightPanelTab & toolPanelSection synchronization', () => {
  beforeEach(() => {
    useEditorStore.setState({
      inspectorOpen: false,
      rightPanelTab: 'properties',
      toolPanelSection: 'text',
    })
  })

  it('initializes with rightPanelTab as properties and toolPanelSection as text', () => {
    const state = useEditorStore.getState()
    expect(state.rightPanelTab).toBe('properties')
    expect(state.toolPanelSection).toBe('text')
  })

  it('switches rightPanelTab directly via setRightPanelTab', () => {
    useEditorStore.getState().setRightPanelTab('tools')
    expect(useEditorStore.getState().rightPanelTab).toBe('tools')

    useEditorStore.getState().setRightPanelTab('properties')
    expect(useEditorStore.getState().rightPanelTab).toBe('properties')
  })

  it('automatically sets rightPanelTab to tools and opens inspector when setToolPanelSection is called with a tool', () => {
    useEditorStore.getState().setToolPanelSection('captions')
    const state = useEditorStore.getState()
    expect(state.toolPanelSection).toBe('captions')
    expect(state.rightPanelTab).toBe('tools')
    expect(state.inspectorOpen).toBe(true)
  })

  it('getToolMeta returns correct tool metadata and falls back to text presets', () => {
    const textMeta = getToolMeta('text')
    expect(textMeta.label).toBe('Text Presets')
    expect(textMeta.id).toBe('text')

    const fallbackMeta = getToolMeta(null)
    expect(fallbackMeta.label).toBe('Text Presets')

    const captionsMeta = getToolMeta('captions')
    expect(captionsMeta.label).toBe('Captions')
    expect(captionsMeta.id).toBe('captions')
  })

  it('contains all 16 middle tools in TOOL_SECTIONS', () => {
    expect(TOOL_SECTIONS.length).toBe(16)
    const ids = TOOL_SECTIONS.map((t) => t.id)
    expect(ids).toContain('text')
    expect(ids).toContain('captions')
    expect(ids).toContain('effects')
    expect(ids).toContain('transitions')
    expect(ids).toContain('audio')
    expect(ids).toContain('voiceover')
    expect(ids).toContain('avatar')
    expect(ids).toContain('slide')
    expect(ids).toContain('script')
    expect(ids).toContain('stickers')
    expect(ids).toContain('images')
    expect(ids).toContain('speed')
    expect(ids).toContain('crop')
    expect(ids).toContain('keyframe')
    expect(ids).toContain('insights')
    expect(ids).toContain('design')
  })
})
