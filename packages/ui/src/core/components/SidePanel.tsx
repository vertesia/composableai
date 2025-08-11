

import { useState, Fragment } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { X } from 'lucide-react';
import { Button } from './shadcn/button';

interface SidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
    panelWidth?: number;
}
export function SidePanel({ isOpen, title, onClose, children, panelWidth = 768 }: SidePanelProps) {
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

    return (
        <Transition show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-10" onClose={onClose}>
                <div className="fixed inset-y-0 right-0" />
                <div className="fixed inset-y-0 right-0 overflow-hidden">
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
                            <TransitionChild
                                as={Fragment}
                                enter="transform transition ease-in-out duration-500 sm:duration-700"
                                enterFrom="translate-x-full"
                                enterTo="translate-x-0"
                                leave="transform transition ease-in-out duration-500 sm:duration-700"
                                leaveFrom="translate-x-0"
                                leaveTo="translate-x-full"
                                unmount={true}
                            >
                                <DialogPanel
                                    className="pointer-events-auto border-l"
                                    style={{ width: `${_panelWidth}px` }}
                                >
                                    <div className="relative flex h-full">
                                        {/* Drag Handle */}
                                        <div
                                            className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-indigo-500 transition-colors"
                                            onMouseDown={handleDragStart}
                                        />
                                        <div className="flex-1 flex flex-col overflow-y-scroll gap-4 bg-background py-6 shadow-xl">
                                            <div className="px-2 sm:px-4">
                                                <div className="flex items-start justify-between">
                                                    <DialogTitle className="w-full text-base font-semibold leading-6">
                                                        <div className="text-2xl">{title ?? ""}</div>
                                                    </DialogTitle>
                                                    <div className="ml-3 flex h-7 items-center">
                                                        <CloseButton onClose={onClose} />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="px-2 sm:px-4">
                                                {children}
                                            </div>
                                        </div>
                                    </div>
                                </DialogPanel>
                            </TransitionChild>
                        </div>
                    </div>
                </div>
            </Dialog>
        </Transition>
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