import { useRef, useState } from "react";
// import { AnimatePresence, motion } from "motion/react";
import { Calendar } from "../calendar";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

import { Checkbox } from "../checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "../command";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { FilterOption } from "./types";
import { AnimateChangeInHeight } from "./animateChangeInHeight";
import { Button } from "../button";
import { VInput } from "../input";


export const SelectionCombobox = ({
    filterType,
    filterValues,
    setFilterValues,
    options,
}: {
    filterType: string;
    filterValues: FilterOption[];
    setFilterValues: (filterValues: FilterOption[]) => void;
    options: FilterOption[];
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
                className="rounded-none px-1.5 py-1 bg-muted hover:bg-muted/50 transition
  text-muted-foreground hover:text-primary shrink-0"
            >
                <div className="flex gap-1.5 items-center">
                    {filterValues?.length === 1 ? (
                        (() => {
                            const option = filterValues[0];
                            return option.label
                        })()
                    ) : (
                        `${filterValues?.length} selected`
                    )}
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
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
                                            {value.label}
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
                                                String(option.label).toLowerCase().includes(commandInput.toLowerCase())
                                            )
                                            .map((filter: FilterOption) => (
                                                <CommandItem
                                                    className="group flex gap-2 items-center"
                                                    key={filter.value}
                                                    value={String(filter.label)}
                                                    onSelect={() => {
                                                        setFilterValues([...filterValues, filter]);
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
                                                    <span className="text-accent-foreground">
                                                        {filter.label}
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
}: {
    filterType: string;
    filterValues: string[];
    setFilterValues: (values: string[]) => void;
}) => {
    const [open, setOpen] = useState(false);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: filterValues[0] ? new Date(filterValues[0]) : undefined,
        to: filterValues[1] ? new Date(filterValues[1]) : undefined,
    });

    return (
        <Popover _open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                className="rounded-none px-1.5 py-1 bg-muted hover:bg-muted/50 transition
                text-muted-foreground hover:text-primary shrink-0"
            >
                <div className="flex gap-1.5 items-center">
                    {dateRange?.from ? (
                        dateRange.to ? (
                            <>
                                {format(dateRange.from, "LLL dd, y")} -{" "}
                                {format(dateRange.to, "LLL dd, y")}
                            </>
                        ) : (
                            format(dateRange.from, "LLL dd, y")
                        )
                    ) : (
                        <span>Pick a date</span>
                    )}
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
                <Calendar
                    initialFocus
                    mode="range"
                    className="w-4/5 p-0"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={(range) => {
                        setDateRange(range);
                        if (range?.from) {
                            setFilterValues([
                                format(range.from, "yyyy-MM-dd"),
                                range.to ? format(range.to, "yyyy-MM-dd") : "",
                            ]);
                        }
                    }}
                    numberOfMonths={2}
                />
            </PopoverContent>
        </Popover>
    );
};

export const TextCombobox = ({
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
                className="rounded-none px-1.5 py-1 bg-muted hover:bg-muted/50 transition
                text-muted-foreground hover:text-primary shrink-0"
            >
                <div className="flex gap-1.5 items-center">
                    {filterValue || "Enter text..."}
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-3">
                <div className="flex flex-col gap-2 p-2">
                    <VInput autoFocus
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