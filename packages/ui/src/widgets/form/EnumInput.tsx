import { useState } from "react";
import { SelectBox } from "@vertesia/ui/core";
import { Node } from "./ManagedObject.js";
import { PropertySchema, ArrayPropertySchema } from "./schema.js";

interface EnumInputProps {
    object: Node;
    type?: string;
    onChange?: (event: any) => void;
    disabled?: boolean;
}

/**
 * Single-select enum input using SelectBox
 */
export function EnumInput({ object, onChange, disabled }: EnumInputProps) {
    const schema = object.schema as PropertySchema;
    const enumValues = (schema.enum || []) as string[];
    const currentValue = object.value as string | undefined;

    const handleChange = (selected: string) => {
        if (disabled) return;
        object.value = selected;
        onChange?.({ target: { value: selected } });
    };

    return (
        <SelectBox<string>
            options={enumValues}
            value={currentValue || ''}
            onChange={handleChange}
            placeholder="Select a value..."
            disabled={disabled}
            isClearable
            warnOnMissingValue={false}
        />
    );
}

/**
 * Multi-select enum input using SelectBox with multiple mode
 * Used for enum[] types
 */
export function EnumArrayInput({ object, onChange, disabled }: EnumInputProps) {
    const schema = object.schema as ArrayPropertySchema;
    // For arrays, enum values are in the items schema (which is what PropertySchema wraps)
    const enumValues = (schema.enum || []) as string[];

    // Use local state to trigger re-renders
    const [currentValue, setCurrentValue] = useState<string[]>(
        (object.value || []) as string[]
    );

    const handleChange = (selected: string[]) => {
        if (disabled) return;
        setCurrentValue(selected);
        object.value = selected;
        onChange?.({ target: { value: selected } });
    };

    return (
        <SelectBox<string>
            multiple
            options={enumValues}
            value={currentValue}
            onChange={handleChange}
            placeholder="Select values..."
            disabled={disabled}
            isClearable
            warnOnMissingValue={false}
        />
    );
}
