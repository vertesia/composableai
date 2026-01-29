import { useState } from 'react';
import { VSelectBox } from '@vertesia/ui/core';
import { ManagedObjectBase, Node } from './ManagedObject.js';
import { PropertySchema, ArrayPropertySchema } from './schema.js';

interface EnumInputProps {
    object: Node;
    onChange?: (event: any) => void;
    disabled?: boolean;
}

/**
 * Single-select enum input using VSelectBox
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
        <VSelectBox<string>
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
 * Multi-select enum input using VSelectBox with multiple mode
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

        // Update local state for re-render
        setCurrentValue(selected);

        // Update parent's value directly (ManagedListProperty doesn't have a setter)
        const parent = object.parent as ManagedObjectBase;
        parent.setPropertyValue(object.name, selected);

        // Trigger change notification
        (object as any).onChange(object);

        onChange?.({ target: { value: selected } });
    };

    return (
        <VSelectBox<string>
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
