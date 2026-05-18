import clsx from 'clsx';
import { isEqual } from 'lodash-es';
import { AlertTriangle, Check, ChevronsUpDown, LoaderCircle, SearchIcon, SquarePlus, X } from 'lucide-react';
import { useState, useEffect, useRef, useMemo, useId, ReactNode } from 'react';

import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from './popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from './command';
import { Input } from './input';
import { Button } from './button';
import { VTooltip } from './tooltip';

export interface SelectBoxBaseProps<T> {
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
    inline?: boolean;
    clearIcon?: ReactNode;
    clearTitle?: string;
    isLoading?: boolean;
    /** Show warning when value is not in options list (default: true) */
    warnOnMissingValue?: boolean;
    /** Custom warning message when value is not in options */
    missingValueWarning?: string;
    /** Accessible name. Defaults to the `label` prop when provided. Required when icon-only. */
    'aria-label'?: string;
    /** Id of an element that labels the trigger. Use when there is a visible external label. */
    'aria-labelledby'?: string;
    /** Id forwarded to the trigger button. Required for FormItem's auto-wiring to work. */
    id?: string;
    /** Ids of elements describing the control (e.g. FormItem helpText/error). Forwarded to the trigger. */
    'aria-describedby'?: string;
    /** Marks the control invalid. Forwarded to the trigger and combined with the internal
     *  missing-value detection (either being truthy yields aria-invalid="true"). */
    'aria-invalid'?: boolean | 'true' | 'false';
}

interface SelectBoxSingleProps<T> extends SelectBoxBaseProps<T> {
    multiple?: false;
    value?: T;
    onChange: (option: T) => void;
}

interface SelectBoxMultipleProps<T> extends SelectBoxBaseProps<T> {
    multiple: true;
    value?: T[];
    onChange: (options: T[]) => void;
}

type SelectBoxProps<T> = SelectBoxSingleProps<T> | SelectBoxMultipleProps<T>;

