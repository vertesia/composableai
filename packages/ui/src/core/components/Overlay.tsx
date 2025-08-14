import { motion } from "framer-motion"
import { X } from "lucide-react"
import { useState, ReactNode } from "react"

import { Button } from "./Button"

interface OverlayProps {
    children: ReactNode
    overlayContent: ReactNode
    className?: string
    overlayClassName?: string
    position?: 'left' | 'right' | 'top' | 'bottom' | 'center'
    width?: string
    height?: string
    showCloseButton?: boolean
    closeButtonTooltip?: string
    onOpen?: () => void
    onClose?: () => void
    triggerClassName?: string
    backdropClassName?: string
    animationConfig?: {
        type?: "spring" | "tween"
        stiffness?: number
        damping?: number
        duration?: number
    }
}
export function Overlay({
    children,
    overlayContent,
    className = "",
    overlayClassName = "",
    position = 'right',
    width,
    height,
    showCloseButton = true,
    onOpen,
    onClose,
    triggerClassName = "",
    backdropClassName = "",
    animationConfig = { type: "spring", stiffness: 300, damping: 30 }
}: Readonly<OverlayProps>) {
    const [isOpen, setIsOpen] = useState(false)

    const handleOpen = () => {
        setIsOpen(true)
        onOpen?.()
    }

    const handleClose = () => {
        setIsOpen(false)
        onClose?.()
    }

    const animationProps = getAnimationProps(position)
    const positionClasses = getPositionClasses(position, width, height)

    return (
        <div className={`flex items-center justify-center w-full ${className}`}>
            <div onClick={handleOpen} className={`w-full align-left cursor-pointer ${triggerClassName}`}>
                {children}
            </div>
            {
                isOpen && (
                    <div className={`z-45 fixed inset-0 bg-black bg-opacity-50 ${backdropClassName}`}>
                        <motion.div
                            {...animationProps}
                            transition={animationConfig}
                            className={`${positionClasses} ${overlayClassName}`}
                        >
                            {
                                showCloseButton && (
                                    <div className="absolute top-2 right-2 z-10">
                                        <Button onClick={handleClose} variant="primary">
                                            <X />
                                        </Button>
                                    </div>
                                )
                            }
                            <div className={showCloseButton ? "mt-8" : ""}>
                                {overlayContent}
                            </div>
                        </motion.div>
                    </div>
                )
            }
        </div>
    )
}

function getAnimationProps(position: string) {
    switch (position) {
        case 'left':
            return { initial: { x: "-100%" }, animate: { x: 0 }, exit: { x: "-100%" } }
        case 'right':
            return { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "100%" } }
        case 'top':
            return { initial: { y: "-100%" }, animate: { y: 0 }, exit: { y: "-100%" } }
        case 'bottom':
            return { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } }
        case 'center':
            return {
                initial: { opacity: 0, scale: 0.8 },
                animate: { opacity: 1, scale: 1 },
                exit: { opacity: 0, scale: 0.8 }
            }
        default:
            return { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "100%" } }
    }
}

function getPositionClasses(position: string, width?: string, height?: string) {
    const baseClasses = "fixed bg-white shadow-lg p-4 relative"

    switch (position) {
        case 'left':
            return `${baseClasses} left-0 top-[var(--header-height)] h-full ${width || 'w-80'}`
        case 'right':
            return `${baseClasses} right-0 top-[var(--header-height)] h-full ${width || 'w-80'}`
        case 'top':
            return `${baseClasses} top-[var(--header-height)] left-0 right-0 ${height || 'h-80'}`
        case 'bottom':
            return `${baseClasses} bottom-0 left-0 right-0 ${height || 'h-80'}`
        case 'center':
            return `${baseClasses} top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${width || 'w-96'} ${height || 'max-h-96'}`
        default:
            return `${baseClasses} right-0 top-[var(--header-height)] h-full ${width || 'w-80'}`
    }
}