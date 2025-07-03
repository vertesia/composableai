import clsx from 'clsx';
import { isEqual } from 'lodash-es';
import { Check, ChevronsUpDown, SearchIcon, SquarePlus, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from './popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from './command';
import { Input } from './input';

interface VSelectBoxBaseProps<T> {
    options: T[] | undefined;
    optionLabel?: (option: T) => React.ReactNode;
    onBlur?: () => void;
    onKeyDown?: (e: React.KeyboardEvent, isOpen: boolean) => void;
    label?: string;
    placeholder?: string;
    addNew?: () => void;
    addNewLabel?: string;
    disabled?: boolean;
    filterBy?: string | ((o: T) => string);
    by?: (keyof T & string) | ((a: T, z: T) => boolean)
    className?: string;
    popupClass?: string;
    isClearable?: boolean;
    border?: boolean;
}

interface VSelectBoxSingleProps<T> extends VSelectBoxBaseProps<T> {
    multiple?: false;
    value?: T;
    onChange: (option: T) => void;
}

interface VSelectBoxMultipleProps<T> extends VSelectBoxBaseProps<T> {
    multiple: true;
    value?: T[];
    onChange: (options: T[]) => void;
}

type VSelectBoxProps<T> = VSelectBoxSingleProps<T> | VSelectBoxMultipleProps<T>;

export function VSelectBox<T = any>({ options, optionLabel, value, onChange, addNew, addNewLabel, disabled, filterBy, label, placeholder, className, popupClass, isClearable, border = true, multiple = false, by }: Readonly<VSelectBoxProps<T>>) {
    const triggerRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [width, setWidth] = useState<number>(0);
    const [filterValue, setFilterValue] = useState('');

    useEffect(() => {
        const element = triggerRef.current;
        if (!element) {
            return;
        }

        const updateWidth = () => {
            const contentWidth = element.getBoundingClientRect().width;
            setWidth(contentWidth);
        };

        const resizeObserver = new ResizeObserver(() => {
            updateWidth();
        });

        updateWidth();
        resizeObserver.observe(element);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    const handleTriggerClick = (e: React.MouseEvent) => {
        if (disabled) {
            e.preventDefault();
            return;
        }
        setOpen(!open);
    };

    const _onClick = (opt: any) => {
        if (multiple) {
            const currentValues = Array.isArray(value) ? value : [];
            const isSelected = isOptionSelected(opt, currentValues);

            if (isSelected) {
                // Remove from selection
                const newValues = currentValues.filter(v => !isOptionsEqual(v, opt));
                (onChange as (options: T[]) => void)(newValues);
            } else {
                // Add to selection
                (onChange as (options: T[]) => void)([...currentValues, opt]);
            }
            // Don't close the popover in multiple mode
        } else {
            setOpen(false);
            (onChange as (option: T) => void)(opt);
        }
    };

    // Helper function to check if an option is selected
    const isOptionSelected = (option: T, selectedValues: T[]): boolean => {
        if (!selectedValues || selectedValues.length === 0) return false;
        return selectedValues.some(v => isOptionsEqual(v, option));
    };

    // Helper function to compare options for equality
    const isOptionsEqual = (a: T, b: T): boolean => {
        // Handle null/undefined values
        if (a == null || b == null) {
            return a === b;
        }
        
        if (typeof by === 'string') {
            return (a as any)[by] === (b as any)[by];
        } else if (typeof by === 'function') {
            return by(a, b);
        } else {
            return isEqual(a, b);
        }
    };

    let filteredOptions = options || [];

    function getFilterByFn<T>(filterBy?: string | ((o: T) => string)) {
        if (!filterBy) {
            return (o: T) => String(o).toLowerCase();
        } else if (typeof filterBy === 'string') {
            return (o: any) => String(o[filterBy]).toLowerCase();
        } else {
            return filterBy;
        }
    }

    const filterLc = filterValue.toLowerCase();
    const filterFn = getFilterByFn(filterBy);
    filteredOptions = filteredOptions.filter(o => filterFn(o).includes(filterLc))

    const renderSingleValue = () => {
        if (!value || (Array.isArray(value) && value.length === 0)) {
            return <span className="text-muted">{placeholder}</span>;
        }
        const singleValue = Array.isArray(value) ? value[0] : value;
        return optionLabel ? optionLabel(singleValue) : singleValue as string;
    };

    const renderMultipleValue = () => {
        const arrayValue = Array.isArray(value) ? value : (value ? [value] : []);

        if (arrayValue.length === 0) {
            return <span className="text-muted">{placeholder}</span>;
        }

        if (arrayValue.length === 1) {
            return optionLabel ? optionLabel(arrayValue[0]) : arrayValue[0] as string;
        }

        return (
            <div className="flex flex-wrap gap-1">
                {arrayValue.slice(0, 1).map((item, index) => (
                    <span key={index} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted rounded">
                        {optionLabel ? optionLabel(item) : item as string}
                    </span>
                ))}
                {arrayValue.length > 1 && (
                    <span className="inline-flex items-center px-2 py-1 text-xs bg-muted rounded">
                        +{arrayValue.length - 1} more
                    </span>
                )}
            </div>
        );
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <div
                    ref={triggerRef}
                    onClick={handleTriggerClick}
                    className={clsx(
                        className,
                        border && 'border border-border',
                        'flex flex-row gap-2 items-center justify-between p-2 rounded-md group relative',
                        !disabled ? "cursor-pointer hover:bg-muted" : "cursor-not-allowed text-muted",
                    )}
                >
                    <div
                        className={clsx(
                            "flex flex-col w-full rounded-md text-sm items-center justify-center truncate",
                            !disabled && "",
                            isClearable && value && (Array.isArray(value) ? value.length > 0 : true) && "pr-6"
                        )}
                    >
                        {label && <div className='w-full text-left text-xs font-semibold'>{label}</div>}
                        <div className={clsx('w-full text-left', !disabled && '')}>
                            {multiple ? renderMultipleValue() : renderSingleValue()}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {isClearable && value && (Array.isArray(value) ? value.length > 0 : true) && (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (multiple) {
                                        (onChange as (options: T[]) => void)([] as T[]);
                                    } else {
                                        (onChange as (option: T) => void)(undefined as any);
                                    }
                                }}
                                className="cursor-pointer hover:bg-muted/20 rounded p-1"
                            >
                                <X className="size-4" />
                            </div>
                        )}
                        {!disabled && (
                            <ChevronsUpDown className="size-4 opacity-50" />
                        )}
                    </div>
                </div>
            </PopoverTrigger>

            <PopoverContent
                style={{ width: `${width}px`, zIndex: 1000000 }}
                className={clsx(
                    "min-w-[8rem] w-64 bg-popover p-1 border shadow",
                    "divide-y divide-border",
                    popupClass
                )}
            >
                {filterBy && (

                    <div className='flex justify-start items-center mb-1'>
                        <div className='mx-2'>
                            <SearchIcon className="size-4" />
                        </div>
                        <Input variant='unstyled' value={filterValue} onChange={setFilterValue} className="w-full p-1 rounded-md" placeholder="Search..." />
                    </div>
                )}
                <Command className="overflow-hidden">
                    <CommandList className="max-h-[200px] overflow-y-auto">
                        <CommandEmpty>No result found.</CommandEmpty>
                        <CommandGroup className="overflow-visible">
                            {filteredOptions?.map((opt, index) => {
                                const isSelected = multiple
                                    ? isOptionSelected(opt, Array.isArray(value) ? value : [])
                                    : value != null ? isOptionsEqual(value as T, opt) : false;

                                return (
                                    <CommandItem
                                        key={index}
                                        onSelect={() => _onClick(opt)}
                                        className="w-full"
                                    >
                                        {multiple ? (
                                            <div className='w-full flex justify-between items-center cursor-pointer'>
                                                <div className='w-full truncate text-left'>
                                                    {optionLabel ? optionLabel(opt) : opt as String}
                                                </div>
                                                {isSelected && <Check className="size-4" />}
                                            </div>
                                        ) : (
                                            <PopoverClose className='w-full flex justify-between items-center'>
                                                <div className='w-full truncate text-left'>
                                                    {optionLabel ? optionLabel(opt) : opt as String}
                                                </div>
                                                {isSelected && <Check className="size-4" />}
                                            </PopoverClose>
                                        )}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
                {
                    addNew && (
                        <div className='p-1'>
                            <a
                                onClick={addNew}
                                className={clsx(
                                    'gap-x-2 px-2 py-1.5 truncate group flex rounded-md items-center text-sm cursor-pointer hover:bg-accent',
                                )}
                            >
                                <SquarePlus size={16} strokeWidth={1.25} absoluteStrokeWidth />
                                {addNewLabel}
                            </a>
                        </div>
                    )
                }
            </PopoverContent>
        </Popover>
    );
}