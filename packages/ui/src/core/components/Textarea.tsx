import clsx from "clsx";
import React, { useState } from "react";
import { Styles } from "./styles";

interface TextareaProps extends Omit<React.HTMLProps<HTMLTextAreaElement>, 'ref' | 'onChange'> {
    onChange: (value: string) => void;
    unstyled?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ unstyled, value, onChange, className, ...others }: TextareaProps, ref) => {
    const [currentValue, setCurrentValue] = useState(value || "");
    const _onChange = (ev: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = ev.target.value;
        setCurrentValue(value);
        onChange && onChange(value);
    }
    return (
        <textarea ref={ref}
            {...others}
            className={clsx('w-full', unstyled ? Styles.INPUT_UNSTYLED : Styles.INPUT, className)}
            value={currentValue} onChange={_onChange} />
    )
});

export { Textarea }