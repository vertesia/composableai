"use client"

import { RadioGroup as RadioGroupPrimitive } from "@radix-ui/react-radio-group"
import * as React from "react"

import { cn } from "../libs/utils"

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "border-input dark:bg-input/30 data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary data-checked:border-primary aria-invalid:aria-checked:border-primary aria-invalid:border-destructive focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 dark:aria-invalid:border-destructive/50 flex size-4 rounded-full focus-visible:ring-3 aria-invalid:ring-3 group/radio-group-item peer relative aspect-square shrink-0 border outline-none after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex size-4 items-center justify-center"
      >
        <span className="bg-primary-foreground absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

interface RadioGroupOption {
  id: string
  label: string
  description?: React.ReactNode
}

export abstract class RadioGroupAdapter<T> {
  abstract idOf(item: T): string
  abstract labelOf(item: T): string
  descriptionOf(_item: T): React.ReactNode { return undefined }
  selectedClassName(_item: T): string { return 'border-accent-foreground' }
}

interface RadioGroupProps<T = RadioGroupOption> {
  options: T[]
  selected?: T
  onSelect: (option: T) => void
  adapter?: RadioGroupAdapter<T>
}

function RadioGroup<T = RadioGroupOption>({ onSelect, selected, options, adapter }: RadioGroupProps<T>) {
  const getId = (o: T) => adapter ? adapter.idOf(o) : (o as unknown as RadioGroupOption).id
  const getLabel = (o: T) => adapter ? adapter.labelOf(o) : (o as unknown as RadioGroupOption).label
  const getDescription = (o: T) => adapter ? adapter.descriptionOf(o) : (o as unknown as RadioGroupOption).description
  const getSelectedClass = (o: T) => adapter ? adapter.selectedClassName(o) : 'border-accent-foreground'

  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      value={selected ? getId(selected) : undefined}
      onValueChange={(id) => {
        const option = options.find((o) => getId(o) === id)
        if (option) onSelect(option)
      }}
      className="space-y-4"
    >
      {options.map((option) => {
        const isSelected = selected ? getId(selected) === getId(option) : false
        return (
          <RadioGroupPrimitive.Item
            key={getId(option)}
            value={getId(option)}
            className={cn(
              'relative block w-full cursor-pointer rounded-lg border border-border bg-accent px-6 py-4 shadow-2xs text-left',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'sm:flex sm:justify-between',
              isSelected && getSelectedClass(option),
            )}
          >
            <span className="flex items-center">
              <span className="flex flex-col text-sm">
                <span className="font-medium text-text">{getLabel(option)}</span>
                {getDescription(option) && (
                  <span className="text-muted-foreground">{getDescription(option)}</span>
                )}
              </span>
            </span>
          </RadioGroupPrimitive.Item>
        )
      })}
    </RadioGroupPrimitive.Root>
  )
}

/** @deprecated use RadioGroupAdapter */
export const RadioOptionAdapter = RadioGroupAdapter

export { RadioGroup, RadioGroupItem }
export type { RadioGroupOption, RadioGroupProps }

