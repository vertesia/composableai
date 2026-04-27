import { useRef, useState } from "react";
import { Checkbox } from "../../checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "../../command";
import { Popover, PopoverContent, PopoverTrigger } from "../../popover";
import { AnimateChangeInHeight } from "../animateChangeInHeight";
import { FilterGroupOption, FilterOption } from "../types";
import { DynamicLabel } from "../DynamicLabel";
import { useUITranslation } from '../../../../../i18n/index.js';

export const SelectionCombobox = ({
    filterType,
    filterValues,
    setFilterValues,
    options,
    labelRenderer,
    multiple = true,
}: {
    filterType: string;
    filterValues: FilterOption[];
    setFilterValues: (filterValues: FilterOption[]) => void;
    options: FilterGroupOption[];
    labelRenderer?: (value: string) => React.ReactNode | Promise<React.ReactNode>;
    /** When false, picking an option replaces the current value rather than appending. */
    multiple?: boolean;
}) => {
    const [open, setOpen] = useState(false);
    const [commandInput, setCommandInput] = useState("");
    const commandInputRef = useRef<HTMLInputElement>(null);
    const { t } = useUITranslation();
    const nonSelectedFilterValues = options?.filter(
        (option) => !filterValues.some(filter => filter.value === option.value)
    );

    const closePopover = () => {
        setTimeout(() => setCommandInput(""), 200);
        setOpen(false);
    };
    const matchesInput = (option: FilterGroupOption) =>
        String(option.label || option.value).toLowerCase().includes(commandInput.toLowerCase());

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
                    {filterValues?.length === 1 || (!multiple && filterValues?.length) ? (
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
                            <CommandEmpty>{t('filter.noResultsFound')}</CommandEmpty>
                            {multiple ? (
                                <>
                                    <CommandGroup>
                                        {filterValues.map((value) => {
                                            return (
                                                <CommandItem
                                                    key={value.value}
                                                    className="group flex gap-2 items-center"
                                                    onSelect={() => {
                                                        setFilterValues(filterValues.filter((v) => v.value !== value.value));
                                                        closePopover();
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
                                                    .filter(matchesInput)
                                                    .map((filter: FilterGroupOption) => (
                                                        <CommandItem
                                                            className="group flex gap-2 items-center"
                                                            key={filter.value}
                                                            value={String(filter.label || filter.value)}
                                                            onSelect={() => {
                                                                const next = { value: filter.value, label: filter.label };
                                                                setFilterValues([...filterValues, next]);
                                                                closePopover();
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
                                </>
                            ) : (
                                <CommandGroup>
                                    {options
                                        .filter(matchesInput)
                                        .map((option: FilterGroupOption) => {
                                            const isSelected = filterValues.some(v => v.value === option.value);
                                            return (
                                                <CommandItem
                                                    key={option.value}
                                                    className="group flex gap-2 items-center"
                                                    value={String(option.label || option.value)}
                                                    onSelect={() => {
                                                        if (!isSelected) {
                                                            setFilterValues([{ value: option.value, label: option.label }]);
                                                        }
                                                        closePopover();
                                                    }}
                                                >
                                                    <DynamicLabel
                                                        value={option.value || ''}
                                                        labelRenderer={option.labelRenderer || labelRenderer}
                                                        fallbackLabel={option.label}
                                                    />
                                                    {isSelected && (
                                                        <span className="ml-auto text-xs text-success">✓</span>
                                                    )}
                                                </CommandItem>
                                            );
                                        })}
                                </CommandGroup>
                            )}
                        </CommandList>
                    </Command>
                </AnimateChangeInHeight>
            </PopoverContent>
        </Popover>
    );
};