import { useUITranslation } from '@vertesia/ui/i18n';
import { ListFilter } from 'lucide-react';
import React, { type Dispatch, type SetStateAction, useEffect } from 'react';
import { cn } from '../../libs/utils';
import { Button } from '../button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../command';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';
import DateFilter from './filter/dateFilter';
import SelectFilter from './filter/SelectFilter';
import StringListFilter from './filter/StringListFilter';
import TextFilter from './filter/TextFilter';
import Filters from './filters';
import type { Filter, FilterGroup, FilterOption } from './types';

const FilterContext = React.createContext<{
    filters: Filter[];
    setFilters: Dispatch<SetStateAction<Filter[]>>;
    filterGroups: FilterGroup[];
}>({
    filters: [],
    setFilters: () => undefined,
    filterGroups: [],
});

interface FilterProviderProps {
    filters: Filter[];
    setFilters: Dispatch<SetStateAction<Filter[]>>;
    filterGroups: FilterGroup[];
    children: React.ReactNode;
    inModal?: boolean;
}

// Syncs filters ↔ URL. On mount, captures the initial URL param and restores matching filters
// incrementally as filterGroups loads. URL writes are blocked until the first filterGroups load
// so the address bar doesn't flicker. Filters not matching any filterGroup are silently dropped
// (prevents cross-page URL contamination, e.g. a modal inheriting a parent page's filters).

// Parse format with array indicators: filterName:value or filterName:[value1,value2]
const FilterProvider = ({ filters, setFilters, filterGroups, children, inModal }: FilterProviderProps) => {
    const url = new URL(window.location.href);
    const searchParams = url.searchParams;
    const searchParamsString = searchParams.toString();
    const [initialFiltersParam] = React.useState(() => new URLSearchParams(window.location.search).get('filters'));
    const processedUrlFilters = React.useRef<Set<string>>(new Set());
    const hasRestoredFromUrl = React.useRef(inModal || !initialFiltersParam);

    useEffect(() => {
        if (inModal) return;
        if (!hasRestoredFromUrl.current) return;
        try {
            const params = new URLSearchParams(searchParamsString);
            if (filters.length > 0) {
                const filterString = filters
                    .map((filter) => {
                        let values: string;
                        if (
                            filter.type === 'stringList' &&
                            Array.isArray(filter.value) &&
                            typeof filter.value[0] === 'string'
                        ) {
                            values = `[${(filter.value as string[]).map((item) => encodeURIComponent(item)).join(',')}]`;
                        } else if (Array.isArray(filter.value)) {
                            if (filter.multiple) {
                                values = `[${filter.value.map((item) => encodeURIComponent(readFilterValue(item))).join(',')}]`;
                            } else if (filter.value.length > 1) {
                                values = `[${filter.value.map((item) => encodeURIComponent(readFilterValue(item))).join(',')}]`;
                            } else {
                                const firstValue = filter.value[0];
                                if (typeof firstValue === 'string') {
                                    values = encodeURIComponent(firstValue);
                                } else if (typeof firstValue === 'object' && firstValue?.value !== undefined) {
                                    values = encodeURIComponent(String(firstValue.value));
                                } else {
                                    values = encodeURIComponent(String(firstValue || ''));
                                }
                            }
                        } else {
                            values = encodeURIComponent(filter.value || '');
                        }
                        return `${encodeURIComponent(filter.name)}:${values}`;
                    })
                    .join(';');
                params.set('filters', filterString);
            } else {
                params.delete('filters');
            }

            const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
            window.history.replaceState(window.history.state || {}, '', newUrl);
        } catch (error) {
            console.error('Failed to update URL with filters:', error);
        }
    }, [filters, inModal, searchParamsString]);

    useEffect(() => {
        if (inModal || !initialFiltersParam || filterGroups.length === 0) return;
        try {
            const filterPairs = initialFiltersParam.split(';');
            const newFilters: Filter[] = [];

            for (const pair of filterPairs) {
                const [encodedName, valuesString] = pair.split(':');
                const name = decodeURIComponent(encodedName);

                if (processedUrlFilters.current.has(name)) continue;

                const group = filterGroups.find((g) => g.name === name);
                if (!group) continue;

                processedUrlFilters.current.add(name);

                let values: string[];
                if (valuesString.startsWith('[') && valuesString.endsWith(']')) {
                    const arrayContent = valuesString.slice(1, -1);
                    values = arrayContent
                        ? arrayContent.split(',').map((encodedValue) => decodeURIComponent(encodedValue))
                        : [];
                } else {
                    values = [decodeURIComponent(valuesString)];
                }

                let filterValue: FilterOption[] | string[];

                if (group.type === 'stringList') {
                    filterValue = values;
                } else if (group.type === 'text') {
                    filterValue =
                        values.length === 1
                            ? [{ value: values[0], label: values[0] }]
                            : values.map((value) => ({ value, label: value }));
                } else {
                    filterValue = values.map((value) => {
                        const matchingOption = group.options?.find((opt) => opt.value === value);
                        let label = value;
                        if (matchingOption?.label) {
                            label = String(matchingOption.label);
                        } else if (matchingOption?.labelRenderer) {
                            label = String(matchingOption.labelRenderer(value));
                        } else if (group.labelRenderer) {
                            label = String(group.labelRenderer(value));
                        }
                        return { value, label };
                    });
                }

                if (group.multiple && !valuesString.startsWith('[') && !valuesString.endsWith(']')) {
                    if (group.type === 'stringList') {
                        filterValue = values;
                    } else if (!Array.isArray(filterValue)) {
                        filterValue = [filterValue];
                    }
                }

                newFilters.push({
                    name,
                    type: group.type,
                    placeholder: group.placeholder,
                    value: filterValue,
                    multiple: group.multiple,
                });
            }

            if (newFilters.length > 0) {
                setFilters((prev) => [...prev, ...newFilters]);
            }

            hasRestoredFromUrl.current = true;
        } catch (_error) {
            // ignore parse errors
        }
    }, [filterGroups, inModal, initialFiltersParam, setFilters]);

    return <FilterContext.Provider value={{ filters, setFilters, filterGroups }}>{children}</FilterContext.Provider>;
};

