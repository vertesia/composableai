import { useState } from "react"
import { VTooltip } from "./tooltip"
import { ChevronDown, ChevronUp, Info } from "lucide-react"
import { Button } from "./button"

interface PanelProps {
    title: string | React.ReactNode
    description?: React.ReactNode
    action?: React.ReactNode
    children: React.ReactNode
    footer?: string | React.ReactNode
    className?: string
    collapsible?: boolean
    defaultCollapsed?: boolean
}

export function Panel({ children, action, title, description, footer, className, collapsible, defaultCollapsed = false }: PanelProps) {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

    return (
        <div className={`p-4 flex flex-col gap-2 rounded-sm border bg-card ${className}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="font-semibold text-lg">
                        {title}
                    </div>
                    {description && <VTooltip description={description}><Info className="size-4 text-muted" /></VTooltip>}
                </div>
                <div className="flex gap-2 items-center">
                    {action}
                    {
                        collapsible && (
                            <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)}>
                                {isCollapsed ?
                                    <ChevronDown className="size-4" /> :
                                    <ChevronUp className="size-4" />
                                }
                            </Button>
                        )
                    }
                </div>
            </div>
            {!isCollapsed && children}
            {footer &&
                <div className="border-t border-muted flex flex-col-2 text-sm pt-4">
                    {footer}
                </div>}
        </div>
    )
}