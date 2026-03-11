import type { JSONArray, JSONObject, JSONValue } from "@vertesia/json";
import { DotBadge } from "@vertesia/ui/core";
import clsx from "clsx";
import { ReactNode } from "react";
import { computeTitleFromName } from "../form/ManagedObject.js";


interface JSONViewProps {
    value: JSONObject;
}
export function JSONView({ value }: JSONViewProps) {
    return <div className="flex flex-col gap-4 px-2 h-full overflow-auto">
        {
            Object.entries(value).map(([key, value]) =>
                <PropertyElement key={key} name={key} value={value as JSONValue} />
            )
        }
    </div>
}

interface PropertyTitleProps {
    name: string;
}
function PropertyTitle({ name }: PropertyTitleProps) {
    return (
        <div className='text-md font-semibold'>{computeTitleFromName(name)}</div>
    )
}

interface BlockElementProps {
    children: ReactNode | ReactNode[];
    className?: string;
}
function BlockElement({ children, className }: BlockElementProps) {
    return (<div className={clsx('flex flex-col gap-4 py-2 pl-4 border-l-4 border-l-solid border-l-slate-100 dark:border-l-slate-600', className)}>
        {children}
    </div>)
}

interface PropertyElementProps {
    name: string;
    value: JSONValue;
}
function PropertyElement({ name, value }: PropertyElementProps) {
    const info = getValueInfo(value);
    switch (info.type) {
        case ValueType.Inline:
            return (<div className='w-full flex gap-2'>
                <PropertyTitle name={name + ':'} />
                <p>{info.value}</p>
            </div>)
        case ValueType.Paragraph:
            return (<div>
                <PropertyTitle name={name} />
                <p>{info.value}</p>
            </div>)
        case ValueType.Prose:
            return (<div className="prose dark:prose-invert">
                <PropertyTitle name={name} />
                <div className='vprose dark:prose-invert'>{info.value}</div>
            </div>)
        case ValueType.Array:
            return (
                <ArrayProperty name={name} value={value as JSONArray} />
            )
        case ValueType.Object:
            return (
                <div>
                    <PropertyTitle name={name} />
                    <BlockElement className='mt-2'>
                        {
                            Object.entries(value as JSONObject).map(([key, value]) => <PropertyElement key={key} name={key} value={value as JSONValue} />)
                        }
                    </BlockElement>
                </div>
            )
    }
}

interface ArrayPropertyProps {
    name?: string,
    value: JSONArray;
}
function ArrayProperty({ name, value }: ArrayPropertyProps) {
    const inlineLength = value.join(' ').length;
    const itemMediumLength = inlineLength / value.length;
    const isInline = (typeof value[0] === 'string') && (inlineLength < 80 || inlineLength < 400 && itemMediumLength < 32);
    const useBullet = value.length > 9;
    return isInline ? (
        <div className='flex gap-2 flex-wrap'>
            {name && <PropertyTitle name={name + ':'} />}
            {value.map((item, index) => <DotBadge key={index}>{String(item)}</DotBadge>)}
        </div>
    ) : (
        <div>
            {name && <PropertyTitle name={name} />}
            <div className='flex flex-col gap-2'>
                {
                    (value as JSONArray).map((value, index) => <ItemProperty key={index} index={index} value={value} useBullet={useBullet} />)
                }
            </div>
        </div>
    )
}

interface ItemPropertyProps {
    index: number;
    value: JSONValue;
    useBullet?: boolean;
}
function ItemProperty({ index, value, useBullet }: ItemPropertyProps) {
    const bullet = useBullet ? <span className='text-xl'>&bull;</span> : <span>{index + 1}.</span>
    const info = getValueInfo(value);
    let content;
    switch (info.type) {
        case ValueType.Object:
            content = <BlockElement>
                {
                    Object.entries(value as JSONObject).map(([key, value]) => <PropertyElement key={key} name={key} value={value as JSONValue} />)
                }
            </BlockElement>
            break;
        case ValueType.Array:
            content = <ArrayProperty value={value as JSONArray} />;
            break;
        case ValueType.Prose: content = <div className="prose dark:prose-invert">{info.value}</div>
            break;
        default: content = <div>{info.value}</div>
            break;
    }
    return (
        <div className='flex gap-4 hover:bg-slate-50 dark:hover:bg-slate-800 py-2 pr-2 pl-4'>
            <div className='font-semibold text-gray-600 dark:text-gray-400'>{bullet}</div>
            <div>{content}</div>
        </div>
    )
}

enum ValueType {
    Inline,
    Paragraph,
    Prose,
    Array,
    Object
}
function getValueInfo(value: JSONValue): { value: any, type: ValueType } {
    if (value == null) {
        return {
            value: '-',
            type: ValueType.Inline
        }
    }
    if (Array.isArray(value)) {
        return {
            value,
            type: ValueType.Array
        }
    }
    const type = typeof value;
    if (type === 'string') {
        const len = (value as string).length;
        let type;
        if (len < 80) {
            type = ValueType.Inline;
        } else if (len > 400) {
            type = ValueType.Prose;
        } else {
            type = ValueType.Paragraph;
            value = (value as string).replace(/(?:\n\n)+/g, '\n\n')
        }
        return { type, value };
    } else if (type === 'number' || type === 'boolean') {
        return {
            value: String(value),
            type: ValueType.Inline
        }
    } else {
        return {
            value,
            type: ValueType.Object
        }
    }
}
