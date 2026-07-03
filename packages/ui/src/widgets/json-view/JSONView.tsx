import type { JSONArray, JSONObject, JSONValue } from '@vertesia/json';
import { DotBadge } from '@vertesia/ui/core';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { computeTitleFromName } from '../form/ManagedObject.js';

interface JSONViewProps {
    value: JSONValue;
}
export function JSONView({ value }: JSONViewProps) {
    if (Array.isArray(value)) {
        return (
            <div className="flex flex-col gap-4 px-2 h-full overflow-auto">
                <ArrayProperty value={value} />
            </div>
        );
    }
    if (typeof value !== 'object' || value == null) {
        return (
            <div className="flex flex-col gap-4 px-2 h-full overflow-auto">
                <PropertyElement name="value" value={value} />
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-4 px-2 h-full overflow-auto">
            {Object.entries(value).map(([key, value]) => (
                <PropertyElement key={key} name={key} value={value as JSONValue} />
            ))}
        </div>
    );
}

interface PropertyTitleProps {
    name: string;
}
function PropertyTitle({ name }: PropertyTitleProps) {
    return <div className="text-md font-semibold">{computeTitleFromName(name)}</div>;
}

interface BlockElementProps {
    children: ReactNode | ReactNode[];
    className?: string;
}
function BlockElement({ children, className }: BlockElementProps) {
    return (
        <div
            className={clsx(
                'flex flex-col gap-4 py-2 ps-4 border-s-4 border-s-solid border-s-slate-100 dark:border-s-slate-600',
                className,
            )}
        >
            {children}
        </div>
    );
}

interface PropertyElementProps {
    name: string;
    value: JSONValue;
}
function PropertyElement({ name, value }: PropertyElementProps) {
    const info = getValueInfo(value);
    switch (info.type) {
        case ValueType.Inline:
            return (
                <div className="w-full flex gap-2">
                    <PropertyTitle name={`${name}:`} />
                    <p>{info.value}</p>
                </div>
            );
        case ValueType.Paragraph:
            return (
                <div>
                    <PropertyTitle name={name} />
                    <p>{info.value}</p>
                </div>
            );
        case ValueType.Prose:
            return (
                <div className="prose dark:prose-invert">
                    <PropertyTitle name={name} />
                    <div className="vprose dark:prose-invert">{info.value}</div>
                </div>
            );
        case ValueType.Array:
            return <ArrayProperty name={name} value={value as JSONArray} />;
        case ValueType.Object:
            return (
                <div>
                    <PropertyTitle name={name} />
                    <BlockElement className="mt-2">
                        {Object.entries(value as JSONObject).map(([key, value]) => (
                            <PropertyElement key={key} name={key} value={value as JSONValue} />
                        ))}
                    </BlockElement>
                </div>
            );
    }
}

interface ArrayPropertyProps {
    name?: string;
    value: JSONArray;
}
function ArrayProperty({ name, value }: ArrayPropertyProps) {
    const inlineLength = value.join(' ').length;
    const itemMediumLength = inlineLength / value.length;
    const isInline =
        typeof value[0] === 'string' && (inlineLength < 80 || (inlineLength < 400 && itemMediumLength < 32));
    const useBullet = value.length > 9;
    const items = value.map((item, index) => ({
        item,
        index,
        key: `${index}-${JSON.stringify(item)}`,
    }));

    return isInline ? (
        <div className="flex gap-2 flex-wrap">
            {name && <PropertyTitle name={`${name}:`} />}
            {items.map(({ item, key }) => (
                <DotBadge key={key}>{String(item)}</DotBadge>
            ))}
        </div>
    ) : (
        <div>
            {name && <PropertyTitle name={name} />}
            <div className="flex flex-col gap-2">
                {items.map(({ item, index, key }) => (
                    <ItemProperty key={key} index={index} value={item} useBullet={useBullet} />
                ))}
            </div>
        </div>
    );
}

interface ItemPropertyProps {
    index: number;
    value: JSONValue;
    useBullet?: boolean;
}
function ItemProperty({ index, value, useBullet }: ItemPropertyProps) {
    const bullet = useBullet ? <span className="text-xl">&bull;</span> : <span>{index + 1}.</span>;
    const info = getValueInfo(value);
    let content: React.ReactNode;
    switch (info.type) {
        case ValueType.Object:
            content = (
                <BlockElement>
                    {Object.entries(value as JSONObject).map(([key, value]) => (
                        <PropertyElement key={key} name={key} value={value as JSONValue} />
                    ))}
                </BlockElement>
            );
            break;
        case ValueType.Array:
            content = <ArrayProperty value={value as JSONArray} />;
            break;
        case ValueType.Prose:
            content = <div className="prose dark:prose-invert">{info.value}</div>;
            break;
        default:
            content = <div>{info.value}</div>;
            break;
    }
    return (
        <div className="flex gap-4 hover:bg-slate-50 dark:hover:bg-slate-800 py-2 pe-2 ps-4">
            <div className="font-semibold text-gray-600 dark:text-gray-400">{bullet}</div>
            <div>{content}</div>
        </div>
    );
}

enum ValueType {
    Inline,
    Paragraph,
    Prose,
    Array,
    Object,
}
type ValueInfo =
    | { value: string; type: ValueType.Inline | ValueType.Paragraph | ValueType.Prose }
    | { value: JSONArray; type: ValueType.Array }
    | { value: JSONObject; type: ValueType.Object };

function getValueInfo(value: JSONValue): ValueInfo {
    if (value == null) {
        return {
            value: '-',
            type: ValueType.Inline,
        };
    }
    if (Array.isArray(value)) {
        return {
            value,
            type: ValueType.Array,
        };
    }
    if (typeof value === 'string') {
        const len = value.length;
        let valueType: ValueType.Inline | ValueType.Paragraph | ValueType.Prose;
        let displayValue = value;
        if (len < 80) {
            valueType = ValueType.Inline;
        } else if (len > 400) {
            valueType = ValueType.Prose;
        } else {
            valueType = ValueType.Paragraph;
            displayValue = value.replace(/(?:\n\n)+/g, '\n\n');
        }
        return { type: valueType, value: displayValue };
    } else if (typeof value === 'number' || typeof value === 'boolean') {
        return {
            value: String(value),
            type: ValueType.Inline,
        };
    } else {
        return {
            value: value as JSONObject,
            type: ValueType.Object,
        };
    }
}
