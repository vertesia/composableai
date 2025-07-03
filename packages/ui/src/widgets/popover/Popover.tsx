import { flip, offset, shift } from "@floating-ui/dom";
import {
    FloatingFocusManager,
    FloatingPortal,
    Middleware,
    Placement,
    UseClickProps,
    UseDismissProps,
    UseHoverProps,
    UseTransitionStylesProps,
    autoUpdate,
    safePolygon,
    useClick,
    useDismiss,
    useFloating,
    useHover,
    useInteractions,
    useTransitionStyles
} from "@floating-ui/react";
import clsx from "clsx";
import { ReactElement, ReactNode, useState } from "react";
import { PopoverContext } from "./context";
import { defineSlot, processSlots } from "./slots";



function computeElementProps<T extends { enabled?: boolean }>(value: undefined | boolean | T) {
    if (!value) return { enabled: false } as T;
    return (typeof value === 'boolean' ? { enabled: value } : value) as T
}

function getHoverProps(props: PopoverTriggerProps | undefined) {
    return props?.hover === true ? {
        enabled: true,
        handleClose: safePolygon({ blockPointerEvents: true }),
        restMs: 0,
    } : props?.hover
}

function getClickProps(props: PopoverTriggerProps | undefined) {
    return props && !props.hover && !props.click ? {
        enabled: true,
    } : props?.click
}

interface BasePopoverProps {
    strategy?: "fixed" | "absolute"
    placement?: Placement,
    middleware?: Middleware[],
    zIndex?: number,
    dismiss?: boolean | UseDismissProps,
    offset?: number
}

interface PopoverProps extends BasePopoverProps {
    children: ReactNode | Iterable<ReactNode>
}
/**
 * The component is instantiated when all interactions are known
 * @param param0
 * @returns
 */
export function Popover(props: PopoverProps) {

    const slots: { trigger?: ReactElement, content?: ReactElement } = {};
    processSlots(props.children, slots);

    if (!slots.content) {
        throw new Error('Popover must provide a content slot')
    }

    const triggerProps = slots.trigger?.props as PopoverTriggerProps;
    const contentProps = slots.content.props as PopoverContentProps;

    // wait for the trigger to be defined
    return <ResolvedPopover {...props}
        trigger={triggerProps}
        content={contentProps}
    />
}


interface ResolvedPopoverProps extends BasePopoverProps {
    trigger?: PopoverTriggerProps
    content: PopoverContentProps
}
function ResolvedPopover({ middleware, offset: defaultOffset, trigger, dismiss = true, content, placement, strategy, zIndex = 40 }: ResolvedPopoverProps) {
    const [isOpen, setIsOpen] = useState(false)
    const floating = useFloating({
        open: isOpen,
        placement,
        strategy,
        onOpenChange: setIsOpen,
        middleware: middleware || [offset(defaultOffset || 4), shift(), flip()],
        whileElementsMounted: autoUpdate // stick to the anchor when resizing / scrolling
    })


    const {
        floatingStyles,
        refs: { setReference, setFloating },
        context,
    } = floating;


    const dismissInteraction = useDismiss(context, computeElementProps(dismiss))
    const clickInteraction = useClick(context, computeElementProps(getClickProps(trigger)))
    const hoverInteraction = useHover(context, computeElementProps(getHoverProps(trigger)))

    const {
        getReferenceProps,
        getFloatingProps,
    } = useInteractions([dismissInteraction, clickInteraction, hoverInteraction]);

    const { isMounted, styles: transitionStyles } = useTransitionStyles(context, content.transition);

    return (
        <PopoverContext.Provider value={{
            ...floating,
            close: () => setIsOpen(false)
        }}>
            {trigger &&
                <div className={clsx(trigger.className, "inline-block")} ref={setReference} {...getReferenceProps()}>
                    {trigger.children}
                </div>
            }
            <FloatingPortal>
                {
                    isMounted && (
                        <div ref={setFloating}
                            style={{ ...floatingStyles, zIndex: zIndex }}
                            {...getFloatingProps()}
                        >
                            <FloatingFocusManager context={context}>
                                <div className={clsx(content.className, "bg-popover rounded-md text-popover-foreground max-w-md")} style={transitionStyles}>
                                    {content.children}
                                </div>
                            </FloatingFocusManager>
                        </div>
                    )
                }
            </FloatingPortal>
        </PopoverContext.Provider>
    )
}



interface PopoverTriggerProps {
    children: ReactNode | ReactNode[]
    className?: string
    click?: boolean | UseClickProps
    hover?: boolean | UseHoverProps
}
function PopoverTrigger(_props: PopoverTriggerProps) {
    return null;
}
defineSlot('trigger', PopoverTrigger);

interface PopoverContentProps {
    className?: string
    transition?: UseTransitionStylesProps
    children: ReactNode | ReactNode[]
}
function PopoverContent(_props: PopoverContentProps) {
    return null;
}
defineSlot('content', PopoverContent);

Popover.Trigger = PopoverTrigger;
Popover.Content = PopoverContent;
