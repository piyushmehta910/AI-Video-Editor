import * as React from 'react'
import {
  Box,
  X,
  RotateCcw,
  Sun,
  Video,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Grid,
} from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { BUILTIN_3D_PRESETS, exportPresetToGlb } from '@/engine/three/presets'
import { renderGlbToVideo } from '@/engine/three/renderGlbToVideo'
import type { CameraRig, Asset } from '@/engine/types'
import { ThreeDPreviewCanvas } from './ThreeDPreviewCanvas'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface ThreeDStudioModalProps {
  isOpen: boolean
  onClose: () => void
  initialAssetId?: string
}

export function ThreeDStudioModal({ isOpen, onClose, initialAssetId }: ThreeDStudioModalProps) {
  const assets = useTimelineStore((s) => s.assets)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const addClip = useTimelineStore((s) => s.addClip)
  const updateClip = useTimelineStore((s) => s.updateClip)
  const project = useTimelineStore((s) => s.project)
  const playhead = useTimelineStore((s) => s.playhead)

  // 3D Models in project
  const modelAssets = React.useMemo(() => assets.filter((a) => a.type === 'model'), [assets])

  const [selectedAssetId, setSelectedAssetId] = React.useState<string>(initialAssetId ?? '')
  const [selectedPresetId, setSelectedPresetId] = React.useState<string>('cyber-cube')
  const [usePreset, setUsePreset] = React.useState(true)

  // Camera Rig State
  const [rigMode, setRigMode] = React.useState<CameraRig['mode']>('turntable')
  const [radiusStart, setRadiusStart] = React.useState(6.0)
  const [radiusEnd, setRadiusEnd] = React.useState(6.0)
  const [elevationStart, setElevationStart] = React.useState(20)
  const [elevationEnd, setElevationEnd] = React.useState(20)
  const [azimuthStart, setAzimuthStart] = React.useState(0)
  const [azimuthEnd, setAzimuthEnd] = React.useState(360)
  const [fov, setFov] = React.useState(45)
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

  const applyPresetFlight = (mode: CameraRig['mode']) => {
    setRigMode(mode)
    if (mode === 'turntable') {
      setAzimuthStart(0)
      setAzimuthEnd(360)
      setElevationStart(20)
      setElevationEnd(20)
      setRadiusStart(6.0)
      setRadiusEnd(6.0)
    } else if (mode === 'dolly') {
      setAzimuthStart(30)
      setAzimuthEnd(30)
      setElevationStart(15)
      setElevationEnd(15)
      setRadiusStart(10.0)
      setRadiusEnd(3.5)
    } else if (mode === 'orbit') {
      setAzimuthStart(0)
      setAzimuthEnd(180)
      setElevationStart(45)
      setElevationEnd(10)
      setRadiusStart(7.0)
      setRadiusEnd(5.0)
    } else if (mode === 'static') {
      setAzimuthStart(25)
      setAzimuthEnd(25)
      setElevationStart(15)
      setElevationEnd(15)
      setRadiusStart(5.5)
      setRadiusEnd(5.5)
    }
  }

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
        // Export selected preset to GLB and import to store
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

      // Import rendered WebM video to project and add to active track
      const videoFile = new File([res.blob], `3d-anim-${selectedPresetId || 'model'}-${Date.now()}.webm`, { type: 'video/webm' })
      const vimp = await importFiles([videoFile])
      const videoTrack = project.tracks.find((t) => t.type === 'video')
      if (videoTrack && vimp.imported.length) {
        const clip = addClip(vimp.imported[0].id, videoTrack.id, playhead ?? 0)
        if (clip) {
          updateClip(clip.id, { duration, sourceEnd: duration, clipType: 'video' })
          setSuccess(`Rendered ${duration}s HD 3D animation (${w}x${h}) and added to timeline!`)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative flex h-[90vh] w-[95vw] max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-violet-600/20 p-1.5 text-violet-400">
              <Box className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide">3D Asset & Animation Studio</h2>
              <p className="text-[11px] text-muted-foreground">
                Cinematic camera flight paths, real-time WebGL staging, and WebCodecs HD video rendering
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Main Workspace Body: Left Viewport, Right Inspector */}
        <div className="flex flex-1 overflow-hidden">
          {/* ── Left: Interactive 3D WebGL Viewport ── */}
          <div className="flex flex-1 flex-col border-r bg-black/40 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Stage Viewport</span>
                <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-mono text-violet-300">
                  {resolution} @ {fps}fps
                </span>
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
                  Turntable Spin
                </button>
              </div>
            </div>

            {/* Live 3D Viewport Canvas */}
            <div className="relative flex-1 overflow-hidden rounded-xl border border-border/80 bg-zinc-950">
              <ThreeDPreviewCanvas
                asset={!usePreset ? selectedAsset : null}
                presetId={usePreset ? selectedPresetId : undefined}
                autoRotate={autoRotate}
                showGrid={showGrid}
                lighting={lighting}
                className="size-full"
              />
            </div>

            {/* Model Asset Selector Chips below canvas */}
            <div className="mt-3 space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground">Quick 3D Model Presets:</span>
              <div className="flex flex-wrap gap-2">
                {BUILTIN_3D_PRESETS.map((preset) => {
                  const isSelected = usePreset && selectedPresetId === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition',
                        isSelected
                          ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                          : 'border-border/60 bg-muted/40 text-muted-foreground hover:border-violet-500/40 hover:text-foreground',
                      )}
                      onClick={() => {
                        setUsePreset(true)
                        setSelectedPresetId(preset.id)
                      }}
                    >
                      <Box className="size-3 text-violet-400" />
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
                        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition',
                        isSelected
                          ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                          : 'border-border/60 bg-muted/40 text-muted-foreground hover:border-violet-500/40 hover:text-foreground',
                      )}
                      onClick={() => {
                        setUsePreset(false)
                        setSelectedAssetId(asset.id)
                      }}
                    >
                      <Box className="size-3 text-emerald-400" />
                      {asset.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Right: Camera Flight & Render Controls Inspector ── */}
          <div className="flex w-96 flex-col overflow-y-auto p-4 space-y-4 bg-card/60">
            {/* 1. Camera Flight Mode */}
            <div className="space-y-2 rounded-lg border bg-muted/15 p-3">
              <div className="flex items-center gap-1.5">
                <Video className="size-4 text-violet-400" />
                <span className="text-xs font-semibold">Camera Motion Path</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {[
                  { mode: 'turntable' as const, label: '360° Turntable', desc: 'Smooth revolution' },
                  { mode: 'dolly' as const, label: 'Dolly Push-In', desc: 'Cinematic zoom' },
                  { mode: 'orbit' as const, label: 'Spiral Orbit', desc: 'Rising diagonal pass' },
                  { mode: 'static' as const, label: 'Static Angle', desc: 'Fixed perspective' },
                ].map(({ mode, label, desc }) => (
                  <button
                    key={mode}
                    type="button"
                    className={cn(
                      'flex flex-col items-start rounded-md border p-2 text-left transition',
                      rigMode === mode
                        ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                        : 'border-border/60 bg-card text-muted-foreground hover:border-violet-500/30 hover:text-foreground',
                    )}
                    onClick={() => applyPresetFlight(mode)}
                  >
                    <span className="text-[11px] font-medium">{label}</span>
                    <span className="text-[9px] opacity-70">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Motion Parameters Calibration */}
            <div className="space-y-2.5 rounded-lg border bg-muted/15 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Flight Calibration</span>
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
                    <Slider value={[elevationStart]} min={-60} max={80} step={5} onValueChange={([v]) => setElevationStart(v)} />
                    <Slider value={[elevationEnd]} min={-60} max={80} step={5} onValueChange={([v]) => setElevationEnd(v)} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Azimuth Sweep</span>
                    <span className="font-mono">{azimuthStart}° → {azimuthEnd}°</span>
                  </div>
                  <Slider value={[azimuthEnd]} min={0} max={720} step={15} onValueChange={([v]) => setAzimuthEnd(v)} />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Field of View (Lens)</span>
                    <span className="font-mono">{fov}°</span>
                  </div>
                  <Slider value={[fov]} min={20} max={90} step={1} onValueChange={([v]) => setFov(v)} />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Target LookAt Height (Y)</span>
                    <span className="font-mono">{targetY.toFixed(1)}m</span>
                  </div>
                  <Slider value={[targetY]} min={-2} max={2} step={0.1} onValueChange={([v]) => setTargetY(v)} />
                </div>
              </div>
            </div>

            {/* 3. Lighting & Atmosphere */}
            <div className="space-y-2 rounded-lg border bg-muted/15 p-3">
              <div className="flex items-center gap-1.5">
                <Sun className="size-4 text-amber-400" />
                <span className="text-xs font-semibold">Lighting & Atmosphere</span>
              </div>
              <div className="grid grid-cols-3 gap-1 pt-1">
                {(['studio', 'neon', 'sunset'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    className={cn(
                      'rounded px-2 py-1 text-[10px] font-medium capitalize transition',
                      lighting === l
                        ? 'border border-amber-500/50 bg-amber-500/15 text-amber-300'
                        : 'border border-border/60 bg-card text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setLighting(l)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Render Video Pipeline Settings */}
            <div className="space-y-2.5 rounded-lg border bg-muted/15 p-3">
              <div className="flex items-center gap-1.5">
                <Layers className="size-4 text-emerald-400" />
                <span className="text-xs font-semibold">Video Export Quality</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Resolution</Label>
                  <Select value={resolution} onValueChange={setResolution}>
                    <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1920x1080">1080p Full HD</SelectItem>
                      <SelectItem value="1280x720">720p HD</SelectItem>
                      <SelectItem value="1080x1920">9:16 Vertical</SelectItem>
                      <SelectItem value="1080x1080">1:1 Square</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Framerate</Label>
                  <Select value={String(fps)} onValueChange={(v) => setFps(Number(v))}>
                    <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24">24 FPS (Film)</SelectItem>
                      <SelectItem value="30">30 FPS (Standard)</SelectItem>
                      <SelectItem value="60">60 FPS (Smooth)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Clip Duration</span>
                  <span className="font-mono">{duration}s</span>
                </div>
                <Slider value={[duration]} min={1} max={20} step={1} onValueChange={([v]) => setDuration(v)} />
              </div>
            </div>

            {/* Progress & Status */}
            {progress && (
              <div className="space-y-1 rounded-md border bg-card p-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground font-mono">
                    Rendering: {progress.done} / {progress.total} frames
                  </span>
                  <span className="font-semibold text-violet-400">{pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-violet-600 transition-all duration-150" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-400">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs text-emerald-300">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Render & Append Button */}
            <Button
              className="h-10 w-full bg-violet-600 text-xs font-semibold text-white hover:bg-violet-500 shadow-md"
              onClick={() => void startRender()}
              disabled={rendering}
            >
              {rendering ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Video className="mr-2 size-4" />}
              {rendering ? 'Rendering 3D Frames...' : 'Render 3D Video & Add to Timeline'}
            </Button>

            {renderedBlob && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full text-xs text-muted-foreground hover:text-foreground"
                onClick={downloadRenderedVideo}
              >
                <Download className="mr-1.5 size-3.5" />
                Download Rendered .WebM Video
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
