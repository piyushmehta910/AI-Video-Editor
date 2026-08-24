import * as React from 'react'
import {
  Box,
  X,
  RotateCcw,
  Sun,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Grid,
  Camera,
  Play,
  Upload,
  Eye,
  Sliders,
} from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { BUILTIN_3D_PRESETS, exportPresetToGlb } from '@/engine/three/presets'
import { renderGlbToVideo } from '@/engine/three/renderGlbToVideo'
import { searchModels, downloadModelAsGlb, type PolyHavenModel } from '@/api/models/polyhaven'
import { searchSketchfabModels, downloadSketchfabGlb, type SketchfabModel } from '@/api/models/sketchfab'
import {
  CAMERA_TRAJECTORY_PRESETS,
  type CameraTrajectoryPreset,
  type CameraRig,
  type CameraMode,
} from '@/engine/three/rig'
import type { Asset } from '@/engine/types'
import { ThreeDPreviewCanvas } from './ThreeDPreviewCanvas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface ThreeDStudioModalProps {
  isOpen: boolean
  onClose: () => void
  initialAssetId?: string
}

type StudioTab = 'library' | 'camera' | 'lighting' | 'render'

type OnlineModelResult = (PolyHavenModel | SketchfabModel) & {
  source: 'polyhaven' | 'sketchfab'
}

