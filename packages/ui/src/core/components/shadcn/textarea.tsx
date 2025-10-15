import * as React from "react"

import { cn } from "../libs/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "py-2 text-sm",
        "flex w-full rounded-md border border-input bg-background ring-offset-background",
        "placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 ring-inset focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