export function SelectBox<T = any>({
    options,
    optionLabel,
    value,
    onChange,
    addNew,
    addNewLabel,
    disabled,
    filterBy,
    label,
    placeholder,
    className,
    popupClass,
    isClearable,
    border = true,
    multiple = false,
    by,
    inline = false,
    isLoading = false,
    warnOnMissingValue = true,
    missingValueWarning = "Value not in options list, may not be valid",
    clearIcon,
    clearTitle,
    'aria-label': ariaLabelProp,
    'aria-labelledby': ariaLabelledByProp,
    id: idProp,
    'aria-describedby': ariaDescribedByProp,
    'aria-invalid': ariaInvalidProp,
}: Readonly<SelectBoxProps<T>>) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [width, setWidth] = useState<number>(0);
    const [filterValue, setFilterValue] = useState('');
    const popupId = useId();
    const labelId = useId();

    // Check if value is in options list (for single select only)
    const isMissingValue = useMemo(() => {
        if (!warnOnMissingValue || multiple || value == null || !options) return false;
        // Use the isOptionsEqual helper which respects the 'by' comparator
        return !options.some(opt => {
            if (typeof by === 'string') {
                return (opt as any)[by] === (value as any)[by];
            } else if (typeof by === 'function') {
                return by(opt, value as T);
            } else {
                return isEqual(opt, value);
            }
        });
    }, [warnOnMissingValue, multiple, value, options, by]);

    useEffect(() => {
        const element = wrapperRef.current;
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
            // Single-select non-inline: PopoverClose (in the rendered CommandItem) dispatches
            // the close to Radix, which calls onOpenChange and updates our `open` mirror.
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

    // Render the options list content
    const renderOptionsContent = () => (
        <>
            {filterBy && (
                <div className='flex justify-start items-center mb-1'>
                    <div className='mx-2'>
                        <SearchIcon className="size-4" />
                    </div>
                    <Input variant='unstyled' value={filterValue} onChange={setFilterValue} className="w-full p-1 rounded-md" placeholder="Search..." />
                </div>
            )}
            <Command className="overflow-hidden">
                <CommandList
                    className={inline ? "max-h-full overflow-y-auto" : "max-h-[200px] overflow-y-auto"}
                    onWheel={(e) => { e.currentTarget.scrollTop += e.deltaY; }}
                >
                    <CommandEmpty>No result found.</CommandEmpty>
                    <CommandGroup>
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
                                    {multiple || inline ? (
                                        <div className='w-full flex justify-between items-center cursor-pointer'>
                                            <div className='w-full truncate text-start'>
                                                {optionLabel ? optionLabel(opt) : opt as String}
                                            </div>
                                            {isSelected && <Check className="size-4" />}
                                        </div>
                                    ) : (
                                        <PopoverClose className='w-full flex justify-between items-center'>
                                            <div className='w-full truncate text-start'>
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
            {addNew && (
                <div className='p-1'>
                    <button
                        type="button"
                        onClick={addNew}
                        className={clsx(
                            'w-full text-start gap-x-2 px-2 py-1.5 truncate group flex rounded-md items-center text-sm cursor-pointer hover:bg-accent bg-transparent border-0',
                        )}
                    >
                        <SquarePlus size={16} strokeWidth={1.25} absoluteStrokeWidth />
                        {addNewLabel}
                    </button>
                </div>
            )}
        </>
    );

    if (inline) {
        return (
            <div className={clsx(
                className,
                border && 'border border-border rounded-md',
                "bg-popover p-1",
                popupClass
            )}>
                {isLoading
                    ? <div className="flex justify-center items-center p-2 text-muted text-sm"><LoaderCircle className="size-4 animate-spin" /></div>
                    : renderOptionsContent()
                }
            </div>
        );
    }

    // Accessible name resolution: explicit aria-label > visual label text > none.
    // When `label` is set we also expose it via aria-labelledby pointing at the
    // visible label element rendered inside the trigger.
    const hasVisualLabel = !!label;
    const ariaLabel = ariaLabelProp ?? (hasVisualLabel ? undefined : (typeof placeholder === 'string' ? placeholder : undefined));
    const ariaLabelledBy = ariaLabelledByProp ?? (hasVisualLabel ? labelId : undefined);

    const showClear = !!isClearable && !!value && (Array.isArray(value) ? value.length > 0 : true);

    // aria-invalid resolves to true if either the consumer set it or the
    // internal missing-value check fires. Either truthy yields "true".
    const ariaInvalid = ariaInvalidProp === true || ariaInvalidProp === 'true' || isMissingValue
        ? true
        : (ariaInvalidProp === false || ariaInvalidProp === 'false' ? false : undefined);

    return (
        // The Vertesia Popover wrapper is uncontrolled; onOpenChange mirrors Radix's
        // own open/close into our local `open` so we can drive aria-expanded correctly.
        <Popover onOpenChange={setOpen}>
            {/* Consumer `className` is applied to the wrapper (the visible bounding box)
                so width/spacing overrides size the popover correctly. The trigger button
                is always w-full of the wrapper; the absolutely-positioned clear button
                is positioned relative to the wrapper. */}
            <div ref={wrapperRef} className={clsx("relative", className)}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        id={idProp}
                        disabled={disabled || isLoading}
                        aria-haspopup="dialog"
                        aria-expanded={open}
                        aria-controls={popupId}
                        aria-label={ariaLabel}
                        aria-labelledby={ariaLabelledBy}
                        aria-describedby={ariaDescribedByProp}
                        aria-invalid={ariaInvalid}
                        className={clsx(
                            isLoading
                                ? 'flex w-full justify-center items-center gap-2 border border-border rounded-md p-2 text-muted text-sm bg-transparent'
                                : clsx(
                                    border && (isMissingValue || ariaInvalid ? 'border border-destructive' : 'border border-border'),
                                    'flex w-full flex-row gap-2 items-center justify-between p-2 rounded-md group bg-transparent text-inherit text-start',
                                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                                    !disabled ? "cursor-pointer hover:bg-muted" : "cursor-not-allowed text-muted",
                                    // Leave room for the absolutely-positioned clear button on the right.
                                    showClear && 'pe-10',
                                ),
                        )}
                    >
                        {isLoading ? (
                            <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                            <>
                                <div
                                    className={clsx(
                                        "flex flex-col w-full rounded-md text-sm min-h-6 items-center justify-center truncate",
                                    )}
                                >
                                    {label && (
                                        <div id={labelId} className='w-full text-start text-xs font-semibold'>{label}</div>
                                    )}
                                    <div className={clsx('w-full text-start ', isMissingValue && 'text-destructive')}>
                                        {isMissingValue && (
                                            <VTooltip description={missingValueWarning} placement="top" asChild>
                                                <AlertTriangle className="inline-block size-4 me-1 -mt-0.5 cursor-help" />
                                            </VTooltip>
                                        )}
                                        {multiple ? renderMultipleValue() : renderSingleValue()}
                                    </div>
                                </div>
                                {!disabled && (
                                    <ChevronsUpDown className="size-4 opacity-50 shrink-0" aria-hidden="true" />
                                )}
                            </>
                        )}
                    </button>
                </PopoverTrigger>
                {showClear && !isLoading && (
                    // Clear is a sibling of the trigger button (not nested) to satisfy
                    // the no-nested-interactives rule. Pointer/keyboard events are
                    // stopped so they don't bubble up and toggle the popover.
                    <Button
                        variant="link"
                        size="icon"
                        disabled={disabled}
                        aria-label={clearTitle || "Clear selection"}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (multiple) {
                                (onChange as (options: T[]) => void)([] as T[]);
                            } else {
                                (onChange as (option: T) => void)(undefined as any);
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation();
                            }
                        }}
                        className="absolute end-8 top-1/2 -translate-y-1/2 hover:bg-muted/20 rounded p-1"
                    >
                        {clearIcon ? clearIcon : <X className="size-4" />}
                    </Button>
                )}
            </div>

            <PopoverContent
                id={popupId}
                style={{ width: `${width}px`, zIndex: 1000000 }}
                className={clsx(
                    "min-w-[8rem] w-64 bg-popover p-1 border shadow",
                    "divide-y divide-border",
                    popupClass
                )}
            >
                {renderOptionsContent()}
            </PopoverContent>
        </Popover>
    );
}
