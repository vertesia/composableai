import { Switch as UISwitch } from "@headlessui/react";

const sizes = {
    'sm': ['h-5 w-8', 'size-3', 'translate-x-4'],
    'md': ['h-6 w-11', 'size-4', 'translate-x-6'],
    'lg': ['h-8 w-16', 'size-6', 'translate-x-9'],
}

interface SwitchProps {
    size?: 'sm' | 'md' | 'lg'
    value: boolean;
    onChange: (value: boolean) => void;
    children?: React.ReactNode;
    className?: string;
    disabled?: boolean;
}
export function Switch({ value, onChange, size = 'md', children, className, disabled }: SwitchProps) {
    const sizeClass = sizes[size];
    return (
        <UISwitch checked={value} onChange={() => onChange(!value)} disabled={disabled} className={`flex items-center ${className} ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:cursor-pointer'}`}>
            <div className={`${value ? 'bg-primary' : 'bg-muted/50'} relative inline-flex ${sizeClass[0]} items-center rounded-full border-1`}>
                <span
                    className={`${value ? sizeClass[2] : 'translate-x-1'
                        } inline-block ${sizeClass[1]} transform rounded-full bg-white transition`}
                />
            </div>
            {children && <span className="px-2">{children}</span>}
        </UISwitch>
    )
}
