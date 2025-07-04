import { useRef, useState } from "react";
// import { AnimatePresence, motion } from "motion/react";
import dayjs from "dayjs";
import { Calendar } from "../calendar";

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
}: {
    filterValues: string[];
    setFilterValues: (values: string[]) => void;
}) => {
    const [open, setOpen] = useState(false);
    const selectedDate = filterValues[0] ? new Date(filterValues[0]) : undefined;

    return (
        <Popover _open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                className="rounded-none p-1 h-8 bg-muted hover:bg-muted/50 text-muted hover:text-primary shrink-0 transition"
            >
                <div className="flex gap-1.5 items-center">
                    {selectedDate ? (
                        dayjs(selectedDate).format("MMM D, YYYY")
                    ) : (
                        <span>Pick a date</span>
                    )}
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    className="p-0"
                    value={selectedDate}
                    onChange={(date) => {
                        if (date) {
                            const actualDate = Array.isArray(date) ? date[0] : date;
                            if (actualDate) {
                                setFilterValues([dayjs(actualDate).format("YYYY-MM-DD")]);
                                setOpen(false);
                            }
                        }
                    }}
                />
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