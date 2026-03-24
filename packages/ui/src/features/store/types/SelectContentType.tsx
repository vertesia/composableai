import { ContentObjectTypeItem } from "@vertesia/common";
import { SelectBox } from "@vertesia/ui/core";
import { useEffect, useState } from "react";
import { useTypeRegistry } from "./TypeRegistryProvider.js";
import { useUITranslation } from '../../../i18n/index.js';

interface SelectContentTypeProps {
    defaultValue?: string | string[] | null; // the typeId
    onChange: (type: ContentObjectTypeItem | null | ContentObjectTypeItem[]) => void;
    className?: string;
    isClearable?: boolean;
    multiple?: boolean;
}
export function SelectContentType({ className, defaultValue, onChange, isClearable, multiple}: SelectContentTypeProps) {
    const { t } = useUITranslation();
    const { registry: typeRegistry } = useTypeRegistry();
    const [isMounted, setIsMounted] = useState(false);

    const optionLabel = (type: ContentObjectTypeItem | null) => {
        if (type === null) return t('store.none');

        return (
            <div>
                <div className="text-sm">{type.name}</div>
                <div className="text-xs text-muted truncate">{type.description}</div>
            </div>
        );
    };
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
                    placeholder={t('store.chooseContentTypes')}
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
                placeholder={t('store.chooseContentType')}
                optionLabel={optionLabel}
                className={className || "text-sm bg-background"}
                filterBy="name"
                isClearable={isClearable || false as any}
            />
        </div>
    );
}
