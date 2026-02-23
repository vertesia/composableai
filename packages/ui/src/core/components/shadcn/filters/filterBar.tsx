import React, { Dispatch, SetStateAction, useEffect } from "react";
import { cn } from "../../libs/utils";
import { Button } from "../button";
import { Popover, PopoverTrigger, PopoverContent } from "../popover";
import { Command, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty } from "../command";
import { ListFilter } from "lucide-react";

import { Filter, FilterGroup } from "./types";
import Filters from "./filters";

import TextFilter from "./filter/TextFilter";
import DateFilter from "./filter/dateFilter";
import SelectFilter from "./filter/SelectFilter";
import StringListFilter from "./filter/StringListFilter";

const FilterContext = React.createContext<{
  filters: Filter[];
  setFilters: Dispatch<SetStateAction<Filter[]>>;
  filterGroups: FilterGroup[];
}>({} as any);

interface FilterProviderProps {
  filters: Filter[];
  setFilters: Dispatch<SetStateAction<Filter[]>>;
  filterGroups: FilterGroup[];
  children: React.ReactNode;
}

const FilterProvider = ({ filters, setFilters, filterGroups, children }: FilterProviderProps) => {
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  // Capture URL filters at mount time before the write-effect can clear them
  const [initialFiltersParam] = React.useState(() => new URLSearchParams(window.location.search).get('filters'));
  // Track which filter names have been resolved so we don't re-add after a user removes them
  const processedUrlFilters = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const params = new URLSearchParams(searchParams.toString());
      if (filters.length > 0) {
        // Convert filters to format with array indicators: filterName:value,value;filterName2:value
        // Arrays are prefixed with []: filterName:[value1,value2]
        const filterString = filters.map(filter => {
          let values;
          if (filter.type === 'stringList' && Array.isArray(filter.value) && typeof filter.value[0] === 'string') {
            // Handle stringList with direct string array - always array format
            values = `[${(filter.value as string[]).map(item => encodeURIComponent(item)).join(',')}]`;
          } else if (Array.isArray(filter.value)) {
            if (filter.multiple) {
              // Handle multiple filters - always use array format for multiple=true
              values = `[${filter.value.map((item: any) => encodeURIComponent(item.value || item || '')).join(',')}]`;
            } else if (filter.value.length > 1) {
              // Handle multiple values for non-multiple filters
              values = `[${filter.value.map((item: any) => encodeURIComponent(item.value || item || '')).join(',')}]`;
            } else {
              // Single value in array for non-multiple filter - don't use array format
              const firstValue = filter.value[0];
              if (typeof firstValue === 'string') {
                values = encodeURIComponent(firstValue);
              } else if (typeof firstValue === 'object' && firstValue?.value !== undefined) {
                // Handle FilterOption object
                values = encodeURIComponent(String(firstValue.value));
              } else {
                values = encodeURIComponent(String(firstValue || ''));
              }
            }
          } else {
            values = encodeURIComponent(filter.value || '');
          }
          return `${encodeURIComponent(filter.name)}:${values}`;
        }).join(';');
        params.set('filters', filterString);
      } else {
        params.delete('filters');
      }

      const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
      window.history.replaceState(window.history.state || {}, '', newUrl);
    } catch (error) {
      console.error("Failed to update URL with filters:", error);
    }
  }, [filters]);

  useEffect(() => {
    if (!initialFiltersParam || filterGroups.length === 0) return;
    try {
      // Parse format with array indicators: filterName:value or filterName:[value1,value2]
      const filterPairs = initialFiltersParam.split(';');
      const newFilters: Filter[] = [];

      for (const pair of filterPairs) {
        const [encodedName, valuesString] = pair.split(':');
        const name = decodeURIComponent(encodedName);

        // Skip filter names already resolved (e.g. from a previous filterGroups update)
        if (processedUrlFilters.current.has(name)) continue;

        // Skip filters whose group isn't in this FilterProvider — either not loaded yet
        // (will retry on next filterGroups change) or genuinely absent (cross-page contamination)
        const group = filterGroups.find(g => g.name === name);
        if (!group) continue;

        // Mark as processed so we don't re-add if the user later removes this filter
        processedUrlFilters.current.add(name);

        let values: string[];
        // Check if it's an array format [value1,value2]
        if (valuesString.startsWith('[') && valuesString.endsWith(']')) {
          // Array format - remove brackets and split by comma
          const arrayContent = valuesString.slice(1, -1); // Remove [ and ]
          values = arrayContent ? arrayContent.split(',').map(encodedValue => decodeURIComponent(encodedValue)) : [];
        } else {
          // Single value format
          values = [decodeURIComponent(valuesString)];
        }

        let filterValue;

        if (group.type === 'stringList') {
          // For stringList, return direct string array
          filterValue = values;
        } else if (group.type === 'text') {
          // For text, return FilterOption array (single value for text inputs)
          filterValue = values.length === 1 ? [{ value: values[0], label: values[0] }] :
            values.map(value => ({ value, label: value }));
        } else {
          // For other types, find options with labels
          filterValue = values.map(value => {
            const matchingOption = group.options?.find(opt => opt.value === value);
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
        setFilters(prev => [...prev, ...newFilters]);
      }
    } catch (_error) {
      // ignore parse errors
    }
  }, [filterGroups, initialFiltersParam]);

  return (
    <FilterContext.Provider value={{ filters, setFilters, filterGroups }}>
      {children}
    </FilterContext.Provider>
  );
};

const FilterBtn = ({ className }: { className?: string }) => {
  const { filters, setFilters, filterGroups } = React.useContext(FilterContext);
  const [open, setOpen] = React.useState(false);
  const [selectedView, setSelectedView] = React.useState<string | null>(null);
  const [commandInput, setCommandInput] = React.useState("");
  const commandInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();
  const [textValue, setTextValue] = React.useState("");

  const handleSelect = (groupName: string) => {
    setSelectedView(groupName);
    setCommandInput("");
    commandInputRef.current?.focus();
  };

  const getAvailableFilterGroups = () => {
    let options = filterGroups.map(group => ({
      ...group,
      options: (group.options ?? []).filter(option =>
        !filters.some(filter => {
          if (filter.type === "date") {
            return filter.name === group.name;
          }
          return filter.name === group.name &&
            (Array.isArray(filter.value) && typeof filter.value[0] === 'string'
              ? filter.value.some(val => val === option.value)
              : filter.value.some(val => (val as any).value === option.value));
        })
      )
    })).filter(group =>
      ((group.options ?? []).length > 0) ||
      (group.type === "date" && !filters.some(filter => filter.name === group.name)) ||
      (group.type === "text" && !filters.some(filter => filter.name === group.name)) ||
      (group.type === "stringList" && !filters.some(filter => filter.name === group.name))
    );

    if (options.length === 0) {
      return <CommandEmpty>No available filters</CommandEmpty>;
    }

    return options.map((group: FilterGroup, index: number) => (
      <CommandItem
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
      setCommandInput("");
      setSelectedDate(undefined);
    }, 200);
  };

  const handleOpen = (open: boolean) => {
    setOpen(open);
    if (!open) {
      setTimeout(() => {
        setSelectedView(null);
        setCommandInput("");
        setTextValue("");
      }, 200);
    }
  };

  const renderFilterOptions = () => {
    if (!selectedView) {
      return null;
    }

    const selectedGroupType = filterGroups.find(g => g.name === selectedView)?.type;

    switch (selectedGroupType) {
      case "date":
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
      case "text":
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
      case "stringList":
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
          className={cn(
            "transition group flex gap-1.5",
            className
          )}
        >
          <ListFilter className="size-4 shrink-0 transition-all text-muted" />
          {"Filter"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start" sideOffset={4}>
        <Command>
          {
            filterGroups.find(group => group.name === selectedView)?.type === "select" && (
              <CommandInput
                placeholder={selectedView ? `Filter by ${selectedView}` : "Filter..."}
                className="h-9 ring-0"
                value={commandInput}
                onValueChange={(value) => {
                  setCommandInput(value);
                }}
                ref={commandInputRef}
                autoFocus={true}
              />
            )
          }
          <CommandList>
            <CommandEmpty>No matching filters</CommandEmpty>
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

const FilterClear = ({ className }: { className?: string}) => {
  const { filters, setFilters } = React.useContext(FilterContext);

  const hasActiveFilters = filters.filter((filter) => filter.value?.length > 0).length > 0;

  if (!hasActiveFilters) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="xs"
      className={cn("transition group", className)}
      onClick={() => setFilters([])}
    >
      Clear All
    </Button>
  );
};

export { FilterProvider, FilterBtn, FilterBar, FilterClear };