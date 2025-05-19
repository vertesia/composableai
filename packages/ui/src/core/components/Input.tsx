import clsx from 'clsx';
import React, { ChangeEvent } from 'react';

import { X } from 'lucide-react';

import { Styles } from './styles.js';

interface InputProps extends Omit<React.HTMLProps<HTMLInputElement>, 'ref' | 'onChange' | 'value'> {
    value?: string;
    onChange?: (value: string) => void
    unstyled?: boolean;
}
const Input = React.forwardRef<HTMLInputElement, InputProps>(({ unstyled, value, onChange, className, type, ...others }: InputProps, ref) => {
    const _onChange = (ev: ChangeEvent<HTMLInputElement>) => {
        onChange && onChange(ev.target.value);
    };

    const _onClear = () => {
        onChange && onChange('');
    };

    return (
        <div style={{ position: 'relative', display: 'inline-block' }} className={clsx("w-full", className)}>
            <input
                type={type || 'text'}
                value={value == null ? '' : value}
                onChange={_onChange}
                className={clsx('w-full', unstyled ? Styles.INPUT_UNSTYLED : Styles.INPUT, className)}
                ref={ref}
                {...others}
            />
            {
                value && (
                    <button onClick={_onClear} className={`absolute ${type !== 'number' ? 'right-2' : 'right-7'} top-1/2 -translate-y-1/2 size-7 text-gray-400 hover:text-red-500 cursor-pointer`}>
                        <X />
                    </button>
                )
            }
        </div>
    );
})

export { Input };
