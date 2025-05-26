import clsx from "clsx";
import { Fragment } from "react";

import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import { X } from "lucide-react";

interface ModalProps {
    children: React.ReactNode | React.ReactNode[];
    isOpen: boolean;
    onClose: () => void;
    noCloseButton?: boolean;
    className?: string;
    allowOverflow?: boolean;
    disableCloseOnClickOutside?: boolean;
}
export function Modal({
    className,
    children,
    isOpen,
    onClose,
    noCloseButton = false,
    allowOverflow = false,
    disableCloseOnClickOutside = false,
}: ModalProps) {
    const setOpen = (open: boolean) => {
        if (!open) {
            onClose();
        }
    };

    return (
        <Transition show={isOpen} as={Fragment}>
            <Dialog
                style={{ zIndex: 50 }}
                as="div"
                className="relative"
                onClose={disableCloseOnClickOutside ? () => { } : setOpen}
            >
                <TransitionChild
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                    unmount
                >
                    <div className="fixed inset-0 bg-gray-500  dark:bg-slate-800 dark:opacity-75 opacity-75 transition-opacity" />
                </TransitionChild>

                <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <TransitionChild
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <DialogPanel
                                className={clsx(
                                    "p-0! relative transform rounded-lg bg-white dark:bg-slate-900 text-left dark:text-slate-100 shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:p-6",
                                    allowOverflow ? "overflow-visible" : "overflow-hidden",
                                    className,
                                )}
                            >
                                {!noCloseButton && <ModalCloseButton onClose={onClose} />}
                                {children}
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}

interface ModalCloseButtonProps {
    onClose: () => void;
}
function ModalCloseButton({ onClose }: ModalCloseButtonProps) {
    return (
        <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
            <button
                tabIndex={-1}
                type="button"
                className="rounded-md bg-white text-gray-400 dark:text-slate-200 dark:bg-slate-800 hover:brightness-95 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 hover:cursor-pointer"
                onClick={onClose}
            >
                <span className="sr-only">Close</span>
                <X className="size-6" aria-hidden="true" />
            </button>
        </div>
    );
}

interface ModalTitleProps {
    children: React.ReactNode | React.ReactNode[];
    showDivider?: boolean;
}
export function ModalTitle({ children, showDivider = false }: ModalTitleProps) {
    return (
        <div className={showDivider ? "border-b-solid border-b border-b-1" : ""}>
            <DialogTitle
                as="h3"
                className="py-4 pl-4 pr-8 text-base font-semibold leading-6 text-gray-900 dark:text-slate-50"
            >
                {children}
            </DialogTitle>
        </div>
    );
}

interface ModalFooterProps {
    showDivider?: boolean;
    fill?: boolean;
    justify?: "start" | "end" | "center" | "space-between" | "space-around" | "space-evenly" | "stretch";
    className?: string;
    children: React.ReactNode | React.ReactNode[];
}
export function ModalFooter({ children, className = "justify-end", fill = false }: ModalFooterProps) {
    return (
        <div
            className={clsx(
                "w-full flex space-x-2 p-4 border-t-solid border-t-gray-100 dark:border-t-gray-800 border-t",
                className || "justify-end",
                fill ? "bg-gray-100 dark:bg-slate-800" : "",
            )}
        >
            {children}
        </div>
    );
}

interface ModalBodyProps {
    children: React.ReactNode | React.ReactNode[];
    className?: string;
}
export function ModalBody({ children, className = "" }: ModalBodyProps) {
    return <div className={clsx("p-4", className)}>{children}</div>;
}
