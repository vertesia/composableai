import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "./libs/utils";

// Base badge variants
const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "text-foreground bg-muted",
        secondary: "bg-secondary text-primary",
        destructive: "bg-destructive text-white dark:text-white",
        attention: "bg-attention text-white dark:text-gray-900",
        success: "bg-success text-white dark:text-gray-900",
        info: "bg-info text-white dark:text-gray-900",
        done: "bg-done text-white dark:text-gray-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// Base Badge props interface
interface BaseBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
  VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  onClick?: () => void;
}

// Base Badge component
export function Badge({ className, variant, children, onClick, ...props }: BaseBadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant }), className)}
      onClick={onClick}
      {...props}
    >
      {children}
    </span>
  )
}

const dotBadgeVariants = cva(
  // Base styles
  "inline-flex items-center gap-x-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ring-border",
  {
    variants: {
      variant: {
        default: "",
        success: "",
        destructive: "",
        attention: "",
        done: "",
        info: "",
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

// Separate dot variants to allow className overrides
const dotVariants = cva("h-1.5 w-1.5", {
  variants: {
    variant: {
      default: "fill-foreground",
      success: "fill-success",
      destructive: "fill-destructive",
      attention: "fill-attention",
      done: "fill-done",
      info: "fill-info",
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

interface DotBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
  VariantProps<typeof dotBadgeVariants> {
  children?: React.ReactNode;
  // Add specific dot className prop for backward compatibility
  dotClassName?: string;
}

export function DotBadge({
  variant,
  className,
  dotClassName, // New prop for dot-specific classes
  children,
  ...props
}: DotBadgeProps) {
  return (
    <span
      className={cn(dotBadgeVariants({ variant }), className)}
      {...props}
    >
      <div className="flex-shrink-0">
        <svg
          className={cn(dotVariants({ variant }), dotClassName)}
          viewBox="0 0 6 6"
          aria-hidden="true"
        >
          <circle cx={3} cy={3} r={3} />
        </svg>
      </div>
      <span className="truncate">
        {children}
      </span>
    </span>
  );
}
