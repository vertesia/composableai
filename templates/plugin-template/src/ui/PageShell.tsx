import type { ReactNode } from "react";

interface PageShellProps {
    title: string;
    description?: string;
    action?: ReactNode;
    children: ReactNode;
}

export function PageShell({ title, description, action, children }: PageShellProps) {
    return (
        <div className="h-full overflow-auto">
            <div className="mx-auto max-w-7xl px-6 py-6 flex flex-col gap-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                        {description && (
                            <p className="text-sm text-muted mt-1 max-w-3xl">{description}</p>
                        )}
                    </div>
                    {action}
                </div>
                {children}
            </div>
        </div>
    );
}
