import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn } from "../libs/utils"
import { ReactNode } from "react"

const TooltipProvider: typeof TooltipPrimitive.Provider = TooltipPrimitive.Provider

const Tooltip: typeof TooltipPrimitive.Root = TooltipPrimitive.Root

const TooltipTrigger: typeof TooltipPrimitive.Trigger = TooltipPrimitive.Trigger

type TooltipContentProps = React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
};

const TooltipContent: React.ForwardRefExoticComponent<TooltipContentProps & React.RefAttributes<React.ElementRef<typeof TooltipPrimitive.Content>>> = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(({ className, sideOffset = 4, side = "top", ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      side={side}
      style={{ zIndex: 100 }}
      className={cn(
        "max-w-[90vw]",
        "z-50 overflow-hidden rounded-md bg-tooltips border px-3 py-1.5 text-xs animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

interface TooltipPopoverProps {
  description?: ReactNode;
  children: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  placement?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  asChild?: boolean;
}
export function VTooltip({ description, children, size = 'sm', placement = 'top', className, asChild }: TooltipPopoverProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger className="cursor-pointer" asChild={asChild}>
          {children}
        </TooltipTrigger>
        <TooltipContent side={placement} className={`px-3 py-1.5 max-w-${size} text-${size} px-3 ${className}`}>
          {description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }