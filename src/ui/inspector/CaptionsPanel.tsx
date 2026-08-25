import * as React from 'react'
import { Captions, CircleAlert, ShieldAlert } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { CaptionMode, CaptionPositionMode, CaptionsConfig } from '@/engine/types'
import { defaultCaptionsConfig } from '@/engine/types'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { GOOGLE_FONTS, loadGoogleFont } from '@/lib/fonts'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-muted-foreground text-[10px]">{label}</Label>
      {children}
    </div>
  )
}

function ToggleRow({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Switch checked={checked} onCheckedChange={onChange} className="scale-75" aria-label={label} />
      <div className="min-w-0">
        <p className="text-xs">{label}</p>
        {hint && <p className="text-muted-foreground text-[10px] leading-tight">{hint}</p>}
      </div>
    </div>
  )
}

export function CaptionsPanel() {
  const captions = useTimelineStore((s) => s.project.captions) ?? defaultCaptionsConfig()
  const setCaptions = useTimelineStore((s) => s.setCaptions)
  const ocr = useTimelineStore((s) => s.ocr)
  const assets = useTimelineStore((s) => s.assets)
  const selection = useTimelineStore((s) => s.selection)

  const set = (patch: Partial<CaptionsConfig>) => setCaptions(patch)
  const setStyle = (patch: Partial<CaptionsConfig['style']>) => set({ style: { ...captions.style, ...patch } })
  const setPosition = (patch: Partial<CaptionsConfig['position']>) => set({ position: { ...captions.position, ...patch } })

  const clip = selection.clipIds[0]
  const asset = clip
    ? (() => {
        for (const track of useTimelineStore.getState().project.tracks) {
          const c = track.clips.find((x) => x.id === clip)
          if (c) return assets.find((a) => a.id === c.assetId)
        }
        return undefined
      })()
    : undefined
  const ocrAssetId = asset?.type === 'video' ? asset.id : (Object.keys(ocr).find((id) => ocr[id].regions.length > 0) ?? '')
  const regions = ocrAssetId ? (ocr[ocrAssetId]?.regions ?? []) : []

  return (
    <div className="space-y-4">
      <ToggleRow
        checked={captions.enabled}
        onChange={(v) => set({ enabled: v })}
        label="Auto captions"
        hint="Show transcript-driven captions on the preview and in exports."
      />

      <div className="space-y-2.5">
        <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
          <Captions className="size-3.5" /> Timing
        </div>
        <Field label="Cue timing">
          <select
            className="w-full rounded-md border bg-background px-1 py-0.5 text-xs"
            value={captions.mode}
            onChange={(e) => set({ mode: e.target.value as CaptionMode })}
          >
            <option value="sentence">Sentence (stable)</option>
            <option value="word">Word (karaoke highlight)</option>
          </select>
        </Field>
      </div>

      <div className="space-y-2.5">
        <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
          <Captions className="size-3.5" /> Style
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Font size">
            <Slider min={24} max={120} step={1} value={[captions.style.fontSize]} onValueChange={([v]) => setStyle({ fontSize: v })} />
          </Field>
          <Field label="Font">
            <select
              className="w-full rounded-md border bg-background px-1 py-0.5 text-xs"
              value={captions.style.fontFamily}
              onChange={(e) => {
                const f = e.target.value
                loadGoogleFont(f)
                setStyle({ fontFamily: f })
              }}
            >
              {GOOGLE_FONTS.map((f) => (
                <option key={f.family} value={f.family}>
                  {f.name} ({f.category})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Text color">
            <input type="color" value={captions.style.color} className="h-7 w-full cursor-pointer rounded border" onChange={(e) => setStyle({ color: e.target.value })} />
          </Field>
          <Field label="Background">
            <input type="color" value={captions.style.backgroundColor} className="h-7 w-full cursor-pointer rounded border" onChange={(e) => setStyle({ backgroundColor: e.target.value })} />
          </Field>
        </div>
        <Field label={`Background opacity ${Math.round(captions.style.backgroundOpacity * 100)}%`}>
          <Slider min={0} max={1} step={0.05} value={[captions.style.backgroundOpacity]} onValueChange={([v]) => setStyle({ backgroundOpacity: v })} />
        </Field>
        <Field label={`Corner radius ${captions.style.borderRadius}px`}>
          <Slider min={0} max={24} step={1} value={[captions.style.borderRadius]} onValueChange={([v]) => setStyle({ borderRadius: v })} />
        </Field>
        <ToggleRow checked={captions.style.fontWeight === 'bold'} onChange={(v) => setStyle({ fontWeight: v ? 'bold' : 'normal' })} label="Bold" />
        <ToggleRow checked={captions.style.shadow} onChange={(v) => setStyle({ shadow: v })} label="Text shadow" />
        <ToggleRow checked={captions.style.uppercase} onChange={(v) => setStyle({ uppercase: v })} label="UPPERCASE" />
      </div>

      <div className="space-y-2.5">
        <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
          <Captions className="size-3.5" /> Position
        </div>
        <Field label="Placement">
          <select
            className="w-full rounded-md border bg-background px-1 py-0.5 text-xs"
            value={captions.position.mode}
            onChange={(e) => setPosition({ mode: e.target.value as CaptionPositionMode })}
          >
            <option value="bottom">Bottom</option>
            <option value="top">Top</option>
            <option value="auto">Auto (clear of text)</option>
          </select>
        </Field>
        <Field label={`Edge margin ${Math.round(captions.position.marginY * 100)}%`}>
          <Slider min={0} max={0.3} step={0.01} value={[captions.position.marginY]} onValueChange={([v]) => setPosition({ marginY: v })} />
        </Field>
        <Field label={`Max width ${Math.round(captions.position.maxWidthPct * 100)}%`}>
          <Slider min={0.4} max={0.98} step={0.01} value={[captions.position.maxWidthPct]} onValueChange={([v]) => setPosition({ maxWidthPct: v })} />
        </Field>
        <ToggleRow
          checked={captions.avoidProtectedRegions}
          onChange={(v) => set({ avoidProtectedRegions: v })}
          label="Avoid on-screen text"
          hint="Keeps captions clear of OCR-detected titles and lower-thirds."
        />
        <ToggleRow
          checked={captions.showProtectedRegions}
          onChange={(v) => set({ showProtectedRegions: v })}
          label="Show protected regions"
          hint="Preview-only overlay of detected on-screen text boxes."
        />
      </div>

      <div className="space-y-2.5">
        <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
          <ShieldAlert className="size-3.5" /> Detected text
        </div>
        {regions.length === 0 ? (
          <div className="text-muted-foreground flex items-start gap-1.5 rounded-md border bg-muted/40 p-2 text-[10px] leading-relaxed">
            <CircleAlert className="mt-0.5 size-3 shrink-0" />
            No protected regions yet. Run Analyze on a video asset in the Media panel to OCR titles and lower-thirds.
          </div>
        ) : (
          <ul className="space-y-1">
            {regions.slice(0, 8).map((r) => (
              <li key={r.id} className={cn('flex items-center justify-between gap-2 rounded border bg-muted/40 px-2 py-1 text-[10px]')}>
                <span className="truncate">{r.text}</span>
                <span className="text-muted-foreground shrink-0 font-mono tabular-nums">
                  {Math.round(r.confidence)}% · {Math.round(r.persistence * 100)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}