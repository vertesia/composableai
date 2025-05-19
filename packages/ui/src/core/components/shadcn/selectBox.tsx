import clsx from 'clsx';
import { isEqual } from 'lodash-es';
import { Check, ChevronsUpDown, SearchIcon, SquarePlus, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from './popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from './command';
import { VInput } from './input';

interface VSelectBoxProps<T> {
    options: T[] | undefined;
    value?: T;
    optionLabel?: (option: T) => React.ReactNode;
    onChange: (option: T) => void;
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

export function VSelectBox<T = any>({ options, optionLabel, value, onChange, addNew, addNewLabel, disabled, filterBy, label, placeholder, className, popupClass, isClearable, border= true }: Readonly<VSelectBoxProps<T>>) {
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
        setOpen(false);
        onChange(opt);
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

    return (
        <Popover>
            <PopoverTrigger asChild>
                <div
                    ref={triggerRef}
                    onClick={handleTriggerClick}
                    className={clsx(
                        className,
                        border && 'border border-border',
                        'flex flex-row gap-2 items-center justify-between p-2 rounded-md group',
                        !disabled && "cursor-pointer hover:bg-accent hover:text-muted"
                    )}
                >
                    <div
                        className={clsx(
                            "flex flex-col w-fill rounded-md text-sm items-center justify-center truncate ",
                            !disabled && ""
                        )}
                    >
                        {label && <div className='w-full text-left text-xs font-semibold'>{label}</div>}
                        <div className={clsx('w-full text-left', !disabled && '')}>
                            {value ? (optionLabel ? optionLabel(value) : value as string) : placeholder}
                        </div>
                        {isClearable && value && (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                }}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 cursor-pointer"
                            >
                                <X className="size-4" />
                            </div>
                        )}
                    </div>
                    {
                        !disabled && (
                            <ChevronsUpDown className="size-4 opacity-50" />
                        )
                    }
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
                        <VInput variant='unstyled' value={filterValue} onChange={setFilterValue} className="w-full p-1 rounded-md" placeholder="Search..." />
                    </div>
                )}
                <Command className="overflow-hidden">
                    <CommandList className="max-h-[200px] overflow-y-auto">
                        <CommandEmpty>No result found.</CommandEmpty>
                        <CommandGroup className="overflow-visible">
                            {filteredOptions?.map((opt, index) => (
                                <CommandItem
                                    key={index}
                                    onSelect={() => _onClick(opt)}
                                    className="w-full cursor-pointer hover:bg-accent hover:text-muted"
                                >
                                    <PopoverClose className='w-full flex justify-between items-center'>
                                        <div className='w-full truncate text-left'>
                                            {optionLabel ? optionLabel(opt) : opt as String}
                                        </div>
                                        {isEqual(value, opt) && <Check className="size-4" />}
                                    </PopoverClose>
                                </CommandItem>
                            ))}
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