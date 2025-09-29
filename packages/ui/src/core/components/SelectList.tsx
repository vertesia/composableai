import { Check } from "lucide-react";
import clsx from "clsx";
import { ReactNode, useMemo, useState } from "react";
import { Input } from "./shadcn";

const Default_Option_Style = "flex-1 px-2 py-2 hover:bg-accent nowrap";

export interface OptionLayout {
    label?: ReactNode;
    check?: ReactNode;
    reverse?: boolean; // whether to reverse the layout and show the check box on the right
    className?: string;
}

function defaultOptionLayout<T>(option: T, isSelected: boolean): OptionLayout {
    return {
        label: String(option),
        check: isSelected ? <Check className='size-4' /> : <div className="size-4" />,
        reverse: false,
        className: Default_Option_Style,
    }
}

export interface SelectListProps<T> {
    value?: T;
    options: T[];
    onChange: (value: T) => void;
    className?: string;
    by?: (keyof T & string) | ((o1: T, o2: T) => boolean);
    optionLayout?: (opt: T, selected: boolean) => OptionLayout;
    noCheck?: boolean;
    filterBy?: (filterValue: string) => (opt: T) => boolean;
}
export function SelectList<T>({ value, options, onChange, className, optionLayout, by, noCheck, filterBy }: SelectListProps<T>) {
    const [selected, setSelected] = useState(value);
    const [filterValue, setFilterValue] = useState("");

    const onSelect = (option: T) => {
        setSelected(option);
        onChange(option);
    }
    const optionEquals = useMemo(() => {
        if (typeof by === 'string') {
            return (o1: T, o2: T) => o1[by] === o2[by];
        } else if (!by) {
            return (o1: T, o2: T) => o1 === o2;
        } else {
            return by as (o1: T, o2: T) => boolean;
        }
    }, [by]);
    return (
        <div className={clsx("", className)}>
            {filterBy && (
                <Input type="text" placeholder="Filter..." value={filterValue} onChange={(value) => setFilterValue(value)} />
            )}
            {options.map((option, i) => {
                if (filterBy && !filterBy(filterValue)(option)) {
                    return null;
                }
                const isSelected = selected ? optionEquals(selected, option) : false;
                let layout: OptionLayout;
                if (optionLayout) {
                    layout = optionLayout(option, isSelected);
                    layout = Object.assign(defaultOptionLayout(option, isSelected), layout);
                } else {
                    layout = defaultOptionLayout(option, isSelected);
                }
                return (
                    <SelectListOption key={i}
                        option={option}
                        onSelect={onSelect}
                        layout={layout}
                        noCheck={noCheck}
                    />
                )
            })}
        </div>
    )
}
interface SelectListOptionProps<T> {
    option: T;
    onSelect: (value: T) => void;
    layout: OptionLayout;
    noCheck?: boolean;
}

function SelectListOption<T>({ option, onSelect, layout, noCheck }: SelectListOptionProps<T>) {
    return (
        <div className={clsx('group flex items-center cursor-pointer gap-x-2 hover:bg-muted',
            layout.reverse && 'flex-row-reverse', layout.className)} onClick={() => onSelect(option)}>
            {noCheck ? null : <div className="">{layout.check}</div>}
            <div className='flex-1'>{layout.label}</div>
        </div>
    )
}
