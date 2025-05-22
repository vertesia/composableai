import clsx from "clsx";
import React, { ChangeEvent, InputHTMLAttributes, useState } from "react";
import { ManagedProperty } from "./ManagedObject.js";
import { Styles } from "@vertesia/ui/core";

interface InputProps extends InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
    object: ManagedProperty;
}
const Input = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(({ object, type = 'text', onChange, ...props }, ref) => {
    const [actualValue, setValue] = useState(object.value != null ? String(object.value) : '');
    const [booleanValue, setBooleanValue] = useState(object.schema.isBoolean && object.value === true);

    if (props.className) {
        props.className = clsx(Styles.INPUT, props.className);
    } else {
        props.className = Styles.INPUT;
    }

    const _onChange = (ev: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setValue(ev.target.value);
        if (object.schema.isBoolean) {
            object.value = (ev.target as HTMLInputElement).checked;
            setBooleanValue(object.value)
        } else {
            object.value = ev.target.value;
        }
        onChange && onChange(ev);
    }
    if (type === 'textarea') {
        return (
            <textarea ref={ref as React.ForwardedRef<HTMLTextAreaElement>} {...props} value={actualValue} onChange={_onChange} />
        )
    } else if (type === 'checkbox') {
        return (
            <input ref={ref as React.ForwardedRef<HTMLInputElement>} {...props} type="checkbox" checked={booleanValue} onChange={_onChange} className="form-check-input" />
        )
    } else {
        return (
            <input ref={ref as React.ForwardedRef<HTMLInputElement>} {...props} type={type} value={actualValue} onChange={_onChange} />
        )
    }
});

export { Input };
