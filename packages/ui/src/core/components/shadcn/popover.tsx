import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "../libs/utils"
import { JSX } from "react";
import { useIsInModal } from "./dialog";

export interface PopoverContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  hover: boolean;
  click: boolean;
}
export const PopoverContext = React.createContext<PopoverContextValue | null>(null);

interface PopoverProps {
  _open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hover?: boolean;
  click?: boolean;
  children?: React.ReactNode;
}
const Popover = ({ hover = false, click = false, children, _open, onOpenChange }: PopoverProps): JSX.Element => {
  const [open, setOpen] = React.useState(_open || false);
  const insideModal = useIsInModal();

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (onOpenChange) {
      onOpenChange(open);
    }
  };

  return (
    <PopoverContext.Provider value={{ open, setOpen, hover, click }}>
      <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange} modal={insideModal}>
        {children}
      </PopoverPrimitive.Root>
    </PopoverContext.Provider>
  );
};

function handleHover(hover: boolean = false, setOpen: React.Dispatch<React.SetStateAction<boolean>> = () => { }, type: "enter" | "leave") {
  if (hover) {
    setOpen(type === "enter");
  }
}

const PopoverTrigger = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>
>(({ children, ...props }, ref) => {
  const context = React.useContext(PopoverContext);

  if (!context) {
    throw new Error("PopoverTrigger must be used within a Popover");
  }

  const { setOpen, hover, click } = context;

  return (
    <PopoverPrimitive.Trigger
      ref={ref}
      asChild
      onMouseEnter={() => handleHover(hover, setOpen, "enter")}
      onMouseLeave={() => handleHover(hover, setOpen, "leave")}
      onClick={() => {
        if (click) setOpen((prev) => !prev);
      }}
      {...props}
    >
      {children}
    </PopoverPrimitive.Trigger>
  );
});
PopoverTrigger.displayName = PopoverPrimitive.Trigger.displayName;

const PopoverAnchor = PopoverPrimitive.Anchor;
const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", side = "bottom", ...props }, ref) => {
  const context = React.useContext<PopoverContextValue | null>(PopoverContext);

  if (!context) {
    throw new Error("PopoverContent must be used within a Popover");
  }

  const { setOpen, hover } = context;

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        side={side}
        onMouseEnter={() => handleHover(hover, setOpen, "enter")}
        onMouseLeave={() => handleHover(hover, setOpen, "leave")}
        // onClick={() => {setOpen(false)}}
        className={cn(
          "z-50 w-72 rounded-md border-popover bg-popover text-popover-foreground ring-1 ring-gray-200 dark:ring-slate-700 shadow-md focus:outline-none animate-in",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

const PopoverClose = PopoverPrimitive.Close;
PopoverClose.displayName = PopoverPrimitive.Close.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverClose };