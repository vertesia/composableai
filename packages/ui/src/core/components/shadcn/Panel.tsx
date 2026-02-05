import { VTooltip } from "./tooltip"
import { Info } from "lucide-react"

interface PanelProps {
    title: string | React.ReactNode
    description?: React.ReactNode
    action?: React.ReactNode
    children: React.ReactNode
    footer?: string | React.ReactNode
    className?: string
}

export function Panel({ children, action, title, description, footer, className }: PanelProps) {

    return (
        <div className={`p-4 flex flex-col gap-2 rounded-sm border bg-card ${className}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="font-semibold text-lg">
                        {title}
                    </div>
                    {description && <VTooltip description={description}><Info className="size-4 text-muted" /></VTooltip>}
                </div>
                {action}
            </div>

            {children}
            {footer &&
                <div className="border-t border-muted flex flex-col-2 text-sm pt-4">
                    {footer}
                </div>}
        </div>
    )
}