export function ThreeDStudioModal({ isOpen, onClose, initialAssetId }: ThreeDStudioModalProps) {
  const assets = useTimelineStore((s) => s.assets)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const addClip = useTimelineStore((s) => s.addClip)
  const updateClip = useTimelineStore((s) => s.updateClip)
  const project = useTimelineStore((s) => s.project)
  const playhead = useTimelineStore((s) => s.playhead)

  // Navigation tab (3D Search is on top by default)
  const [activeTab, setActiveTab] = React.useState<StudioTab>('library')

  // 3D Models in project
  const modelAssets = React.useMemo(() => assets.filter((a) => a.type === 'model'), [assets])

  const [selectedAssetId, setSelectedAssetId] = React.useState<string>(initialAssetId ?? '')
  const [selectedPresetId, setSelectedPresetId] = React.useState<string>('cyber-cube')
  const [usePreset, setUsePreset] = React.useState(true)

  // Search Online 3D Library State
  const [searchSource, setSearchSource] = React.useState<'polyhaven' | 'sketchfab'>('polyhaven')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [searchResults, setSearchResults] = React.useState<OnlineModelResult[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all')

  // Camera Trajectory & Rig State
  const [selectedPresetPathId, setSelectedPresetPathId] = React.useState<string>('turntable-360')
  const [rigMode, setRigMode] = React.useState<CameraMode>('turntable')
  const [radiusStart, setRadiusStart] = React.useState(6.0)
  const [radiusEnd, setRadiusEnd] = React.useState(6.0)
  const [elevationStart, setElevationStart] = React.useState(20)
  const [elevationEnd, setElevationEnd] = React.useState(20)
  const [azimuthStart, setAzimuthStart] = React.useState(0)
  const [azimuthEnd, setAzimuthEnd] = React.useState(360)
  const [fov, setFov] = React.useState(40)
  const [targetY, setTargetY] = React.useState(0)

  // Lighting & Environment
  const [lighting, setLighting] = React.useState<'studio' | 'neon' | 'sunset' | 'spotlight' | 'ambient'>('studio')
  const [showGrid, setShowGrid] = React.useState(true)
  const [autoRotate, setAutoRotate] = React.useState(true)

  // Render & Video settings
  const [duration, setDuration] = React.useState(5)
  const [resolution, setResolution] = React.useState('1280x720')
  const [fps, setFps] = React.useState(30)

  // Execution & Progress State
  const [rendering, setRendering] = React.useState(false)
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null)
  const [renderedBlob, setRenderedBlob] = React.useState<Blob | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const abortControllerRef = React.useRef<AbortController | null>(null)
  const fileUploadRef = React.useRef<HTMLInputElement>(null)

  // Sync initial asset if available
  React.useEffect(() => {
    if (initialAssetId) {
      setSelectedAssetId(initialAssetId)
      setUsePreset(false)
    }
  }, [initialAssetId])

  if (!isOpen) return null

  const selectedAsset = modelAssets.find((a) => a.id === selectedAssetId)

  // Build Camera Rig configuration
  const currentRig: CameraRig = {
    mode: rigMode,
    radiusStart,
    radiusEnd,
    elevationStart,
    elevationEnd,
    azimuthStart,
    azimuthEnd,
    fov,
    targetX: 0,
    targetY,
    targetZ: 0,
    pan: 1.0,
  }

  // Apply Trajectory Preset
  const applyTrajectoryPreset = (preset: CameraTrajectoryPreset) => {
    setSelectedPresetPathId(preset.id)
    setRigMode(preset.mode)
    setAzimuthStart(preset.azimuthStart)
    setAzimuthEnd(preset.azimuthEnd)
    setElevationStart(preset.elevationStart)
    setElevationEnd(preset.elevationEnd)
    setFov(preset.fov)

    const baseRadius = (selectedAsset?.modelRadius ?? 2.4) * 2.5 || 6.0
    setRadiusStart(baseRadius * preset.radiusMultStart)
    setRadiusEnd(baseRadius * preset.radiusMultEnd)
    setAutoRotate(false)
  }

  // Handle Online Search
  const handleSearchModels = async () => {
    if (!searchQuery.trim() || isSearching) return
    setIsSearching(true)
    setError(null)
    try {
      if (searchSource === 'sketchfab') {
        const models = await searchSketchfabModels(searchQuery, { maxResults: 12 })
        setSearchResults(models.map((m) => ({ ...m, source: 'sketchfab' as const })))
        if (!models.length) setError('No models found on Sketchfab matching your search query.')
      } else {
        const models = await searchModels(searchQuery, { maxResults: 12 })
        setSearchResults(models.map((m) => ({ ...m, source: 'polyhaven' as const })))
        if (!models.length) setError('No models found on Poly Haven matching your search query.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSearching(false)
    }
  }

  // Download & Stage Online Model
  const handleDownloadAndStage = async (model: OnlineModelResult) => {
    if (downloadingId) return
    setDownloadingId(model.id)
    setError(null)
    setSuccess(null)
    try {
      const file =
        model.source === 'sketchfab'
          ? await downloadSketchfabGlb(model.id)
          : await downloadModelAsGlb(model.id, { resolution: '2k' })
      const { imported, errors } = await importFiles([file])
      if (imported.length) {
        setSelectedAssetId(imported[0].id)
        setUsePreset(false)
        setSuccess(`Loaded "${imported[0].name}" into 3D Studio!`)
        setActiveTab('camera')
      } else {
        setError(errors[0] ?? 'Import failed')
      }
    } catch (err) {
      setError(`Download failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setDownloadingId(null)
    }
  }

  // Upload Local GLB/GLTF
  const handleLocalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const { imported } = await importFiles(Array.from(files))
    if (imported.length) {
      setSelectedAssetId(imported[0].id)
      setUsePreset(false)
      setSuccess(`Imported local 3D model "${imported[0].name}"`)
      setActiveTab('camera')
    }
  }

  // Video Render Process
  const startRender = async () => {
    setRendering(true)
    setError(null)
    setSuccess(null)
    setRenderedBlob(null)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      let targetAsset: Asset
      if (usePreset || !selectedAsset) {
        const glbBlob = await exportPresetToGlb(selectedPresetId)
        const glbFile = new File([glbBlob], `${selectedPresetId}-${Date.now()}.glb`, { type: 'model/gltf-binary' })
        const imp = await importFiles([glbFile])
        if (!imp.imported.length) throw new Error('Failed to prepare 3D preset asset')
        targetAsset = imp.imported[0]
      } else {
        targetAsset = selectedAsset
      }

      const [w, h] = resolution.split('x').map(Number)
      const res = await renderGlbToVideo({
        asset: targetAsset,
        rig: currentRig,
        duration,
        fps,
        width: w,
        height: h,
        signal: controller.signal,
        onProgress: (done, total) => setProgress({ done, total }),
      })

      setRenderedBlob(res.blob)

      // Add to timeline
      const videoFile = new File([res.blob], `3d-anim-${selectedPresetId || 'model'}-${Date.now()}.webm`, {
        type: 'video/webm',
      })
      const vimp = await importFiles([videoFile])
      const videoTrack = project.tracks.find((t) => t.type === 'video')
      if (videoTrack && vimp.imported.length) {
        const clip = addClip(vimp.imported[0].id, videoTrack.id, playhead ?? 0)
        if (clip) {
          updateClip(clip.id, { duration, sourceEnd: duration, clipType: 'video' })
          setSuccess(`Rendered ${duration}s HD 3D video (${w}x${h}) and added to timeline!`)
        }
      } else {
        setSuccess(`Rendered ${duration}s HD 3D animation video successfully!`)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Rendering cancelled.')
      } else {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setRendering(false)
      setProgress(null)
      abortControllerRef.current = null
    }
  }

  const downloadRenderedVideo = () => {
    if (!renderedBlob) return
    const url = URL.createObjectURL(renderedBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `3d-animation-${Date.now()}.webm`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  const filteredBuiltinPresets = BUILTIN_3D_PRESETS.filter((p) => {
    if (categoryFilter === 'all') return true
    return p.category.toLowerCase().includes(categoryFilter.toLowerCase())
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative flex h-[92vh] w-[96vw] max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        {/* ── Top Header Bar ── */}
        <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-violet-600/20 p-1.5 text-violet-400">
              <Box className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide flex items-center gap-2">
                3D Asset & Animation Studio
                <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-mono text-violet-300">
                  {usePreset ? selectedPresetId : selectedAsset?.name || 'Custom Model'}
                </span>
              </h2>
              <p className="text-[10px] text-muted-foreground">
                Cinematic multi-angle flight trajectories, online 3D library search, and 60fps HD video capture
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input ref={fileUploadRef} type="file" accept=".glb,.gltf" className="hidden" onChange={handleLocalUpload} />
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => fileUploadRef.current?.click()}>
              <Upload className="mr-1.5 size-3.5" />
              Upload .GLB
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* ── TOP 3D SEARCH & DISCOVERY BAR ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
          <div className="flex flex-1 min-w-[280px] items-center gap-2">
            <Select
              value={searchSource}
              onValueChange={(v) => {
                setSearchSource(v as 'polyhaven' | 'sketchfab')
                setSearchResults([])
              }}
            >
              <SelectTrigger className="h-8 w-40 text-xs font-semibold bg-background border-border/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="polyhaven">Poly Haven (Free CC0)</SelectItem>
                <SelectItem value="sketchfab">Sketchfab Library</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search 100,000+ 3D models (e.g. drone, trophy, robot, car, sword, space)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setActiveTab('library')
                    void handleSearchModels()
                  }
                }}
                className="h-8 pl-8 text-xs bg-background border-border/80"
              />
            </div>

            <Button
              size="sm"
              className="h-8 bg-violet-600 hover:bg-violet-500 text-white text-xs px-3 font-semibold shadow-xs"
              onClick={() => {
                setActiveTab('library')
                void handleSearchModels()
              }}
              disabled={isSearching}
            >
              {isSearching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5 mr-1" />}
              Search 3D
            </Button>
          </div>

          {/* Quick Search Tag Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 max-w-md">
            <span className="text-[10px] text-muted-foreground font-semibold shrink-0">Quick:</span>
            {['drone', 'robot', 'car', 'statue', 'chair', 'sword', 'camera', 'trophy', 'space'].map((tag) => (
              <button
                key={tag}
                type="button"
                className="rounded-md border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:border-violet-500/60 hover:bg-violet-500/10 hover:text-violet-300 transition shrink-0 capitalize"
                onClick={() => {
                  setSearchQuery(tag)
                  setActiveTab('library')
                  setIsSearching(true)
                  setError(null)
                  void (async () => {
                    try {
                      if (searchSource === 'sketchfab') {
                        const models = await searchSketchfabModels(tag, { maxResults: 12 })
                        setSearchResults(models.map((m) => ({ ...m, source: 'sketchfab' as const })))
                      } else {
                        const models = await searchModels(tag, { maxResults: 12 })
                        setSearchResults(models.map((m) => ({ ...m, source: 'polyhaven' as const })))
                      }
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err))
                    } finally {
                      setIsSearching(false)
                    }
                  })()
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* ── Main Workspace: Left 3D Viewport, Right Studio Tabs ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* ── LEFT: Interactive 3D WebGL Viewport ── */}
          <div className="flex flex-1 flex-col border-r bg-black/40 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Live Viewport</span>
                <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-mono text-violet-300">
                  {resolution} @ {fps}fps
                </span>
                {/* Viewport Lighting Quick Chips */}
                <div className="hidden sm:flex items-center gap-1 border-l pl-2 ml-1">
                  {(['studio', 'neon', 'sunset', 'spotlight', 'ambient'] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[9px] font-medium capitalize transition',
                        lighting === l
                          ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/50'
                          : 'text-muted-foreground hover:text-foreground bg-muted/30',
                      )}
                      onClick={() => setLighting(l)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition',
                    showGrid ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setShowGrid(!showGrid)}
                >
                  <Grid className="size-3.5" />
                  Grid
                </button>
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition',
                    autoRotate ? 'bg-violet-600/20 text-violet-400' : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setAutoRotate(!autoRotate)}
                >
                  <RotateCcw className="size-3.5" />
                  Spin
                </button>
              </div>
            </div>

            {/* Viewport Canvas */}
            <div className="relative flex-1 overflow-hidden rounded-xl border border-border/80 bg-zinc-950 shadow-inner">
              <ThreeDPreviewCanvas
                asset={!usePreset ? selectedAsset : null}
                presetId={usePreset ? selectedPresetId : undefined}
                autoRotate={autoRotate}
                showGrid={showGrid}
                lighting={lighting}
                className="size-full"
              />
            </div>

            {/* Quick Model Selector Strip */}
            <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                className="flex items-center gap-1 rounded-md border border-violet-500/50 bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-300 hover:bg-violet-500/30 transition shrink-0"
                onClick={() => setActiveTab('library')}
                title="Search and import free 3D models"
              >
                <Search className="size-2.5" />
                <span>Search 3D Models</span>
              </button>

              <div className="h-4 w-px bg-border/60 shrink-0 mx-0.5" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase shrink-0">Stage Model:</span>
              {BUILTIN_3D_PRESETS.map((preset) => {
                const isSelected = usePreset && selectedPresetId === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={cn(
                      'flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium transition shrink-0',
                      isSelected
                        ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                        : 'border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => {
                      setUsePreset(true)
                      setSelectedPresetId(preset.id)
                    }}
                  >
                    <Box className="size-2.5 text-violet-400" />
                    {preset.name}
                  </button>
                )
              })}

              {modelAssets.map((asset) => {
                const isSelected = !usePreset && selectedAssetId === asset.id
                return (
                  <button
                    key={asset.id}
                    type="button"
                    className={cn(
                      'flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium transition shrink-0',
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                        : 'border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => {
                      setUsePreset(false)
                      setSelectedAssetId(asset.id)
                    }}
                  >
                    <Box className="size-2.5 text-emerald-400" />
                    {asset.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── RIGHT: Tabbed Inspector & Studio Controls ── */}
          <div className="flex w-[420px] flex-col overflow-hidden bg-card/60">
            {/* Inspector Navigation Tabs: 3D Search is on top / first */}
            <div className="flex border-b bg-muted/30 p-1 gap-1">
              {[
                { id: 'library' as const, label: '3D Search', icon: Search },
                { id: 'camera' as const, label: 'Camera & Angles', icon: Camera },
                { id: 'lighting' as const, label: 'Lighting', icon: Sun },
                { id: 'render' as const, label: 'Capture & Render', icon: Play },
              ].map(({ id, label, icon: TabIcon }) => (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-center text-[10px] font-bold transition',
                    activeTab === id
                      ? 'bg-card text-violet-700 dark:text-violet-300 shadow-xs border border-border/80'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setActiveTab(id)}
                >
                  <TabIcon className="size-3 shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* ═══════════ TAB 1: CAMERA & ANGLE STUDIO ═══════════ */}
              {activeTab === 'camera' && (
                <div className="space-y-3.5">
                  {/* Trajectory Presets */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold">Cinematic Trajectory Paths</Label>
                      <span className="text-[10px] text-violet-300 font-semibold">{rigMode.toUpperCase()}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {CAMERA_TRAJECTORY_PRESETS.filter((p) => p.category !== 'viewport').map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={cn(
                            'flex flex-col items-start rounded-lg border p-2 text-left transition',
                            selectedPresetPathId === preset.id
                              ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                              : 'border-border/60 bg-muted/20 text-muted-foreground hover:border-violet-500/40 hover:text-foreground',
                          )}
                          onClick={() => applyTrajectoryPreset(preset)}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{preset.icon}</span>
                            <span className="text-[11px] font-bold">{preset.name}</span>
                          </div>
                          <span className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1">{preset.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Multi-Angle Viewports */}
                  <div className="space-y-2 pt-1 border-t">
                    <Label className="text-xs font-bold">Fixed Viewport Angles</Label>
                    <div className="grid grid-cols-3 gap-1">
                      {CAMERA_TRAJECTORY_PRESETS.filter((p) => p.category === 'viewport').map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={cn(
                            'flex items-center gap-1 rounded-md border p-1.5 text-left text-[10px] font-medium transition',
                            selectedPresetPathId === preset.id
                              ? 'border-violet-500 bg-violet-500/20 text-violet-300 font-bold'
                              : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground',
                          )}
                          onClick={() => applyTrajectoryPreset(preset)}
                        >
                          <span>{preset.icon}</span>
                          <span className="truncate">{preset.name.split(' ')[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Precision Camera Flight Calibration */}
                  <div className="space-y-2.5 rounded-lg border bg-muted/15 p-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold flex items-center gap-1">
                        <Sliders className="size-3 text-violet-400" />
                        Fine-Tune Flight Calibration
                      </Label>
                      <span className="font-mono text-[10px] text-muted-foreground">FOV: {fov}°</span>
                    </div>

                    <div className="space-y-2">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Camera Distance (Radius)</span>
                          <span className="font-mono">{radiusStart.toFixed(1)}m → {radiusEnd.toFixed(1)}m</span>
                        </div>
                        <div className="flex gap-2">
                          <Slider value={[radiusStart]} min={1} max={15} step={0.5} onValueChange={([v]) => setRadiusStart(v)} />
                          <Slider value={[radiusEnd]} min={1} max={15} step={0.5} onValueChange={([v]) => setRadiusEnd(v)} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Elevation Angle</span>
                          <span className="font-mono">{elevationStart}° → {elevationEnd}°</span>
                        </div>
                        <div className="flex gap-2">
                          <Slider value={[elevationStart]} min={-60} max={85} step={5} onValueChange={([v]) => setElevationStart(v)} />
                          <Slider value={[elevationEnd]} min={-60} max={85} step={5} onValueChange={([v]) => setElevationEnd(v)} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Azimuth Sweep</span>
                          <span className="font-mono">{azimuthStart}° → {azimuthEnd}°</span>
                        </div>
                        <Slider value={[azimuthEnd]} min={-180} max={720} step={15} onValueChange={([v]) => setAzimuthEnd(v)} />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Field of View (Lens)</span>
                          <span className="font-mono">{fov}°</span>
                        </div>
                        <Slider value={[fov]} min={15} max={100} step={1} onValueChange={([v]) => setFov(v)} />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Target Height (Y)</span>
                          <span className="font-mono">{targetY.toFixed(1)}m</span>
                        </div>
                        <Slider value={[targetY]} min={-2} max={2} step={0.1} onValueChange={([v]) => setTargetY(v)} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════ TAB 2: 3D ASSET SEARCH & LIBRARY ═══════════ */}
              {activeTab === 'library' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex rounded-md border bg-muted/40 p-0.5">
                      <button
                        type="button"
                        className={cn(
                          'flex-1 rounded py-1 text-center text-[10px] font-bold transition',
                          searchSource === 'polyhaven' ? 'bg-card text-violet-300 shadow-xs' : 'text-muted-foreground',
                        )}
                        onClick={() => setSearchSource('polyhaven')}
                      >
                        Poly Haven (Free CC0)
                      </button>
                      <button
                        type="button"
                        className={cn(
                          'flex-1 rounded py-1 text-center text-[10px] font-bold transition',
                          searchSource === 'sketchfab' ? 'bg-card text-violet-300 shadow-xs' : 'text-muted-foreground',
                        )}
                        onClick={() => setSearchSource('sketchfab')}
                      >
                        Sketchfab Library
                      </button>
                    </div>

                    <div className="flex gap-1.5">
                      <Input
                        placeholder="Search 3D models (e.g. drone, trophy, robot)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void handleSearchModels() }}
                        className="h-8 text-xs bg-muted/20"
                        disabled={isSearching}
                      />
                      <Button
                        size="sm"
                        className="h-8 bg-violet-600 hover:bg-violet-500 text-white text-xs px-3"
                        onClick={() => void handleSearchModels()}
                        disabled={isSearching || !searchQuery.trim()}
                      >
                        {isSearching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                      </Button>
                    </div>

                    {/* Quick Suggestions */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                      <span className="text-[9px] text-muted-foreground shrink-0 font-medium">Quick:</span>
                      {['drone', 'robot', 'car', 'statue', 'chair', 'sword', 'camera', 'trophy'].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className="rounded bg-muted/40 px-1.5 py-0.5 text-[9px] text-muted-foreground hover:bg-violet-500/20 hover:text-violet-300 transition shrink-0"
                          onClick={() => {
                            setSearchQuery(tag)
                            // Search immediately
                            setIsSearching(true)
                            setError(null)
                            void (async () => {
                              try {
                                if (searchSource === 'sketchfab') {
                                  const models = await searchSketchfabModels(tag, { maxResults: 12 })
                                  setSearchResults(models.map((m) => ({ ...m, source: 'sketchfab' as const })))
                                } else {
                                  const models = await searchModels(tag, { maxResults: 12 })
                                  setSearchResults(models.map((m) => ({ ...m, source: 'polyhaven' as const })))
                                }
                              } catch (err) {
                                setError(err instanceof Error ? err.message : String(err))
                              } finally {
                                setIsSearching(false)
                              }
                            })()
                          }}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Search Results ({searchResults.length})</Label>
                      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                        {searchResults.map((model) => (
                          <div
                            key={model.id}
                            className="group flex flex-col justify-between rounded-lg border bg-card p-2 hover:border-violet-500 transition"
                          >
                            <div>
                              {'thumbnailUrl' in model && model.thumbnailUrl && (
                                <img
                                  src={model.thumbnailUrl}
                                  alt={model.name}
                                  className="w-full aspect-video object-cover rounded-md mb-1 bg-black"
                                />
                              )}
                              <span className="text-xs font-bold text-foreground line-clamp-1">{model.name}</span>
                              <span className="text-[9px] text-muted-foreground">{model.polycount.toLocaleString()} polygons</span>
                            </div>
                            <Button
                              size="sm"
                              className="w-full h-6 text-[10px] mt-1.5 bg-violet-600/80 hover:bg-violet-600 text-white font-semibold"
                              onClick={() => void handleDownloadAndStage(model)}
                              disabled={downloadingId === model.id}
                            >
                              {downloadingId === model.id ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Eye className="mr-1 size-3" />}
                              {downloadingId === model.id ? 'Loading...' : 'Stage in Studio'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Built-in Presets Catalog */}
                  <div className="space-y-2 pt-1 border-t">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold">Built-In 3D Presets</Label>
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="h-6 text-[10px] w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          <SelectItem value="sci-fi">Sci-Fi & Cyber</SelectItem>
                          <SelectItem value="production">Production</SelectItem>
                          <SelectItem value="awards">Awards</SelectItem>
                          <SelectItem value="luxury">Luxury</SelectItem>
                          <SelectItem value="tech">Tech</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {filteredBuiltinPresets.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={cn(
                            'flex flex-col items-start rounded-lg border p-2 text-left transition',
                            usePreset && selectedPresetId === preset.id
                              ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                              : 'border-border/60 bg-muted/20 text-muted-foreground hover:border-violet-500/40 hover:text-foreground',
                          )}
                          onClick={() => {
                            setUsePreset(true)
                            setSelectedPresetId(preset.id)
                          }}
                        >
                          <div className="flex items-center gap-1.5">
                            <Box className="size-3.5 text-violet-400" />
                            <span className="text-xs font-bold">{preset.name}</span>
                          </div>
                          <span className="text-[9px] text-muted-foreground mt-0.5">{preset.category}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════ TAB 3: LIGHTING & STAGING ═══════════ */}
              {activeTab === 'lighting' && (
                <div className="space-y-3.5">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Atmosphere & Lighting Preset</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'studio' as const, name: 'Studio 3-Point', desc: 'Balanced neutral lighting for product showcase' },
                        { id: 'neon' as const, name: 'Cyberpunk Neon', desc: 'Vibrant dual cyan & magenta neon edge glow' },
                        { id: 'sunset' as const, name: 'Warm Sunset', desc: 'Golden hour amber with rich warm shadows' },
                        { id: 'spotlight' as const, name: 'Dramatic Spotlight', desc: 'High-contrast focused top beam' },
                        { id: 'ambient' as const, name: 'Ambient Sci-Fi', desc: 'Diffused high-tech indigo illumination' },
                      ].map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          className={cn(
                            'flex flex-col items-start rounded-lg border p-2.5 text-left transition',
                            lighting === l.id
                              ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                              : 'border-border/60 bg-muted/20 text-muted-foreground hover:border-amber-500/30 hover:text-foreground',
                          )}
                          onClick={() => setLighting(l.id)}
                        >
                          <div className="flex items-center gap-1.5">
                            <Sun className="size-3.5 text-amber-400" />
                            <span className="text-xs font-bold">{l.name}</span>
                          </div>
                          <span className="text-[9px] text-muted-foreground mt-0.5">{l.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border bg-muted/15 p-3">
                    <Label className="text-xs font-bold">Stage Helpers</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn('h-8 text-xs', showGrid && 'border-violet-500 text-violet-300')}
                        onClick={() => setShowGrid(!showGrid)}
                      >
                        <Grid className="mr-1.5 size-3.5" />
                        {showGrid ? 'Hide Floor Grid' : 'Show Floor Grid'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn('h-8 text-xs', autoRotate && 'border-violet-500 text-violet-300')}
                        onClick={() => setAutoRotate(!autoRotate)}
                      >
                        <RotateCcw className="mr-1.5 size-3.5" />
                        {autoRotate ? 'Stop Turntable' : 'Auto Turntable'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════ TAB 4: CAPTURE & RENDER PIPELINE ═══════════ */}
              {activeTab === 'render' && (
                <div className="space-y-3.5">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Capture Video Resolution</Label>
                    <Select value={resolution} onValueChange={setResolution} disabled={rendering}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1920x1080">1080p Full HD (16:9 Landscape)</SelectItem>
                        <SelectItem value="1280x720">720p HD (16:9 Landscape)</SelectItem>
                        <SelectItem value="1080x1920">1080p Vertical (9:16 Shorts / Reels)</SelectItem>
                        <SelectItem value="3840x2160">4K Ultra HD (16:9 Cinema)</SelectItem>
                        <SelectItem value="1080x1080">Square 1:1 (Social Post)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Framerate</Label>
                      <Select value={String(fps)} onValueChange={(v) => setFps(Number(v))} disabled={rendering}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="24">24 FPS (Cinematic)</SelectItem>
                          <SelectItem value="30">30 FPS (Standard)</SelectItem>
                          <SelectItem value="60">60 FPS (Ultra-Smooth)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Duration</span>
                        <span className="font-mono text-violet-300 font-bold">{duration}s</span>
                      </div>
                      <Slider value={[duration]} min={1} max={20} step={1} onValueChange={([v]) => setDuration(v)} disabled={rendering} className="pt-2" />
                    </div>
                  </div>

                  {/* Render Progress */}
                  {rendering && progress && (
                    <div className="space-y-1.5 rounded-lg border bg-violet-950/20 border-violet-500/40 p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-violet-300 font-semibold">
                          <Loader2 className="size-3.5 animate-spin" />
                          Rendering 3D Animation...
                        </span>
                        <span className="font-mono text-violet-300 font-bold">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-violet-950">
                        <div className="h-full bg-violet-500 transition-all duration-150" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        Frame {progress.done} of {progress.total}
                      </span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-2">
                    <Button
                      size="sm"
                      className="w-full h-9 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-xs"
                      onClick={() => void startRender()}
                      disabled={rendering}
                    >
                      {rendering ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
                      {rendering ? 'Rendering 3D Flight...' : `Render & Add to Timeline (${duration}s @ ${resolution})`}
                    </Button>

                    {renderedBlob && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-8 text-xs text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10"
                        onClick={downloadRenderedVideo}
                      >
                        <Download className="mr-1.5 size-3.5" />
                        Download Rendered WebM Video
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-2.5 text-xs text-emerald-300">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>{success}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
