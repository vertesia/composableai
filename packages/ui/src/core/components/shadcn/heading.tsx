import { cn } from "../libs/utils"
import { type HTMLAttributes, forwardRef } from "react"

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4 | 5 | 6
}

export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(({ className, level = 3, ...props }, ref) => {
  const Component = `h${level}` as const

  const styles = {
    h1: "text-2xl font-medium tracking-tight",
    h2: "text-xl font-medium tracking-tight",
    h3: "text-lg font-medium",
    h4: "text-base font-medium",
    h5: "text-sm font-medium",
    h6: "text-xs font-medium",
  }

  return <Component ref={ref} className={cn(styles[`h${level}`], 'mb-2', className)} {...props} />
})

Heading.displayName = "Heading"
