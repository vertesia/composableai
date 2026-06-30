import clsx from 'clsx';
import type React from 'react';
import { useState } from 'react';

import { Badge } from './shadcn/badge';
import { VTooltip } from './shadcn/tooltip';

interface InputListProps {
    value?: string[];
    onChange: (value: string[]) => void;
    className?: string;
    allowSpaces?: boolean;
    delimiters?: string; // space and , by default
    placeholder?: string;
    autoFocus?: boolean;
    disabled?: boolean;
}
export function InputList({
    value = [],
    onChange,
    className,
    delimiters = ', ',
    placeholder,
    autoFocus,
    disabled = false,
}: InputListProps) {
    const [text, setText] = useState<string>('');

    const onBlur = (ev: React.FocusEvent<HTMLInputElement>) => {
        if (disabled) return;
        const v = ev.currentTarget.value;
        if (v?.trim()) {
            onChange([...value, v.trim()]);
            setText('');
        }
    };
    const onKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (disabled) return;
        const v = ev.currentTarget.value;
        const isEmpty = !v.trim();
        const key = ev.key;
        if (key === 'Enter' || delimiters.indexOf(key) > -1) {
            ev.preventDefault();
            if (value && !isEmpty) {
                onChange([...value, v.trim()]);
                setText('');
            }
        } else if (key === 'Backspace' && isEmpty) {
            if (value && value.length > 0) {
                value.pop();
                onChange([...value]);
            }
        }
    };

    const onPaste = (ev: React.ClipboardEvent<HTMLInputElement>) => {
        if (disabled) return;
        const pastedText = ev.clipboardData.getData('text');
        if (pastedText) {
            ev.preventDefault();

            // Create a regex pattern from delimiters
            const delimiterPattern = delimiters
                .split('')
                .map((char: string) => (char === ' ' ? '\\s' : char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
                .join('|');
            const regex = new RegExp(`[${delimiterPattern}]+`);

            // Split the pasted text by delimiters and filter out empty values
            const newValues = pastedText
                .split(regex)
                .map((item: string) => item.trim())
                .filter((item: string) => item.length > 0);

            if (newValues.length > 0) {
                onChange([...value, ...newValues]);
            }

            setText('');
        }
    };

    const _onClick = (index: number): void => {
        if (disabled) return;
        if (value && value.length > 0) {
            value.splice(index, 1);
            onChange([...value]);
        }
    };

    return (
        <div
            className={clsx(
                className,
                'w-full flex flex-wrap items-center gap-1 p-2 py-1.5',
                'rounded-md text-sm rounded-md border border-input bg-background ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                disabled && 'opacity-50 cursor-not-allowed',
            )}
        >
            {value &&
                value.length > 0 &&
                value.map((v, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: list order is stable for this render
                    <VTooltip description={'click to remove'} key={index}>
                        <Badge
                            variant={'secondary'}
                            // biome-ignore lint/suspicious/noArrayIndexKey: list order is stable for this render
                            key={index}
                            onClick={() => _onClick(index)}
                            className={clsx(
                                'flex-shrink-0 transition-colors',
                                disabled
                                    ? 'cursor-not-allowed'
                                    : 'cursor-pointer hover:bg-destructive hover:text-destructive',
                            )}
                            title={v}
                        >
                            <span className="break-all">{v}</span>
                        </Badge>
                    </VTooltip>
                ))}
            <input
                className="flex-1 min-w-[80px] m-0 p-0 px-1 border-0 bg-transparent text-sm placeholder:text-muted focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
                type="text"
                value={text}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                onChange={(ev) => setText(ev.currentTarget.value)}
                placeholder={!value || value.length === 0 ? placeholder : ''}
                // biome-ignore lint/a11y/noAutofocus: opt-in via the autoFocus prop, controlled by the caller
                autoFocus={autoFocus}
                disabled={disabled}
            />
        </div>
    );
}
