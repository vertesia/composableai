import clsx from "clsx";
import React, { ChangeEvent, useEffect } from "react";
import { Styles } from "./styles.js";

function numberToString(value: number | undefined) {
    if (value == null || isNaN(value)) {
        return '';
    } else {
        return value.toString();
    }
}

interface NumberInputProps extends Omit<React.HTMLProps<HTMLInputElement>, 'ref' | 'onChange' | 'value'> {
    value?: number;
    onChange?: (value: undefined | number, text: string) => void
    noScroll?: boolean;
    noSpinners?: boolean
}

/**
 * The value of this input is always a number. It can be undefined or NaN. If NaN the input value will not be updated with the NaN one.
 * If undefined the input will be updated to be empty.
 * The onChange callback is called whenever the value changes. If the input cannot be parsed as a number
 * it will be returned as NaN.
 */
const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(({ value, onChange, className, noScroll = false, noSpinners = false, ...others }: NumberInputProps, ref) => {
    // we need to store the state here in string
    const [textValue, setTextValue] = React.useState<string>(numberToString(value))
    const _onChange = (ev: ChangeEvent<HTMLInputElement>) => {
        const value = ev.target.value;
        setTextValue(value)
        if (value === '') {
            onChange && onChange(undefined, value)
        } else {
            const num = parseFloat(value);
            onChange && onChange(num, value)
        }
    }

    useEffect(() => {
        // we do not update if not empty and NaN
        if (value == null || !isNaN(value)) {
            const text = numberToString(value);
            setTextValue(text);
        }
    }, [value])

    return (
        <input
            onWheel={noScroll ? event => { (event.target as any).blur(); } : others.onWheel} /* avoid input change on wheel scroll */
            type='number'
            value={textValue}
            onChange={_onChange}
            className={clsx(className, Styles.INPUT, { "no-spinners": noSpinners },
                noSpinners && "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            )}
            ref={ref}
            {...others}
        />

    )
})

export { NumberInput };
