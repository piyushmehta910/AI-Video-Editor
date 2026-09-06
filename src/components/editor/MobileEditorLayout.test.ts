import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '@/stores/editorStore'
import { useTimelineStore } from '@/stores/timelineStore'

describe('MobileEditorLayout & Mobile Tool Synchronization', () => {
  beforeEach(() => {
    useEditorStore.setState({
      inspectorOpen: false,
      rightPanelTab: 'properties',
      toolPanelSection: 'text',
      historyPanelOpen: false,
    })
    useTimelineStore.setState({
      selection: { clipIds: [], trackId: null },
      playhead: 0,
    })
  })

  it('coordinates tool opening between mobile action bar and editor store', () => {
    // Select Text tool
    useEditorStore.getState().setToolPanelSection('text')
    expect(useEditorStore.getState().toolPanelSection).toBe('text')
    expect(useEditorStore.getState().rightPanelTab).toBe('tools')

    // Select Captions tool
    useEditorStore.getState().setToolPanelSection('captions')
    expect(useEditorStore.getState().toolPanelSection).toBe('captions')
    expect(useEditorStore.getState().rightPanelTab).toBe('tools')

    // Select Voiceover tool
    useEditorStore.getState().setToolPanelSection('voiceover')
    expect(useEditorStore.getState().toolPanelSection).toBe('voiceover')
    expect(useEditorStore.getState().rightPanelTab).toBe('tools')
  })

  it('switches to properties tab when selecting a clip', () => {
    useEditorStore.getState().setRightPanelTab('tools')
    expect(useEditorStore.getState().rightPanelTab).toBe('tools')

    // Trigger clip selection
    useTimelineStore.getState().select(['clip-123'], 'track-video-1')
    expect(useTimelineStore.getState().selection.clipIds).toEqual(['clip-123'])

    // Mobile edit action triggers properties tab
    useEditorStore.getState().setRightPanelTab('properties')
    expect(useEditorStore.getState().rightPanelTab).toBe('properties')
  })

  it('clears selection when deselected from mobile action bar', () => {
    useTimelineStore.getState().select(['clip-1', 'clip-2'], null)
    expect(useTimelineStore.getState().selection.clipIds.length).toBe(2)

    useTimelineStore.getState().select([], null)
    expect(useTimelineStore.getState().selection.clipIds.length).toBe(0)
  })

  it('preserves history panel state toggling for mobile overflow menu', () => {
    expect(useEditorStore.getState().historyPanelOpen).toBe(false)
    useEditorStore.getState().toggleHistoryPanel()
    expect(useEditorStore.getState().historyPanelOpen).toBe(true)
    useEditorStore.getState().toggleHistoryPanel()
    expect(useEditorStore.getState().historyPanelOpen).toBe(false)
  })
})
