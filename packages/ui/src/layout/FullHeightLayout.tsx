import clsx from 'clsx';
import React from 'react';

interface FlexibleHeightLayoutProps {
    children: React.ReactNode;
    className?: string;
}
export function FullHeightLayout({ className, children }: FlexibleHeightLayoutProps) {
    return (
        <div
            className={clsx(
                "flex flex-col",
                "h-full",
                "overflow-y-auto",
                "px-2",
                className
            )}
        >
            {children}
        </div>
    );
}

interface FixedProps {
    children: React.ReactNode;
    heightClass: string;
    className?: string;
}
FullHeightLayout.Fixed = function Fixed({ heightClass, className, children }: FixedProps) {
    return (
        <div
            className={clsx(
                "w-full",
                heightClass,
                className
            )}
        >
            {children}
        </div>
    );
}

interface BodyProps {
    children: React.ReactNode;
    className?: string;
}
FullHeightLayout.Body = function Body({ className, children }: BodyProps) {
    return (
        <div
            className={clsx(
                "grow overflow-auto",
                "min-h-0",
                "p-2",
                className
            )}
        >
            {children}
        </div>
    );
}

interface VDividerProps { }
FullHeightLayout.VR = function VDivider({ }: VDividerProps) {
    return (
        <div className="w-[1px] border border-red-200"></div>
    );
}

interface HDividerProps { }
FullHeightLayout.HR = function HDivider({ }: HDividerProps) {
    return (
        <div className="w-full h-1 border-b border-red-200"></div>
    );
}

FullHeightLayout.Tab = function Tab({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col h-full">
            {children}
        </div>
    );
}