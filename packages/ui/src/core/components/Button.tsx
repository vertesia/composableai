import clsx from 'clsx';
import React from "react";
import { Spinner } from "./Spinner.js";

function getRealSize(size: 'xs' | 'sm' | 'md' | 'lg' | 'xl') {
    switch (size) {
        case 'xs': return 'rounded-xs px-2 py-1 text-xs gap-x-1';
        case 'sm': return 'rounded-xs px-2 py-1 text-sm gap-x-1';
        case 'md': return 'rounded-md px-2.5 py-1.5 text-sm gap-x-1.5';
        case 'lg': return 'rounded-md px-3 py-2 text-sm gap-x-1.5';
        case 'xl': return 'rounded-md px-3.5 py-2.5 text-sm gap-x-2';
        default: throw new Error('Unexpected size: ' + size);
    }
}

const Variants = {
    primary: "shadow-2xs bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
    secondary: "shadow-2xs bg-white text-gray-900 hover:bg-gray-50 ring-1 ring-inset ring-gray-300",
    soft: "shadow-2xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100",
    ghost: "text-indigo-600 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900",
    unstyled: ""
}

const SpinnerVariants = {
    primary: "text-white",
    secondary: "text-indigo-500",
    soft: "text-indigo-600",
    ghost: "text-indigo-600",
    unstyled: "text-gray-600"
}

export interface ButtonProps {
    isLoading?: boolean
    isDisabled?: boolean
    variant?: "primary" | "secondary" | "soft" | "ghost" | "unstyled"
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    children: React.ReactNode | React.ReactNode[];
    onClick?: (ev: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    type?: "button" | "submit" | "reset";
    title?: string;
    className?: string;
}
export function Button({ title, className, type = 'button', children, size, onClick, variant = "primary", isLoading = false, isDisabled = false }: ButtonProps) {
    const sizeClass = getRealSize(size || 'md');
    return (
        <button
            title={title}
            disabled={isDisabled || isLoading}
            onClick={onClick}
            type={type}
            className={
                clsx("whitespace-nowrap inline-flex items-center justify-center font-semibold hover:cursor-pointer",
                    Variants[variant],
                    sizeClass,
                    isDisabled && "cursor-not-allowed text-gray-300!",
                    className
                )}
        >
            {isLoading && <Spinner className={SpinnerVariants[variant]} size={size} />}
            {children}
        </button>
    )
}
