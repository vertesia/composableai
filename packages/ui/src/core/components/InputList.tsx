import clsx from 'clsx';
import { useState } from 'react';

import { Badge } from './Badge';
import { Input } from './shadcn/input';
import { Styles } from './styles';

interface InputListProps {
    value?: string[];
    onChange: (value: string[]) => void;
    className?: string;
    allowSpaces?: boolean;
    delimiters?: string; // space and , by default
    placeholder?: string;
}
export function InputList({ value = [], onChange, className, delimiters = ", ", placeholder }: InputListProps) {
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

    const _onClick = (index: any): void => {
        if (value && value.length > 0) {
            value.splice(index, 1);
            onChange([...value]);
        }
    };

    return (
        <div className={clsx(className, 'w-full space-x-1 space-y-1 p-2', Styles.INPUT)}>
            {
                value && value.length > 0 &&
                (value.map((v, index) =>
                    <Badge variant={"secondary"} key={index} onClick={() => _onClick(index)} style={{ whiteSpace: 'nowrap' }} className='cursor-pointer'>
                        {v}
                    </Badge>
                ))
            }
            <div>
                <Input
                    clearable={false}
                    className='placeholder:text-muted-foreground px-1'
                    variant='unstyled'
                    type='text'
                    value={text}
                    onBlur={onBlur}
                    onKeyDown={onKeyDown}
                    onChange={setText}
                    placeholder={!value || value.length === 0 ? placeholder : ''}
                />
            </div>
        </div>
    )
}