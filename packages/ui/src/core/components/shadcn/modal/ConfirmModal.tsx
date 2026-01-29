import { TriangleAlert } from "lucide-react"
import React, { useRef } from "react"
import { VModal, VModalTitle, VModalFooter } from "./dialog"
import { Button } from "../button"

interface ConfirmModalProps {
    title: string
    content: string | React.ReactNode
    onConfirm: () => void
    onCancel: () => void
    isOpen: boolean
}

export function ConfirmModal({ title, content, onConfirm, onCancel, isOpen }: ConfirmModalProps) {
    const cancelButtonRef = useRef(null)

    return (
        <VModal isOpen={isOpen} onClose={onCancel} description="Confirm Modal">
            <div className="sm:flex sm:items-start p-2">
                <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <TriangleAlert className="size-6 text-red-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                    <VModalTitle className="leading-6" show >
                        {title}
                    </VModalTitle>
                    <div className="mt-2">
                        <div className="prose text-sm text-gray-500">
                            {content}
                        </div>
                    </div>
                </div>
            </div>
            <VModalFooter align="right">
                <Button
                    variant="destructive"
                    onClick={onConfirm}
                >
                    Confirm
                </Button>
                <Button
                    variant="outline"
                    onClick={onCancel}
                    ref={cancelButtonRef}
                >
                    Cancel
                </Button>
            </VModalFooter>
        </VModal>
    )
}