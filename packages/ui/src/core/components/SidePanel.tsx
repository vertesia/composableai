import type React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, X } from 'lucide-react';
import { Button } from './shadcn/button';

interface SidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: React.ReactNode;
    panelWidth?: number;
    backdrop?: boolean;
    side?: 'left' | 'right';
    resizable?: boolean;
    className?: string;
    contentClassName?: string;
}
export function SidePanel({ isOpen, title, onClose, children, panelWidth = 768, backdrop = false, side = 'right', resizable = true, className, contentClassName }: SidePanelProps) {
    const [_panelWidth, setPanelWidth] = useState(panelWidth);

    const handleDragStart = (e: React.MouseEvent) => {
        e.preventDefault();

        let isDragging = true;
        const startX = e.pageX;
        const startWidth = _panelWidth;

        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                const deltaX = startX - e.pageX;
                const newWidth = Math.max(startWidth + deltaX, 480);
                setPanelWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // The `side` prop is PHYSICAL ('left' | 'right') — the panel anchors to
    // that physical edge regardless of dir. Callers that want a logical
    // start-anchored panel in RTL should pass `side='right'` explicitly (see
    // AppLayout.tsx). Using physical classes here keeps the contract honest;
    // the codemod (and inventory in strict mode) is exempted via rtl-ok.
    const isLeft = side === 'left';
    // rtl-ok: physical-side prop maps 1:1 to physical CSS
    const positionClass = isLeft ? 'left-0' : 'right-0';
    // rtl-ok: padding/border/drag-handle mirror the physical side of the panel
    const paddingClass = isLeft ? 'pr-10 sm:pr-16' : 'pl-10 sm:pl-16';
    // rtl-ok: see above
    const borderClass = isLeft ? 'border-r' : 'border-l';
    // rtl-ok: see above
    const dragHandleClass = isLeft ? '-right-1' : '-left-1';
    const initialX = isLeft ? "-100%" : "100%";

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="relative z-20">
                    {/* Backdrop */}
                    {backdrop && (
                        <motion.div
                            className="fixed inset-0 bg-black/70"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                        />
                    )}

                    <div className={`fixed inset-y-0 ${positionClass} overflow-hidden`}>
                        <div className="absolute inset-0 overflow-hidden">
                            <div className={`pointer-events-none fixed inset-y-0 ${positionClass} flex max-w-full ${paddingClass}`}>
                                <motion.div
                                    className={`pointer-events-auto ${borderClass}`}
                                    style={{ width: `${_panelWidth}px` }}
                                    initial={{ x: initialX }}
                                    animate={{ x: 0 }}
                                    exit={{ x: initialX }}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                >
                                    <div className="relative flex h-full">
                                        {/* Drag Handle */}
                                        {resizable && (
                                            // biome-ignore lint/a11y/noStaticElementInteractions: drag handle is pointer-only (no keyboard equivalent for continuous resize); ARIA role omitted to avoid useAriaPropsForRole false positive.
                                            // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-label kept for AT users; div has no semantic role because separator/slider would require valuenow/min/max
                                            <div
                                                aria-label="Resize panel"
                                                className={`absolute ${dragHandleClass} top-0 bottom-0 w-3 cursor-ew-resize hover:bg-indigo-500 transition-colors flex items-center justify-center`}
                                                onMouseDown={handleDragStart}
                                            >
                                                <Minus className="rotate-90 font-semibold" strokeWidth={4} />
                                            </div>
                                        )}
                                        <div className={`flex-1 min-w-0 flex flex-col bg-background shadow-xl ${className}`}>
                                            {/* Sticky header */}
                                            {title && (
                                                <div className="sticky top-0 z-10 bg-background px-2 sm:px-4 py-2 border-b">
                                                    <div className="flex items-start justify-between">
                                                        <h2 className="w-full text-base font-semibold leading-6">
                                                            <div className="text-2xl">{title ?? ""}</div>
                                                        </h2>
                                                        <div className="ms-3 flex h-7 items-center">
                                                            <CloseButton onClose={onClose} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Scrollable content */}
                                            <div className={contentClassName ?? "flex-1 overflow-auto px-2 sm:px-4 py-4"}>
                                                <div className='w-full h-full flex-1 flex flex-col'>
                                                    {children}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
}

function CloseButton({ onClose }: { onClose: () => void }) {
    return (
        <Button alt="Close panel"
            variant="ghost"
            onClick={onClose}
        >
            <X className="size-6" aria-hidden="true" />
        </Button>
    )
}