const FilterBtn = ({ className }: { className?: string }) => {
    const { filters, setFilters, filterGroups } = React.useContext(FilterContext);
    const { t } = useUITranslation();
    const [open, setOpen] = React.useState(false);
    const [selectedView, setSelectedView] = React.useState<string | null>(null);
    const [commandInput, setCommandInput] = React.useState('');
    const commandInputRef = React.useRef<HTMLInputElement>(null);
    const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();
    const [textValue, setTextValue] = React.useState('');

    const handleSelect = (groupName: string) => {
        setSelectedView(groupName);
        setCommandInput('');
        commandInputRef.current?.focus();
    };

    const getAvailableFilterGroups = () => {
        const options = filterGroups
            .map((group) => ({
                ...group,
                options: (group.options ?? []).filter(
                    (option) =>
                        !filters.some((filter) => {
                            if (filter.type === 'date') {
                                return filter.name === group.name;
                            }
                            return (
                                filter.name === group.name &&
                                (Array.isArray(filter.value) && typeof filter.value[0] === 'string'
                                    ? filter.value.some((val) => val === option.value)
                                    : filter.value.some((val) => readFilterValue(val) === option.value))
                            );
                        }),
                ),
            }))
            .filter(
                (group) =>
                    (group.options ?? []).length > 0 ||
                    (group.type === 'date' && !filters.some((filter) => filter.name === group.name)) ||
                    (group.type === 'text' && !filters.some((filter) => filter.name === group.name)) ||
                    (group.type === 'stringList' && !filters.some((filter) => filter.name === group.name)),
            );

        if (options.length === 0) {
            return <CommandEmpty>{t('filter.noAvailableFilters')}</CommandEmpty>;
        }

        return options.map((group: FilterGroup, index: number) => (
            <CommandItem
                // biome-ignore lint/suspicious/noArrayIndexKey: list order is stable for this render
                key={index}
                onSelect={() => handleSelect(group.name)}
                className="group flex gap-2 items-center hover:bg-muted"
            >
                <span>{group.placeholder ?? group.name}</span>
            </CommandItem>
        ));
    };

    const handleClose = () => {
        setOpen(false);
        setTimeout(() => {
            setSelectedView(null);
            setCommandInput('');
            setSelectedDate(undefined);
        }, 200);
    };

    const handleOpen = (open: boolean) => {
        setOpen(open);
        if (!open) {
            setTimeout(() => {
                setSelectedView(null);
                setCommandInput('');
                setTextValue('');
            }, 200);
        }
    };

    const renderFilterOptions = () => {
        if (!selectedView) {
            return null;
        }

        const selectedGroupType = filterGroups.find((g) => g.name === selectedView)?.type;

        switch (selectedGroupType) {
            case 'date':
                return (
                    <DateFilter
                        selectedView={selectedView}
                        selectedDate={selectedDate}
                        setSelectedDate={setSelectedDate}
                        setFilters={setFilters}
                        filters={filters}
                        handleClose={handleClose}
                        filterGroups={filterGroups}
                    />
                );
            case 'text':
                return (
                    <TextFilter
                        selectedView={selectedView}
                        textValue={textValue}
                        setTextValue={setTextValue}
                        setFilters={setFilters}
                        handleClose={handleClose}
                        filterGroups={filterGroups}
                    />
                );
            case 'stringList':
                return (
                    <StringListFilter
                        selectedView={selectedView}
                        setFilters={setFilters}
                        handleClose={handleClose}
                        filterGroups={filterGroups}
                    />
                );
            default:
                return (
                    <SelectFilter
                        selectedView={selectedView}
                        commandInput={commandInput}
                        setFilters={setFilters}
                        handleClose={handleClose}
                        filterGroups={filterGroups}
                    />
                );
        }
    };

    return (
        <Popover _open={open} onOpenChange={handleOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    size="md"
                    className={cn('transition group flex gap-1.5', className)}
                >
                    <ListFilter className="size-4 shrink-0 transition-all text-muted" />
                    {t('filter.filter')}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start" sideOffset={4}>
                <Command>
                    {filterGroups.find((group) => group.name === selectedView)?.type === 'select' && (
                        <CommandInput
                            placeholder={
                                selectedView
                                    ? t('filter.filterBy', { view: selectedView })
                                    : t('filter.filterPlaceholder')
                            }
                            className="h-9 ring-0"
                            value={commandInput}
                            onValueChange={(value) => {
                                setCommandInput(value);
                            }}
                            ref={commandInputRef}
                            autoFocus={true}
                        />
                    )}
                    <CommandList>
                        <CommandEmpty>{t('filter.noMatchingFilters')}</CommandEmpty>
                        <CommandGroup>
                            {!selectedView ? getAvailableFilterGroups() : renderFilterOptions()}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

const FilterBar = ({ className }: { className?: string }) => {
    const { filters, setFilters, filterGroups } = React.useContext(FilterContext);

    return (
        <div className={cn(className)}>
            <Filters filters={filters} setFilters={setFilters} filterGroups={filterGroups} />
        </div>
    );
};

const FilterClear = ({ className }: { className?: string }) => {
    const { filters, setFilters } = React.useContext(FilterContext);
    const { t } = useUITranslation();

    const hasActiveFilters = filters.filter((filter) => filter.value?.length > 0).length > 0;

    if (!hasActiveFilters) {
        return null;
    }

    return (
        <Button
            variant="outline"
            size="md"
            className={cn('transition group', className)}
            onClick={() => setFilters([])}
        >
            {t('filter.clearAll')}
        </Button>
    );
};

function readFilterValue(item: string | FilterOption): string {
    return typeof item === 'string' ? item : item.value || '';
}

export { FilterProvider, FilterBtn, FilterBar, FilterClear };
