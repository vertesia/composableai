import { ContentObjectTypeItem } from "@vertesia/common";
import { VSelectBox } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { useEffect, useState } from "react";

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
    defaultValue: string | null; // the typeId
    onChange: (type: ContentObjectTypeItem | null) => void;
    className?: string;
    isClearable?: boolean;
}
export function SelectContentType({ className, defaultValue, onChange, isClearable }: SelectContentTypeProps) {
    const session = useUserSession();
    const [isMounted, setIsMounted] = useState(false);
    const [selectedType, setSelectedType] = useState<ContentObjectTypeItem | undefined>();

    useEffect(() => {
        if (!isMounted) {
            setIsMounted(true);
            if (session.typeRegistry) {
                const type = session.typeRegistry.types.find(t => t.id === defaultValue);
                type && setSelectedType(type);
            }
        }
    }, [session.typeRegistry])

    const _onChange = (option: ContentObjectTypeItem | null) => {
        setSelectedType(option || undefined);
        onChange(option);
    };

    return (
        <div className='flex flex-col gap-4 content-between'>
            <VSelectBox options={session.typeRegistry?.types || []}
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
