import clsx from 'clsx';
import React, { useState } from 'react';

import { Badge } from './Badge';
import { Input } from './shadcn/input';

interface InputListProps {
    value?: string[];
    onChange: (value: string[]) => void;
    className?: string;
    allowSpaces?: boolean;
    delimiters?: string; // space and , by default
    placeholder?: string;
    autoFocus?: boolean;
}
export function InputList({ value = [], onChange, className, delimiters = ", ", placeholder, autoFocus }: InputListProps) {
    const [text, setText] = useState<string>('');

    const onBlur = (ev: any) => {
        const v = ev.target.value;
        if (v && v.trim()) {
            onChange([...value, v.trim()])
            setText('')
        }
    }
    const onKeyDown = (ev: any) => {
        const v = ev.target.value;
        const isEmpty = !v.trim();
        const key = ev.key;
        if (key === 'Enter' || delimiters.indexOf(key) > -1) {
            ev.preventDefault();
            if (value && !isEmpty) {
                onChange([...value, v.trim()])
                setText('')
            }
        } else if (key === 'Backspace' && isEmpty) {
            if (value && value.length > 0) {
                value.pop();
                onChange([...value])
            }
        }
    }

    const onPaste = (ev: React.ClipboardEvent<HTMLInputElement>) => {
        const pastedText = ev.clipboardData.getData('text');
        if (pastedText) {
            ev.preventDefault();

            // Create a regex pattern from delimiters
            const delimiterPattern = delimiters.split('').map((char: string) =>
                char === ' ' ? '\\s' : char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            ).join('|');
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
    }

    const _onClick = (index: any): void => {
        if (value && value.length > 0) {
            value.splice(index, 1);
            onChange([...value]);
        }
    };

    return (
        <div className={clsx(className,
            'w-full flex items-center gap-1 p-2 overflow-hidden py-1.5',
            'rounded-md text-sm rounded-md border border-input bg-background ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50')}>
            {
                value && value.length > 0 &&
                (value.map((v, index) =>
                    <Badge
                        variant={"secondary"}
                        key={index} 
                        onClick={() => _onClick(index)}
                        className='cursor-pointer flex-shrink-0'
                        title={v}
                    >
                        <span className='break-all'>{v}</span>
                    </Badge>
                ))
            }
            <Input
                clearable={false}
                className='placeholder:text-muted px-1 flex-1 min-w-0'
                variant='unstyled'
                type='text'
                value={text}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                onChange={setText}
                placeholder={!value || value.length === 0 ? placeholder : ''}
                autoFocus={autoFocus}
            />
        </div>
    )
}