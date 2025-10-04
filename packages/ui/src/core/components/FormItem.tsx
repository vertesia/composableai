import clsx from 'clsx';
import { ReactNode } from 'react';

import { VTooltip } from './shadcn/tooltip';
import { Info } from 'lucide-react';

interface FormItemProps {
    label: any;
    children: ReactNode;
    className?: string;
    description?: ReactNode;
    required?: boolean;
    direction?: "row" | "column";
    disabled?: boolean;
}
export function FormItem({ description, required, label, className, direction = "column", children, disabled = false }: FormItemProps) {
    return (
        <div className={clsx("flex w-full space-y-1", className, direction === "row" ? "flex-row justify-between items-center gap-2" : "flex-col")}>
            <div className='flex items-center gap-1'>
                <label className={`text-sm font-medium mb-1 ${disabled ? "text-muted" : ""}`}>
                    {label}{required ? <span className='text-destructive -mt-4 ml-1'>*</span> : ""}
                </label>
                {
                    description &&
                    <div className='mx-2 flex w-4 items-center'>
                        <VTooltip
                            description={description}>
                            <Info className="size-3 text-muted" />
                        </VTooltip>
                    </div>
                }
            </div>
            {children}
        </div>
    );
}