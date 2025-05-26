import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../libs/utils"
import { X } from "lucide-react";
import { ChangeEvent } from "react";

const variants = cva(
  "",
  {
    variants: {
      size: {
        xs: "rounded py-1 text-xs rounded-xs",
        sm: "rounded text-xs rounded-sm",
        md: "rounded-md py-2 text-sm",
        lg: "rounded-md text-base",
        xl: "rounded-md py-2.5 text-lg",
      },
      variant: {
        default: "flex w-full rounded-md border border-input bg-background py-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        unstyled: "block m-0 p-0 w-full border-0 focus:outline-hidden focus:ring-0 bg-transparent",
        noPadding: "block rounded-md border-0 bg-background shadow-2xs ring-1 ring-inset ring-ring placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-ring ring-offset-background",
        legacy: "py-1.5 block rounded-md border-0 bg-background shadow-2xs ring-1 ring-inset ring-ring placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-ring ring-offset-background",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "default",
    },
  }
)

type InputVariant = "default" | "unstyled" | "noPadding" | "legacy";

export interface VInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange'> {
  size?: VariantProps<typeof variants>["size"];
  variant?: InputVariant;
  clearable?: boolean;
  value?: string;
  onChange?: (value: string) => void
}

const VInput = React.forwardRef<HTMLInputElement, VInputProps>(
  ({ className, type, size = "md", variant = "default", clearable = true, onChange, value, ...props }, ref) => {

    const _onClear = () => {
      onChange && onChange('');
    };

    const _onChange = (ev: ChangeEvent<HTMLInputElement>) => {
      onChange && onChange(ev.target.value);
    };

    return (
      <div className="w-full" style={{ position: 'relative', display: 'inline-block' }}>
        <input
          type={type}
          className={
            cn(
              variants({ size, variant }),
              className,
              clearable && value ? "pr-6" : "",
            )}
          ref={ref}
          value={value == null ? '' : value}
          onChange={_onChange}
          {...props}
        />
        {clearable && value && !props.readOnly && !props.disabled && (
          <button
            onClick={_onClear}
            className={`absolute ${type !== 'number' ? 'right-0' : 'right-7'} top-1/2 -translate-y-1/2 size-7 text-muted-foreground hover:text-destructive cursor-pointer flex items-center justify-center`}
            type="button"
            aria-label="Clear input"
          >
            <X size={16} />
          </button>
        )}
      </div>
    )
  }
)

VInput.displayName = "VInput"

export {
  VInput,
}
