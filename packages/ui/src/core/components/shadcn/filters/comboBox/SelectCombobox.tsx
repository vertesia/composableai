import { useRef, useState } from "react";
import { Checkbox } from "../../checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "../../command";
import { Popover, PopoverContent, PopoverTrigger } from "../../popover";
import { AnimateChangeInHeight } from "../animateChangeInHeight";
import { FilterGroupOption, FilterOption } from "../types";
import { DynamicLabel } from "../DynamicLabel";

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
                                            <input type="checkbox" checked={true} onChange={() => {}} />
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