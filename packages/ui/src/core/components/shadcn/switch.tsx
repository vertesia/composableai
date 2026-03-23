"use client"

import { Switch as SwitchPrimitive } from "@radix-ui/react-switch"
import * as React from "react"

import { cn } from "../libs/utils"

const sizes = {
  'sm': ['h-5 w-8', 'size-3', 'translate-x-4'],
  'md': ['h-6 w-11', 'size-4', 'translate-x-6'],
  'lg': ['h-8 w-16', 'size-6', 'translate-x-9'],
}

interface SwitchProps {
  size?: 'sm' | 'md' | 'lg'
  value: boolean
  onChange: (value: boolean) => void
  children?: React.ReactNode
  className?: string
  disabled?: boolean
}

function Switch({ className, size = 'md', value, onChange, children, disabled }: SwitchProps) {
  const [trackSize, thumbSize, thumbTranslate] = sizes[size]
  const switchEl = (
    <SwitchPrimitive.Root
      data-slot="switch"
      checked={value}
      onCheckedChange={onChange}
      disabled={disabled}
      className={cn(
        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 shrink-0 rounded-full border focus-visible:ring-3 aria-invalid:ring-3 peer group/switch relative inline-flex items-center transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        trackSize,
        !children && className
      )}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-white rounded-full pointer-events-none block ring-0 transition-transform",
          thumbSize,
          value ? thumbTranslate : 'translate-x-1',
        )}
      />
    </SwitchPrimitive.Root>
  )

  if (children) {
    return (
      <div className={cn("flex items-center", className)}>
        {switchEl}
        <span className="px-2">{children}</span>
      </div>
    )
  }

  return switchEl
}

export { Switch }
