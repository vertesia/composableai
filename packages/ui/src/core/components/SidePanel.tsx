import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, X } from 'lucide-react';
import { Button } from './shadcn/button';

interface SidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
    panelWidth?: number;
    backdrop?: boolean;
    side?: 'left' | 'right';
    resizable?: boolean;
    className?: string;
}
export function SidePanel({ isOpen, title, onClose, children, panelWidth = 768, backdrop = false, side = 'right', resizable = true, className }: SidePanelProps) {
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

    const isLeft = side === 'left';
    const positionClass = isLeft ? 'left-0' : 'right-0';
    const paddingClass = isLeft ? 'pr-10 sm:pr-16' : 'pl-10 sm:pl-16';
    const borderClass = isLeft ? 'border-r' : 'border-l';
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
                                            <div
                                                className={`absolute ${dragHandleClass} top-0 bottom-0 w-3 cursor-ew-resize hover:bg-indigo-500 transition-colors flex items-center justify-center`}
                                                onMouseDown={handleDragStart}
                                            >
                                                <Minus className="rotate-90 font-semibold" strokeWidth={4} />
                                            </div>
                                        )}
                                        <div className={`flex-1 flex flex-col overflow-y-scroll gap-4 bg-background py-2 shadow-xl ${className}`}>
                                            {title && (
                                                <div className="px-2 sm:px-4">
                                                    <div className="flex items-start justify-between">
                                                        <h2 className="w-full text-base font-semibold leading-6">
                                                            <div className="text-2xl">{title ?? ""}</div>
                                                        </h2>
                                                        <div className="ml-3 flex h-7 items-center">
                                                            <CloseButton onClose={onClose} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="px-2 sm:px-4">
                                                {children}
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