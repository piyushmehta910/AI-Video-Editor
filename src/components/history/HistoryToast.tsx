import * as React from 'react'
import { Undo2, Redo2 } from 'lucide-react'
import { useHistoryStore } from '@/stores/historyStore'

/**
 * Transient feedback for undo/redo ("Undid: Added video.mp4").
 * Auto-dismisses after 2 seconds; re-triggers reset the timer.
 */
export function HistoryToast() {
  const toast = useHistoryStore((s) => s.toast)
  const dismissToast = useHistoryStore((s) => s.dismissToast)

  React.useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => dismissToast(toast.id), 2000)
    return () => window.clearTimeout(t)
  }, [toast, dismissToast])

  if (!toast) return null

  const isRedo = toast.message.startsWith('Redid:')
  return (
    <div
      key={toast.id}
      data-testid="history-toast"
      className="bg-card/95 animate-in fade-in slide-in-from-bottom-2 pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 text-xs shadow-xl backdrop-blur"
    >
      {isRedo ? <Redo2 className="size-3.5" /> : <Undo2 className="size-3.5" />}
      <span className="max-w-72 truncate">{toast.message}</span>
    </div>
  )
}
