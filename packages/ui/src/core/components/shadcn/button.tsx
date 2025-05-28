import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { VTooltip } from "./tooltip"

import { cn } from "../libs/utils"
import { Check, Files, Loader2 } from "lucide-react"
import clsx from "clsx"
import { useState } from "react"

const buttonVariants = cva(
  "hover:cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        destructive:
          "bg-destructive dark:bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive-muted/50 dark:ring-destructive-muted/50 shadow-xs hover:bg-destructive/50",
        outline:
          "border border-input bg-background shadow-xs hover:bg-muted ring-inset",
        secondary:
          "bg-primary/5 dark:bg-primary/10 text-primary shadow-xs hover:bg-primary/10 dark:hover:bg-primary/20 ring-inset",
        ghost: "hover:bg-muted/50 dark:hover:bg-muted/20 ring-inset",
        link: "text-white underline-offset-4 hover:underline ring-inset",
        primary:
          "bg-primary text-white shadow-xs hover:bg-primary/90 ring-inset",
        unstyled:
          ""
      },
      size: {
        xs: 'h-7 rounded px-2 py-1 text-xs gap-x-1',
        sm: "h-8 rounded px-2 text-xs",
        md: "h-9 rounded-md px-4 py-2",
        lg: "h-10 rounded-md px-3",
        xl: 'rounded-md px-3.5 py-2.5 text-sm gap-x-2',
        icon: "p-0 m-0 rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
  alt?: string
  title?: string
  isDisabled?: boolean
  isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, alt, isDisabled, isLoading, title, onClick, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const buttonElement = (
      <Comp
        className={clsx(
          className,
          cn(buttonVariants({ variant, size }))
        )}
        disabled={isDisabled || isLoading || props.disabled}
        ref={ref}
        onClick={onClick}
        type={type}
        autoFocus={false}
        {...props}
      >
        {isLoading && <Loader2 className="animate-spin" />}
        {props.children}
      </Comp>
    )

    if (alt || title) {
      return (
        <VTooltip
          description={alt || title}
          asChild
          className="cursor-pointer"
          size="xs"
          placement="top"
        >
          {buttonElement}
        </VTooltip>
      )
    }

    return buttonElement
  }
)
Button.displayName = "Button"

interface CopyButtonProps {
  content: string
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "icon"
  toast?: {
    toast: any,
    message: string
  }
  className?: string
}

const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  ({ size, content, toast, className, ...props }, ref) => {

    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = () => {
      navigator.clipboard.writeText(content).then(() => {
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
        if (!toast || !toast.toast) {
          return
        }
        toast.toast({
          status: "success",
          title: toast.message || "Copied to clipboard",
          duration: 2000,
        })
      }).catch((err) => {
        console.error("Failed to copy text: ", err)
        if (toast && toast.toast)
          toast.toast({
            status: "error",
            title: "Failed to copy",
            duration: 2000,
          })
      })
    }

    return (
      <Button
        ref={ref}
        className={cn(className)}
        variant={"unstyled"}
        size={size || "sm"}
        onClick={handleCopy}
        {...props}
      >
        {isCopied ? 
          <Check className="text-success" />
          :
          <Files className="size-4" />
        }
      </Button>
    )
  }
)
CopyButton.displayName = "CopyButton"

export { Button, CopyButton, buttonVariants }