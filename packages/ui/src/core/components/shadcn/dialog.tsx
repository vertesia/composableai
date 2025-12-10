import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "../libs/utils";

import { X } from "lucide-react";
import { Button } from "./button";
import { VisuallyHidden } from "../libs/visuallyHidden";
import { createContext, useContext } from "react";

interface ModalProps {
    children: React.ReactNode | React.ReactNode[];
    isOpen: boolean;
    onClose: () => void;
    description?: string;
    noCloseButton?: boolean;
    className?: string;
    allowOverflow?: boolean;
    disableCloseOnClickOutside?: boolean;
    size?: "sm" | "md" | "lg" | "xl";
}
const ModalContext = createContext<boolean>(false)
export function useIsInModal() {
    return !!useContext(ModalContext);
}
export function ModalContextProvider({ children }: { children: React.ReactNode }) {
    return <ModalContext.Provider value={true}>{children}</ModalContext.Provider>
}

export function VModal({
    className,
    children,
    isOpen,
    onClose,
    description = "Modal Description",
    noCloseButton = false,
    allowOverflow = false,
    disableCloseOnClickOutside = false,
    size = "md",
}: ModalProps) {
    const handleOpenChange = (open: boolean) => {
        if (!open) {
            onClose();
        }
    };
    function getSizeClasses() {
        switch (size) {
            case "sm":
                return "max-w-[20vw]";
            case "md":
                return "max-w-[40vw]";
            case "lg":
                return "max-w-[60vw]";
            case "xl":
                return "max-w-[80vw]";
            default:
                return "max-w-[40vw]";
        }
    }

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!disableCloseOnClickOutside || open) {
                    handleOpenChange(open);
                }
            }}
            
        >
            {allowOverflow && <DialogOverlay className="z-50 fixed inset-0 bg-black/80" />}
            <VisuallyHidden>
                <DialogDescription>{description}</DialogDescription>
            </VisuallyHidden>
            <DialogContent
                className={cn(
                    "min-h-20 p-4",
                    "fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] border bg-background shadow-lg duration-200 sm:rounded-lg",
                    getSizeClasses(),
                    className
                )}
            >
                {!noCloseButton && (
                    <DialogClose onClick={() => handleOpenChange(false)} asChild autoFocus={false}>
                        <Button
                            variant="outline"
                            alt="Close"
                            className="top-4 right-4 absolute data-[state=open]:bg-accent opacity-70 hover:opacity-100 rounded-sm focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background focus:ring-offset-2 data-[state=open]:text-muted-foreground transition-opacity disabled:pointer-events-none"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </DialogClose>
                )}
                <ModalContextProvider>
                    {children}
                </ModalContextProvider>
            </DialogContent>
        </Dialog>
    );
}

export const VModalTitle = ({
    children,
    show = true,
    className,
    description,
    ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { show?: boolean; description?: string }) => {
    if (!show) {
        return (
            <VisuallyHidden>
                <DialogTitle>{children}</DialogTitle>
                {description && <DialogDescription>{description}</DialogDescription>}
            </VisuallyHidden>
        )
    }
    return (
        <>
            <DialogTitle
                className={cn("text-lg font-semibold leading-6 tracking-tight", { 'py-2': !description }, className)}
                {...props}
            >
                {children}
                {description && (
                    <DialogDescription className="text-sm !font-normal text-muted-foreground pb-2">
                        {description}
                    </DialogDescription>
                )}
            </DialogTitle>
        </>
    );
};

export const VModalBody = ({
    children,
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
    return (
        <div className={cn("text-sm max-h-[80vh] overflow-y-auto", className)} {...props}>
            {children}
        </div>
    );
};

interface ModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {
    align?: "left" | "right" | "center";
}

export const VModalFooter = ({
    align = "right",
    children,
    className,
    ...props
}: ModalFooterProps) => {
    const alignClass = {
        left: "justify-start",
        center: "justify-center",
        right: "justify-end",
    };
    return (
        <div
            className={cn(
                "w-full flex py-3 sm:py-2 sm:flex sm:flex-row-reverse sm:flex-row sm:justify-end sm:space-x-2",
                alignClass[align],
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            className
        )}
        {...props}
    />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
    <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
            ref={ref}
            autoFocus={false}
            onOpenAutoFocus={(event) => {
                event.preventDefault();
            }}
            className={cn(
                "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
                className
            )}
            {...props}
        >
            {children}
        </DialogPrimitive.Content>
    </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogDescription = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn("text-sm text-muted", className)}
        {...props}
    />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

const DialogTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn(
            "text-lg font-semibold leading-none tracking-tight",
            className
        )}
        {...props}
    />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName


export {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogClose,
    DialogTrigger,
    DialogContent,
    DialogTitle,
    DialogDescription,
};