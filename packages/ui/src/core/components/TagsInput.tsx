import clsx from 'clsx';
import { X } from 'lucide-react';
import { useContext, useEffect, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverContext, PopoverTrigger } from './shadcn/popover';

interface TagsInputProps {
    options: string[];
    value: string[];
    onChange: (selected: string[]) => void;
    onOptionsChange?: (options: string[]) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    layout?: 'horizontal' | 'vertical';
    creatable?: boolean;
    createText?: string;
    maxDropdownHeight?: number;
}

function TagsInputContent({
    options,
    value,
    onChange,
    onOptionsChange,
    placeholder,
    className,
    disabled,
    layout = 'horizontal',
    creatable = false,
    createText = 'Create "%value%"',
    maxDropdownHeight = 200
}: TagsInputProps) {
    const popoverContext = useContext(PopoverContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [width, setWidth] = useState<number>(0);
    const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const highlightedItemRef = useRef<HTMLElement | null>(null);

    const isOpen = popoverContext?.open ?? false;
    const setIsOpen = popoverContext?.setOpen ?? (() => { });

    // Measure trigger width for popover
    useEffect(() => {
        const element = triggerRef.current;
        if (!element) return;

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

    // Filter options based on search term and exclude already selected
    const filteredOptions = options.filter(
        option =>
            !value.includes(option) &&
            option.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Check if create option should be shown
    const showCreateOption = creatable && searchTerm && !value.includes(searchTerm) && !options.includes(searchTerm);

    // Total number of items (filtered options + create option if shown)
    const totalItems = filteredOptions.length + (showCreateOption ? 1 : 0);

    // Reset highlighted index when filtered options change
    useEffect(() => {
        setHighlightedIndex(0);
    }, [searchTerm, showCreateOption]);

    // Clear pending delete when user starts typing
    useEffect(() => {
        if (searchTerm !== '') {
            setPendingDeleteIndex(null);
        }
    }, [searchTerm]);

    // Scroll highlighted item into view
    useEffect(() => {
        if (isOpen && highlightedItemRef.current && dropdownRef.current) {
            highlightedItemRef.current.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth'
            });
        }
    }, [highlightedIndex, isOpen]);

    // Clear search term when popover closes and refocus input when it opens
    useEffect(() => {
        if (!isOpen) {
            setSearchTerm('');
        } else {
            // Ensure input stays focused when popover opens
            inputRef.current?.focus();
        }
    }, [isOpen]);

    const handleSelect = (option: string) => {
        onChange([...value, option]);
        setSearchTerm('');
        setIsOpen(false);
        setHighlightedIndex(0);
        setPendingDeleteIndex(null);
    };

    const handleCreate = (newTag: string) => {
        // Add to value
        onChange([...value, newTag]);
        // Add to options if callback provided
        if (onOptionsChange && !options.includes(newTag)) {
            onOptionsChange([...options, newTag]);
        }
        setSearchTerm('');
        setIsOpen(false);
        setHighlightedIndex(0);
        setPendingDeleteIndex(null);
    };

    const handleRemove = (option: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(value.filter(v => v !== option));
        setPendingDeleteIndex(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Handle special keys
        if (e.key === 'Enter' && isOpen && totalItems > 0) {
            e.preventDefault();
            e.stopPropagation();
            // Check if we're selecting the create option
            if (highlightedIndex === filteredOptions.length && showCreateOption) {
                handleCreate(searchTerm);
            } else if (highlightedIndex < filteredOptions.length) {
                handleSelect(filteredOptions[highlightedIndex]);
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            if (!isOpen) {
                setIsOpen(true);
            } else {
                setHighlightedIndex(prev =>
                    prev < totalItems - 1 ? prev + 1 : prev
                );
            }
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            if (!isOpen) {
                setIsOpen(true);
            } else {
                setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
            }
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(false);
            return;
        }

        if (e.key === 'Backspace' && searchTerm === '' && value.length > 0) {
            // Two-step deletion: first backspace marks for deletion, second backspace deletes
            e.stopPropagation();
            const lastIndex = value.length - 1;

            if (pendingDeleteIndex === lastIndex) {
                // Second backspace: actually delete the item
                onChange(value.slice(0, -1));
                setPendingDeleteIndex(null);
            } else {
                // First backspace: mark for deletion
                setPendingDeleteIndex(lastIndex);
            }
            return;
        }

        // For any other key (typing characters), open dropdown
        if (!isOpen && e.key.length === 1) {
            setIsOpen(true);
        }
    };

    const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (!disabled) {
            setIsOpen(true);
        }
    };

    const handleInputFocus = () => {
        if (!disabled) {
            setIsOpen(true);
        }
    };

    const handleContainerClick = () => {
        if (!disabled) {
            inputRef.current?.focus();
        }
    };

    return (
        <div className={clsx('relative', className)}>
            <PopoverTrigger asChild>
                <div
                    ref={triggerRef}
                    className={clsx(
                        'min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-2',
                        'flex items-center gap-1',
                        layout === 'horizontal' ? 'flex-wrap' : 'flex-col items-stretch',
                        'cursor-text',
                        'ring-offset-background',
                        disabled && 'opacity-50 cursor-not-allowed',
                        isOpen ? 'ring-1 ring-inset ring-ring' : ''
                    )}
                    onClick={handleContainerClick}
                >
                    {/* Selected Items Badges - Vertical Layout */}
                    {layout === 'vertical' && value.length > 0 && (
                        <div className="flex flex-col gap-1 w-full">
                            {value.map((item, index) => (
                                <span
                                    key={item}
                                    className={clsx(
                                        "inline-flex items-center justify-between gap-2 px-2 py-1 text-sm bg-primary/10 text-primary rounded-md w-full transition-all",
                                        pendingDeleteIndex === index && "ring-2 ring-red-300 shadow-[0_0_8px_rgba(252,165,165,0.5)]"
                                    )}
                                >
                                    <span className="truncate">{item}</span>
                                    <button
                                        type="button"
                                        onClick={(e) => handleRemove(item, e)}
                                        disabled={disabled}
                                        className="hover:bg-primary/20 rounded-sm transition-colors flex-shrink-0"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Selected Items Badges - Horizontal Layout */}
                    {layout === 'horizontal' && value.map((item, index) => (
                        <span
                            key={item}
                            className={clsx(
                                "inline-flex items-center gap-1 px-2 py-1 text-sm bg-primary/10 text-primary rounded-md transition-all",
                                pendingDeleteIndex === index && "ring-2 ring-red-300 shadow-[0_0_8px_rgba(252,165,165,0.5)]"
                            )}
                        >
                            {item}
                            <button
                                type="button"
                                onClick={(e) => handleRemove(item, e)}
                                disabled={disabled}
                                className="hover:bg-primary/20 rounded-sm transition-colors"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))}

                    {/* Search Input */}
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onClick={handleInputClick}
                        onFocus={handleInputFocus}
                        disabled={disabled}
                        placeholder={value.length === 0 ? placeholder : ''}
                        className={clsx(
                            'flex-1 min-w-[120px] bg-transparent text-sm',
                            'placeholder:text-muted-foreground',
                            'border-none outline-none focus:outline-none focus:ring-0 p-0 m-0',
                            layout === 'vertical' && 'w-full'
                        )}
                    />
                </div>
            </PopoverTrigger>

            <PopoverContent
                style={{ width: `${width}px` }}
                className="p-0 bg-popover border border-border shadow-lg"
                align="start"
                side="bottom"
                onOpenAutoFocus={(e) => {
                    // Prevent the popover from stealing focus from the input
                    e.preventDefault();
                }}
            >
                <div ref={dropdownRef} className="overflow-y-auto" style={{ maxHeight: `${maxDropdownHeight}px` }}>
                    {filteredOptions.length === 0 && !showCreateOption ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                            {searchTerm ? 'No options found' : 'No more options available'}
                        </div>
                    ) : (
                        <>
                            {filteredOptions.length > 0 && (
                                <ul className="py-1">
                                    {filteredOptions.map((option, index) => (
                                        <li
                                            key={option}
                                            ref={(el) => {
                                                if (index === highlightedIndex) {
                                                    highlightedItemRef.current = el;
                                                }
                                            }}
                                            onClick={() => handleSelect(option)}
                                            onMouseEnter={() => setHighlightedIndex(index)}
                                            className={clsx(
                                                'px-3 py-2 text-sm cursor-pointer transition-colors',
                                                index === highlightedIndex
                                                    ? 'bg-blue-500/20 text-foreground'
                                                    : 'hover:bg-accent/50'
                                            )}
                                        >
                                            {option}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {showCreateOption && (
                                <>
                                    {filteredOptions.length > 0 && (
                                        <div className="border-t border-border" />
                                    )}
                                    <div
                                        ref={(el) => {
                                            if (highlightedIndex === filteredOptions.length) {
                                                highlightedItemRef.current = el;
                                            }
                                        }}
                                        onClick={() => handleCreate(searchTerm)}
                                        onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
                                        className={clsx(
                                            'px-3 py-2 text-sm cursor-pointer transition-colors text-primary',
                                            highlightedIndex === filteredOptions.length
                                                ? 'bg-blue-500/20'
                                                : 'hover:bg-accent/50'
                                        )}
                                    >
                                        {createText.replace('%value%', searchTerm)}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </PopoverContent>
        </div>
    );
}

export function TagsInput(props: TagsInputProps) {
    return (
        <Popover click>
            <TagsInputContent {...props} />
        </Popover>
    );
}
