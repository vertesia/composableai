import { ContentObjectTypeItem } from "@vertesia/common";
import { SelectBox } from "@vertesia/ui/core";
import { useEffect, useState } from "react";
import { useTypeRegistry } from "./TypeRegistryProvider.js";

const optionLabel = (t: ContentObjectTypeItem | null) => {
    if (t === null) return 'None';

    return (
        <div>
            <div className="text-sm">{t.name}</div>
            <div className="text-xs text-gray-500">{t.description}</div>
        </div>
    );
};

interface SelectContentTypeProps {
    defaultValue?: string | string[] | null; // the typeId
    onChange: (type: ContentObjectTypeItem | null | ContentObjectTypeItem[]) => void;
    className?: string;
    isClearable?: boolean;
    multiple?: boolean;
}
export function SelectContentType({ className, defaultValue, onChange, isClearable, multiple}: SelectContentTypeProps) {
    const { registry: typeRegistry } = useTypeRegistry();
    const [isMounted, setIsMounted] = useState(false);
    const [selectedType, setSelectedType] = useState<ContentObjectTypeItem | undefined>();
    const [selectedTypes, setSelectedTypes] = useState<ContentObjectTypeItem[]>([])

    useEffect(() => {
        if (!isMounted) {
            setIsMounted(true);
            if (typeRegistry && defaultValue) {
                if (multiple && Array.isArray(defaultValue)) {
                    const types = typeRegistry.types.filter(t => defaultValue.includes(t.id));
                    setSelectedTypes(types);
                }
                const type = typeRegistry.types.find(t => t.id === defaultValue);
                if (type) {
                    setSelectedType(type);
                }
            }
        }
    }, [typeRegistry, defaultValue, multiple])

    const _onChange = (option: ContentObjectTypeItem | null) => {
        setSelectedType(option || undefined);
        onChange(option);
    };

    const _onChangeMultiple = (options: ContentObjectTypeItem[]) => {
        setSelectedTypes(options);
        onChange(options);
    };

    if (multiple) {
        return (
            <div className='flex flex-col gap-4 content-between'>
                <SelectBox<ContentObjectTypeItem>
                    options={typeRegistry?.types || []}
                    value={selectedTypes}
                    onChange={_onChangeMultiple}
                    placeholder="Choose Content Types..."
                    optionLabel={optionLabel}
                    className={className || "text-sm bg-background"}
                    filterBy="name"
                    isClearable={isClearable || false as any}
                    multiple
                />
            </div>
        );
    }

    return (
        <div className='flex flex-col gap-4 content-between'>
            <SelectBox<ContentObjectTypeItem>
                options={typeRegistry?.types || []}
                value={selectedType}
                onChange={_onChange}
                placeholder="Choose a Content Type..."
                optionLabel={optionLabel}
                className={className || "text-sm bg-background"}
                filterBy="name"
                isClearable={isClearable || false as any}
            />
        </div>
    );
}
