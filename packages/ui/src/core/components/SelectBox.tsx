import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { X, Check, ChevronsUpDownIcon } from "lucide-react";
import clsx from "clsx";
import { ComponentType, KeyboardEvent, ReactNode, SyntheticEvent, useState, useEffect, useRef } from "react";
import { Button } from "./Button";
import { Center } from "./Center";

type OnChangeClearableSelectFn<T> = (option: T | undefined) => void;
type OnChangeNonClearableSelectFn<T> = (option: T) => void;

interface SelectBoxBaseProps<T> {
    options: T[] | undefined
    optionLabel?: (option: T) => ReactNode
    value?: T
    onChange: OnChangeNonClearableSelectFn<T>
    className?: string
    // compare for equality by field or comparison function
    by?: (keyof T & string) | ((a: T, z: T) => boolean)
    placeholder?: ReactNode
    addNew?: () => void
    addNewLabel?: string
    disabled?: boolean
    isClearable?: false
    showFilter?: boolean | string
    filterBy?: string | ((o: T) => string)
    ClearIcon?: ComponentType<any>
    clearTitle?: string | undefined
    label?: string | undefined
}
interface ClearableSelectBoxProps<T> extends Omit<SelectBoxBaseProps<T>, 'isClearable' | 'onChange'> {
    onChange: OnChangeClearableSelectFn<T>
    isClearable: true
}
// interface NonClearableSelectBoxProps<T> extends Omit<SelectBoxBaseProps<T>, 'onChange'> {
//     onChange: OnChangeNonClearableSelectFn<T>
// }

type SelectBoxProps<T> = ClearableSelectBoxProps<T> | SelectBoxBaseProps<T>

function getFilterByFn<T>(filterBy?: string | ((o: T) => string)) {
    if (!filterBy) {
        return (o: T) => String(o).toLowerCase();
    } else if (typeof filterBy === 'string') {
        return (o: any) => String(o[filterBy]).toLowerCase();
    } else {
        return filterBy;
    }
}

export function SelectBox<T>({ clearTitle, ClearIcon = X, showFilter, filterBy, isClearable, disabled, by, options, value, onChange, className, addNew, addNewLabel, placeholder, optionLabel = (option) => String(option), label }: SelectBoxProps<T>) {
    const [filter, setFilter] = useState<string>();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [buttonWidth, setButtonWidth] = useState<number>();

    useEffect(() => {
        if (buttonRef.current) {
            const resizeObserver = new ResizeObserver((entries) => {
                setButtonWidth(entries[0].contentRect.width);
            });
            resizeObserver.observe(buttonRef.current);
            return () => resizeObserver.disconnect();
        }
    }, []);

    const onClear = (e: SyntheticEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isClearable) {
            (onChange as any)(undefined);
        }
    }
    const onFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilter(e.target.value);
    }
    let filteredOptions = options || [];
    if (showFilter === undefined) {
        showFilter = filteredOptions?.length >= 10;
    }
    if (showFilter && filter) {
        const filterLc = filter.toLowerCase();
        const filterFn = getFilterByFn(filterBy);
        filteredOptions = filteredOptions.filter(o => filterFn(o).includes(filterLc))
    }
    const onFilterKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "Escape"
            && e.key !== "Enter"
            && e.key !== "ArrowDown"
            && e.key !== "ArrowUp") {
            e.stopPropagation()
        }
    }
    return (
        <Listbox value={value || null} onChange={onChange} by={by} disabled={disabled}>
            {() => (
                <div className={'overflow-y-visible ' + className}>
                    <div className="relative">
                        <ListboxButton
                            ref={buttonRef}
                            className="relative w-full cursor-default rounded-md bg-white py-1.5 text-left text-gray-900 shadow-2xs ring-1 ring-inset ring-gray-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-600 dark:ring-slate-600 dark:text-slate-50 dark:bg-slate-800 sm:text-sm sm:leading-6 hover:cursor-pointer"
                        >
                            {label && <div className='w-full text-gray-500 text-left px-2'>{label}</div>}
                            <span className="block truncate pl-3 pr-14">{value ? optionLabel(value) : placeholder}</span>
                            {
                                isClearable && value != null && <span className="absolute inset-y-0 right-0 mr-5 flex items-center pr-2" onClick={onClear}>
                                    <ClearIcon title={clearTitle} className="size-5 text-gray-400 hover:text-red-500 cursor-pointer" aria-hidden="true" />
                                </span>
                            }
                            {
                                !disabled &&
                                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                    <ChevronsUpDownIcon className="size-5 text-gray-400" aria-hidden="true" />
                                </span>
                            }
                        </ListboxButton>
                        {/*
                        <Transition
                            show={open}
                            as={Fragment}
                            leave="transition ease-in duration-100"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                        >
                            */}
                        <ListboxOptions
                            anchor="bottom"
                            style={{ width: buttonWidth, zIndex: 100000000 }}
                            className="absolute z-10 mt-1 overflow-auto rounded-md bg-white dark:ring-slate-600 dark:text-slate-50 dark:bg-slate-800 py-1 text-base shadow-lg ring-1 ring-gray-300 ring-opacity-5 focus:outline-hidden sm:text-sm"
                        >
                            {showFilter &&
                                <div className="p-1">
                                    <input type="text" value={filter || ''} onKeyDown={onFilterKeyDown} onChange={onFilterChange} className="w-full p-1 border border-gray-300 rounded-md dark:bg-slate-700 dark:text-slate-50" placeholder="Filter..." />
                                </div>
                            }
                            <div className="overflow-y-auto max-h-60">
                                {filteredOptions.map((option, i) =>
                                    <ListOption key={i} option={option} optionLabel={optionLabel} className="hover:cursor-pointer"></ListOption>
                                )}
                            </div>
                            {addNew &&
                                <Center className="font-semibold py-2 border-t">
                                    <Button variant='secondary' onClick={addNew}>{addNewLabel}</Button>
                                </Center>
                            }
                        </ListboxOptions>

                        {/*</Transition>*/}
                    </div>
                </div>
            )
            }
        </Listbox >
    )
}


export function ListOption<T>({ option, optionLabel, onClick, className }: { option: T, optionLabel: (option: T) => ReactNode, onClick?: () => void, value?: T, className?: string }) {
    return (
        <ListboxOption
            className={({ active }) =>
                clsx(
                    active ? 'bg-indigo-600 text-white dark:bg-indigo-800 dark:text-white' : 'text-gray-900 dark:text-slate-50',
                    'relative cursor-default select-none py-2 pl-3 pr-9',
                    className
                )
            }
            value={option}
            onClick={onClick}
        >
            {({ selected, active }) => (
                <>
                    <div className={clsx(selected ? 'font-semibold' : 'font-inherit', 'block truncate')}>
                        {optionLabel(option)}
                    </div>

                    {selected ? (
                        <div
                            className={clsx(
                                active ? 'text-white' : 'text-indigo-600',
                                'absolute inset-y-0 right-0 flex items-center pr-4'
                            )}
                        >
                            <Check className="size-5" aria-hidden="true" />
                        </div>
                    ) : null}
                </>
            )}
        </ListboxOption>)
}
