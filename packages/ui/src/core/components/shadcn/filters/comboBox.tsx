import { useRef, useState, useEffect } from "react";
// import { AnimatePresence, motion } from "motion/react";
import dayjs from "dayjs";
import { Calendar } from "../calendar";
import ReactCalendar from "react-calendar";

import { Button } from "../button";
import { Checkbox } from "../checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "../command";
import { Input } from "../input";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { AnimateChangeInHeight } from "./animateChangeInHeight";
import { FilterGroupOption, FilterOption } from "./types";
import { DynamicLabel } from "./DynamicLabel";
import { InputList } from "../../index";


export const SelectionCombobox = ({
    filterType,
    filterValues,
    setFilterValues,
    options,
    labelRenderer,
}: {
    filterType: string;
    filterValues: FilterOption[];
    setFilterValues: (filterValues: FilterOption[]) => void;
    options: FilterGroupOption[];
    labelRenderer?: (value: string) => React.ReactNode | Promise<React.ReactNode>;
}) => {
    const [open, setOpen] = useState(false);
    const [commandInput, setCommandInput] = useState("");
    const commandInputRef = useRef<HTMLInputElement>(null);
    const nonSelectedFilterValues = options?.filter(
        (option) => !filterValues.some(filter => filter.value === option.value)
    );
    return (
        <Popover
            _open={open}
            onOpenChange={(open) => {
                setOpen(open);
                if (!open) {
                    setTimeout(() => {
                        setCommandInput("");
                    }, 200);
                }
            }}
        >
            <PopoverTrigger
                className="rounded-none p-1 h-8 bg-muted hover:bg-muted/50 transition text-muted hover:text-primary shrink-0"
            >
                <div className="flex gap-1.5 items-center">
                    {filterValues?.length === 1 ? (
                        (() => {
                            const option = filterValues[0];
                            return (
                                <DynamicLabel
                                    value={option.value || ''}
                                    labelRenderer={labelRenderer}
                                    fallbackLabel={option.label}
                                />
                            )
                        })()
                    ) : (
                        `${filterValues?.length} selected`
                    )}
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
                <AnimateChangeInHeight>
                    <Command>
                        <CommandInput
                            placeholder={filterType}
                            className="h-9"
                            value={commandInput}
                            onInputCapture={(e) => {
                                setCommandInput(e.currentTarget.value);
                            }}
                            ref={commandInputRef}
                        />
                        <CommandList>
                            <CommandEmpty>No results found.</CommandEmpty>
                            <CommandGroup>
                                {filterValues.map((value) => {
                                    return (
                                        <CommandItem
                                            key={value.value}
                                            className="group flex gap-2 items-center"
                                            onSelect={() => {
                                                setFilterValues(filterValues.filter((v) => v.value !== value.value));
                                                setTimeout(() => {
                                                    setCommandInput("");
                                                }, 200);
                                                setOpen(false);
                                            }}
                                        >
                                            <Checkbox checked={true} />
                                            <DynamicLabel
                                                value={value.value || ''}
                                                labelRenderer={labelRenderer}
                                                fallbackLabel={value.label}
                                            />
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                            {nonSelectedFilterValues?.length > 0 && (
                                <>
                                    <CommandSeparator />
                                    <CommandGroup>
                                        {nonSelectedFilterValues
                                            .filter(option =>
                                                String(option.label || option.value).toLowerCase().includes(commandInput.toLowerCase())
                                            )
                                            .map((filter: FilterGroupOption) => (
                                                <CommandItem
                                                    className="group flex gap-2 items-center"
                                                    key={filter.value}
                                                    value={String(filter.label || filter.value)}
                                                    onSelect={() => {
                                                        setFilterValues([...filterValues, {
                                                            value: filter.value,
                                                            label: filter.label
                                                        }]);
                                                        setTimeout(() => {
                                                            setCommandInput("");
                                                        }, 200);
                                                        setOpen(false);
                                                    }}
                                                >
                                                    <Checkbox
                                                        checked={false}
                                                        className="opacity-0 group-data-[selected=true]:opacity-100"
                                                    />
                                                    <span className="text-muted">
                                                        <DynamicLabel
                                                            value={filter.value || ''}
                                                            labelRenderer={filter.labelRenderer || labelRenderer}
                                                            fallbackLabel={filter.label}
                                                        />
                                                    </span>
                                                </CommandItem>
                                            ))}
                                    </CommandGroup>
                                </>
                            )}
                        </CommandList>
                    </Command>
                </AnimateChangeInHeight>
            </PopoverContent>
        </Popover>
    );
};

export const DateCombobox = ({
    filterValues,
    setFilterValues,
    isRange = false,
}: {
    filterValues: string[];
    setFilterValues: (values: string[]) => void;
    isRange?: boolean;
}) => {
    const [open, setOpen] = useState(false);
    const [localDateRange, setLocalDateRange] = useState<[Date | null, Date | null]>([null, null]);
    
    // For single date
    const selectedDate = filterValues[0] ? new Date(filterValues[0]) : undefined;
    
    // For date range - use local state for immediate feedback, fall back to filter values
    const dateRange: [Date | null, Date | null] = isRange ? [
        localDateRange[0] || (filterValues[0] ? new Date(filterValues[0]) : null),
        localDateRange[1] || (filterValues[1] ? new Date(filterValues[1]) : null)
    ] : [null, null];

    // Update local state when filter values change
    useEffect(() => {
        if (isRange) {
            setLocalDateRange([
                filterValues[0] ? new Date(filterValues[0]) : null,
                filterValues[1] ? new Date(filterValues[1]) : null
            ]);
        }
    }, [filterValues, isRange]);

    const getDisplayText = () => {
        if (isRange) {
            if (dateRange[0] && dateRange[1]) {
                return (
                    <span className="flex items-center gap-1.5">
                        <span className="font-medium">{dayjs(dateRange[0]).format("MMMM DD, YYYY")}</span>
                        <span className="text-xs text-muted-foreground">-</span>
                        <span className="font-medium">{dayjs(dateRange[1]).format("MMMM DD, YYYY")}</span>
                    </span>
                );
            } else if (dateRange[0]) {
                return (
                    <span className="flex items-center gap-1.5">
                        <span className="font-medium">{dayjs(dateRange[0]).format("MMMM DD, YYYY")}</span>
                        <span className="text-xs text-muted-foreground">- Select end</span>
                    </span>
                );
            } else {
                return <span className="text-muted-foreground">Select range</span>;
            }
        } else {
            return selectedDate ? dayjs(selectedDate).format("MMMM DD, YYYY") : "Pick a date";
        }
    };

    const handleDateChange = (date: any) => {
        if (isRange) {
            // Update local state immediately for visual feedback
            if (Array.isArray(date)) {
                setLocalDateRange([date[0], date[1]]);
                
                // Update filter values
                if (date[0] && date[1]) {
                    setFilterValues([
                        dayjs(date[0]).format("YYYY-MM-DD"),
                        dayjs(date[1]).format("YYYY-MM-DD")
                    ]);
                } else if (date[0]) {
                    setFilterValues([dayjs(date[0]).format("YYYY-MM-DD")]);
                }
            }
        } else {
            if (date) {
                const actualDate = Array.isArray(date) ? date[0] : date;
                if (actualDate) {
                    setFilterValues([dayjs(actualDate).format("YYYY-MM-DD")]);
                    setOpen(false);
                }
            }
        }
    };

    return (
        <Popover _open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                className="rounded-none p-1 h-8 bg-muted hover:bg-muted/50 text-muted hover:text-primary shrink-0 transition"
            >
                <div className="flex gap-1.5 items-center min-h-[20px]">
                    {getDisplayText()}
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="p-2">
                    {isRange ? (
                        <>
                            <div className="calendar-wrapper">
                                <style>{`
                                  .calendar-wrapper .react-calendar__navigation {
                                    display: flex !important;
                                    justify-content: space-between !important;
                                    align-items: center !important;
                                    gap: 8px !important;
                                    padding: 8px !important;
                                  }
                                  .calendar-wrapper .react-calendar__navigation__label {
                                    flex: 1 !important;
                                    text-align: center !important;
                                    font-weight: 500 !important;
                                  }
                                  .calendar-wrapper .react-calendar__navigation__arrow {
                                    display: flex !important;
                                    align-items: center !important;
                                    justify-content: center !important;
                                    min-width: 32px !important;
                                    height: 32px !important;
                                    border-radius: 4px !important;
                                    border: 1px solid hsl(var(--border)) !important;
                                    background: hsl(var(--background)) !important;
                                    color: hsl(var(--foreground)) !important;
                                  }
                                  .calendar-wrapper .react-calendar__navigation__arrow:hover {
                                    background: hsl(var(--muted)) !important;
                                  }
                                `}</style>
                                <ReactCalendar
                                    value={dateRange}
                                    onChange={handleDateChange}
                                    selectRange={true}
                                    returnValue="range"
                                    maxDate={(() => {
                                        const maxDate = new Date();
                                        maxDate.setHours(23, 59, 59, 999);
                                        return maxDate;
                                    })()}
                                    className="mb-2 border-0"
                                tileClassName={({ date, view }) => {
                                    if (view === 'month') {
                                        const currentDate = date.getTime();
                                        const today = new Date();
                                        today.setHours(23, 59, 59, 999);
                                        
                                        // Check if date is disabled (future date)
                                        if (currentDate > today.getTime()) {
                                            return 'text-muted/20 cursor-not-allowed';
                                        }
                                        
                                        // Handle selected date styling
                                        if (dateRange[0]) {
                                            const startDate = dateRange[0].getTime();
                                            
                                            if (dateRange[1]) {
                                                // Both dates selected
                                                const endDate = dateRange[1].getTime();
                                                
                                                if (currentDate === startDate) {
                                                    return 'bg-primary text-primary-foreground rounded-l-md font-semibold';
                                                }
                                                if (currentDate === endDate) {
                                                    return 'bg-primary text-primary-foreground rounded-r-md font-semibold';
                                                }
                                                if (currentDate > startDate && currentDate < endDate) {
                                                    return 'bg-primary/20 text-primary font-medium';
                                                }
                                            } else {
                                                // Only start date selected
                                                if (currentDate === startDate) {
                                                    return 'bg-primary text-primary-foreground rounded-md font-semibold';
                                                }
                                            }
                                        }
                                    }
                                    return '';
                                }}
                                />
                            </div>
                            {dateRange[0] && dateRange[1] && (
                                <div className="border-t pt-2">
                                    <div className="flex gap-2 justify-end">
                                        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                                            Close
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <Calendar
                            className="p-0"
                            value={selectedDate}
                            onChange={handleDateChange}
                            maxDate={(() => {
                                const maxDate = new Date();
                                maxDate.setHours(23, 59, 59, 999);
                                return maxDate;
                            })()}
                        />
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
};

export const TextCombobox = ({
    filterType,
    filterValue,
    setFilterValue,
}: {
    filterType: string;
    filterValue: string;
    setFilterValue: (value: string) => void;
}) => {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(filterValue);

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "Enter") {
            setFilterValue(inputValue);
            setOpen(false);
        }
    };

    return (
        <Popover
            _open={open}
            onOpenChange={(open) => {
                setOpen(open);
                if (!open && inputValue !== filterValue) {
                    setInputValue(filterValue);
                }
            }}
        >
            <PopoverTrigger
                className="rounded-none p-1 h-8 bg-muted hover:bg-muted/50 text-muted hover:text-primary shrink-0 transition"
            >
                <div className="flex gap-1.5 items-center">
                    {filterValue || "Enter text..."}
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-3">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center p-1.5 text-xs text-muted">
                        <span>{filterType}</span>
                    </div>
                    <Input autoFocus
                        type="text" size={"sm"}
                        value={inputValue}
                        onChange={setInputValue}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter text..."
                    />
                    <Button
                        size="sm" variant={"outline"}
                        onClick={() => {
                            setFilterValue(inputValue);
                            setOpen(false);
                        }}
                    >
                        Apply
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
};

export const StringListCombobox = ({
    filterType,
    filterValues,
    setFilterValues,
}: {
    filterType: string;
    filterValues: string[];
    setFilterValues: (values: string[]) => void;
}) => {
    const [open, setOpen] = useState(false);
    const [tags, setTags] = useState<string[]>(filterValues);

    const handleApply = () => {
        setFilterValues(tags);
        setOpen(false);
    };

    return (
        <Popover
            _open={open}
            onOpenChange={(open) => {
                setOpen(open);
                if (!open && JSON.stringify(tags) !== JSON.stringify(filterValues)) {
                    setTags(filterValues);
                }
            }}
        >
            <PopoverTrigger
                className="rounded-none p-1 h-8 bg-muted hover:bg-muted/50 text-muted hover:text-primary shrink-0 transition"
            >
                <div className="flex gap-1.5 items-center">
                    {filterValues.length > 0 ? (
                        filterValues.length === 1 ? filterValues[0] : `${filterValues.length} tags`
                    ) : (
                        "Add tags..."
                    )}
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-3">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center p-1.5 text-xs text-muted">
                        <span>{filterType}</span>
                    </div>
                    <InputList 
                        value={tags} 
                        onChange={setTags} 
                        placeholder={`Add ${filterType.toLowerCase()}...`}
                    />
                    <div className="flex gap-2 justify-end">
                        <Button
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                                setTags(filterValues);
                                setOpen(false);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm" 
                            onClick={handleApply}
                        >
                            Apply
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};