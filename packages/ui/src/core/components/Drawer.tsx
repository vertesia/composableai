import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import { X } from "lucide-react";
import React from "react";
import { Fragment } from "react/jsx-runtime";

interface DrawerProps {
    isOpen?: boolean;
    onClose: () => void;
}
interface DrawerProps {
    title: React.ReactNode;
    isOpen?: boolean;
    onClose: () => void;
    children: React.ReactNode;
}
export function Drawer({ title, isOpen = false, onClose, children }: DrawerProps) {
    return (
        <Transition show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-10" onClose={onClose}>
                <div className="fixed inset-0" />

                <div className="fixed inset-0 overflow-hidden">
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
                                <DialogPanel className="pointer-events-auto w-screen max-w-3xl border-l">
                                    <div className="relative flex h-full flex-col overflow-y-scroll bg-background px-4 py-4 shadow-xl">
                                        <div className="flex items-start justify-between">
                                            <DialogTitle className="w-full text-base font-semibold leading-6">
                                                <div className="text-2xl">{title}</div>
                                            </DialogTitle>
                                            <CloseButton onClose={onClose} />
                                        </div>
                                        {children}
                                    </div>
                                </DialogPanel>
                            </TransitionChild>
                        </div>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}

function CloseButton({ onClose }: { onClose: () => void }) {
    return (
        <button
            type="button"
            className="relative rounded-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            onClick={onClose}
        >
            <span className="absolute -inset-2.5" />
            <span className="sr-only">Close panel</span>
            <X className="size-6" aria-hidden="true" />
        </button>
    )
}