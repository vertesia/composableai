import { useLayoutEffect, useRef, useCallback } from "react"

import { cn } from "../libs/utils"

interface TextareaProps extends React.ComponentProps<"textarea"> {
  minLines?: number
  maxLines?: number
}

function Textarea({ className, minLines, maxLines, value, ...props }: TextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const growing = minLines !== undefined || maxLines !== undefined

  const resize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return

    const style = getComputedStyle(el)
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5
    const paddingTop = parseFloat(style.paddingTop) || 0
    const paddingBottom = parseFloat(style.paddingBottom) || 0
    const paddingY = paddingTop + paddingBottom
    const borderTop = parseFloat(style.borderTopWidth) || 0
    const borderBottom = parseFloat(style.borderBottomWidth) || 0
    const borderY = borderTop + borderBottom

    const effectiveMin = minLines ?? 1
    const effectiveMax = maxLines ?? Infinity
    const minHeight = effectiveMin * lineHeight + paddingY + borderY
    const maxHeight = effectiveMax === Infinity ? Infinity : effectiveMax * lineHeight + paddingY + borderY

    el.style.height = "auto"

    const contentHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)
    el.style.height = `${contentHeight}px`
    el.style.overflowY = maxHeight !== Infinity && el.scrollHeight > maxHeight ? "auto" : "hidden"
  }, [minLines, maxLines])

  useLayoutEffect(() => {
    if (growing) resize()
  }, [value, growing, resize])

  return (
    <textarea
      ref={textareaRef}
      data-slot="textarea"
      value={value}
      className={cn(
        "py-2 text-sm",
        "flex w-full rounded-md border border-input bg-background ring-offset-background",
        "placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 ring-inset focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        growing && "resize-none",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
export type { TextareaProps }
