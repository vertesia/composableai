import { Transition } from "@headlessui/react"
import { CircleCheck, AlertTriangle, Info, CircleX, X } from "lucide-react"
import { Fragment, useEffect, useState } from "react"
import { ToastProps } from "./ToastProps.js"

const icons = {
    success: CircleCheck,
    error: CircleX,
    warning: AlertTriangle,
    info: Info
}

const colors = {
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600'
}

interface NotificationPanelProps {
    data: ToastProps
    onClose: () => void
}
export function NotificationPanel({ data, onClose }: NotificationPanelProps) {
    const [show, setShow] = useState(true)

    useEffect(() => {
        let timeoutId: any;
        if (data.duration) {
            timeoutId = setTimeout(() => {
                setShow(false)
            }, data.duration);
        }
        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    }, [])

    const Icon = icons[data.status] || Info;
    const color = colors[data.status] || 'text-blue-600';

    // Global notification live region, render this permanently at the end of the document
    return (
        <div
            aria-live="assertive"
            className="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:items-start sm:p-6 z-100"
        >
            <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
                {/* Notification panel, dynamically insert this into the live region when it needs to be displayed */}
                <Transition
                    appear={true}
                    show={show}
                    as={Fragment}
                    afterLeave={onClose}
                    enter="transform ease-out duration-700 transition"
                    enterFrom="translate-y-0 opacity-0 sm:translate-y-0 sm:translate-x-2"
                    enterTo="translate-y-2 opacity-100 sm:translate-x-0"
                    leave="transition ease-in duration-300"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                        <div className="p-4">
                            <div className="flex items-start">
                                <div className="shrink-0">
                                    <Icon className={`size-6 ${color}`} aria-hidden="true" />
                                </div>
                                <div className="ml-3 w-0 flex-1 pt-0.5">
                                    <p className="text-sm font-medium text-gray-900">{data.title}</p>
                                    <p className="mt-1 text-sm text-gray-500">{data.description}</p>
                                </div>
                                <div className="ml-4 flex shrink-0">
                                    <button
                                        type="button"
                                        className="inline-flex rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                        onClick={() => setShow(false)}
                                    >
                                        <span className="sr-only">Close</span>
                                        <X className="size-5" aria-hidden="true" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Transition>
            </div>
        </div>
    )
}