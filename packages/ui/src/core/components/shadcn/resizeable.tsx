import { Minus } from 'lucide-react';
import type * as React from 'react';
import * as ResizablePrimitive from 'react-resizable-panels';

import { cn } from '../libs/utils';

type ResizablePanelGroupProps = Omit<React.ComponentProps<typeof ResizablePrimitive.Group>, 'orientation'> & {
    direction?: 'horizontal' | 'vertical';
    orientation?: 'horizontal' | 'vertical';
};

function ResizablePanelGroup({ className, direction = 'horizontal', orientation, ...props }: ResizablePanelGroupProps) {
    const resolvedOrientation = orientation ?? direction;

    return (
        <ResizablePrimitive.Group
            data-slot="resizable-panel-group"
            data-panel-group-direction={resolvedOrientation}
            orientation={resolvedOrientation}
            className={cn('flex h-full w-full data-[panel-group-direction=vertical]:flex-col', className)}
            {...props}
        />
    );
}

function ResizablePanel({ ...props }: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
    return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
    withHandle,
    className,
    ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & {
    withHandle?: boolean;
}) {
    return (
        <ResizablePrimitive.Separator
            data-slot="resizable-handle"
            className={cn(
                // rtl-ok: after:left-1/2 + after:-translate-x-1/2 is symmetric centering
                'bg-muted focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:start-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90',
                className,
            )}
            {...props}
        >
            {withHandle && (
                <div className="z-10 flex size-4 items-center justify-center rounded-xs font-semibold">
                    <Minus className="size-4 rotate-90" />
                </div>
            )}
        </ResizablePrimitive.Separator>
    );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
