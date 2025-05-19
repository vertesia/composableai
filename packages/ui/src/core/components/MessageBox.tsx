import { CircleX, CircleCheck, AlertTriangle, Info } from 'lucide-react';
import React from 'react';

interface MessageBoxProps {
    status: 'error' | 'info' | 'warning' | 'success' | 'default' | 'done'
    icon?: React.ReactNode
    title?: string
    children: React.ReactNode | React.ReactNode[]
    className?: string
}
export function MessageBox({ icon, status, title, children, className }: MessageBoxProps) {

    let defaultIcon, titleColor, textColor, bgColor;
    switch (status) {
        case 'error': {
            defaultIcon = <CircleX className="size-5 text-destructive" aria-hidden="true" />
            titleColor = "";
            textColor = "text-foreground";
            bgColor = "bg-destructive border border-destructive";
            break;
        }
        case 'warning': {
            defaultIcon = <AlertTriangle className="size-5 text-attention" aria-hidden="true" />
            titleColor = "";
            textColor = "text-foreground";
            bgColor = "bg-attention border border-attention";
            break;
        }
        case 'success': {
            defaultIcon = <CircleCheck className="size-5 text-success" aria-hidden="true" />
            titleColor = "";
            textColor = "text-foreground";
            bgColor = "bg-success border border-success";
            break;
        }
        case 'info': {
            defaultIcon = <Info className="size-5 text-info" aria-hidden="true" />
            titleColor = "";
            textColor = "text-foreground";
            bgColor = "bg-info border border-info";
            break;
        }
        case 'default': {
            defaultIcon = <Info className="size-5 text-muted" aria-hidden="true" />
            titleColor = "";
            textColor = "text-foreground";
            bgColor = "bg-muted border border-muted";
            break;
        }
        case 'done': {
            defaultIcon = <Info className="size-5 text-done" aria-hidden="true" />
            titleColor = "";
            textColor = "text-foreground";
            bgColor = "bg-done border border-done";
            break;
        }
    }

    return (
        <div className={`rounded-md p-4 ${bgColor} ${className}`}>
            <div className="flex">
                <div className="shrink-0">
                    {icon ?? defaultIcon}
                </div>
                <div className="w-full ml-2 px-1">
                    {title && <h3 className={`text-sm font-medium mb-2 ${titleColor}`}>{title}</h3>}
                    <div className={`text-sm ${textColor} break-words`}>
                        {children}
                    </div>
                </div>
            </div>
        </div >
    )
}

export function ErrorBox({ title, className, children }: { title: string, className?:string, children: React.ReactNode }) {
    return <MessageBox status="error" title={title} className={className}><pre>{children}</pre></MessageBox>
}

export function InfoBox({ title, className, children }: { title: string, className?:string, children: React.ReactNode }) {
    return <MessageBox status="info" title={title} className={className}>{children}</MessageBox>
}

export function WarningBox({ title, className, children }: { title: string, className?:string, children: React.ReactNode }) {
    return <MessageBox status="warning" title={title} className={className}>{children}</MessageBox>
}

export function SuccessBox({ title, className, children }: { title: string, className?:string, children: React.ReactNode }) {
    return <MessageBox status="success" title={title} className={className}>{children}</MessageBox>
}

export function DefaultBox({ title, className, children }: { title: string, className?:string, children: React.ReactNode }) {
    return <MessageBox status="default" title={title} className={className}>{children}</MessageBox>
}


