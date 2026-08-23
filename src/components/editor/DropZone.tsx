import * as React from 'react'
import { Upload, X } from 'lucide-react'
import { cn, formatBytes } from '@/lib/utils'

interface DropZoneProps {
  accept: string
  file?: File | null
  onFile: (file: File) => void
  onClear?: () => void
  label: string
  hint: string
  icon: React.ReactNode
  disabled?: boolean
}

export function DropZone({ accept, file, onFile, onClear, label, hint, icon, disabled }: DropZoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const f = e.dataTransfer.files?.[0]
    if (f) onFile(f)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'group relative cursor-pointer rounded-lg border border-dashed transition-all',
        dragging
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-border hover:border-primary/50 hover:bg-muted/40',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
      <div className="flex items-center gap-3 p-3">
        <div className="bg-muted text-muted-foreground group-hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-md transition-colors">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          {file ? (
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <span className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-[10px]">
                {formatBytes(file.size)}
              </span>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-muted-foreground truncate text-xs">{hint}</p>
            </>
          )}
        </div>
        {file && onClear && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-6 shrink-0 items-center justify-center rounded-md"
            aria-label="Remove file"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {!file && <Upload className="text-muted-foreground/50 absolute top-1/2 right-3 -translate-y-1/2 size-4" />}
    </div>
  )
}