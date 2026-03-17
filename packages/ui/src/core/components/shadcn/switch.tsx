"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "../libs/utils"

interface SwitchProps {
  size?: 'sm' | 'md' | 'lg'
  value: boolean
  onChange: (value: boolean) => void
  children?: React.ReactNode
  className?: string
  disabled?: boolean
}

function Switch({ className, size = 'md', value, onChange, children, disabled }: SwitchProps) {
  const radixSize = size === 'lg' ? 'default' : size === 'md' ? 'default' : 'sm'
  const switchEl = (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={radixSize}
      checked={value}
      onCheckedChange={onChange}
      disabled={disabled}
      className={cn(
        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 shrink-0 rounded-full border focus-visible:ring-3 aria-invalid:ring-3 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] peer group/switch relative inline-flex items-center transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        !children && className
      )}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="bg-white rounded-full group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 pointer-events-none block ring-0 transition-transform"
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
