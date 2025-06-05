"use client"

import * as React from "react"
import DatePicker from "react-date-picker"

export type CalendarProps = React.ComponentProps<typeof DatePicker> & {
  size?: "sm" | "md" | "lg"
}

function Calendar({
  className,
  size = "md",
  ...props
}: CalendarProps) {
  const sizeClass = {
    sm: "text-sm",
    md: "text-base", 
    lg: "text-lg",
  }[size]

  return (
    <DatePicker
      className={`${className} ${sizeClass}`}
      calendarIcon={false}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
