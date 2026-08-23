/**
 * Native HTML5 drag ghost layer. A single hidden element sits off-screen;
 * at dragstart `beginAssetDrag` (in dragState.ts) stamps the dragged asset's
 * thumbnail + name into it and passes it to dataTransfer.setDragImage.
 */
export function DragPreviewLayer() {
  return (
    <div
      data-drag-ghost
      aria-hidden
      className="pointer-events-none fixed -top-[999px] left-0 z-[100] flex items-center gap-2 rounded-lg border border-violet-500/60 bg-neutral-900/95 px-2 py-1.5 shadow-2xl"
      style={{ width: 190 }}
    >
      <img data-ghost-thumb alt="" className="h-10 w-16 rounded object-cover" />
      <span data-ghost-label className="truncate text-[10px] text-neutral-200" />
    </div>
  )
}
