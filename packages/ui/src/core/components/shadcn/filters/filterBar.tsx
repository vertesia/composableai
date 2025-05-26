import React, { Dispatch, SetStateAction, useEffect } from "react";
import { cn } from "../../libs/utils";
import { Button, Popover, PopoverTrigger, PopoverContent, Command, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty } from "../index";
import { ListFilter } from "lucide-react";
import { DateRange } from "react-day-picker";

import { Filter, FilterGroup } from "./types";
import Filters from "./filters";

import TextFilter from "./textFilter";
import DateFilter from "./dateFilter";
import SelectFilter from "./selectFilter";

interface FilterBarProps {
  filters: Filter[];
  setFilters: Dispatch<SetStateAction<Filter[]>>;
  filterGroups: FilterGroup[];
}

export function FilterBar({ filters, setFilters, filterGroups }: FilterBarProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedView, setSelectedView] = React.useState<string | null>(null);
  const [commandInput, setCommandInput] = React.useState("");
  const commandInputRef = React.useRef<HTMLInputElement>(null);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
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
            filter.value.some(val => val.value === option.value);
        })
      )
    })).filter(group =>
      ((group.options ?? []).length > 0) ||
      (group.type === "date" && !filters.some(filter => filter.name === group.name)) ||
      (group.type === "text" && !filters.some(filter => filter.name === group.name))
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
      setDateRange(undefined);
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

  const ButtonClearFilter = () => {
    return (
      <div className="flex gap-2 items-center">
        <Button
          variant="outline"
          size="xs"
          className="transition group"
          onClick={() => setFilters([])}
        >
          Clear All
        </Button>
      </div>
    );
  };

  const renderFilterOptions = () => {
    if (!selectedView) return null;

    const selectedGroupType = filterGroups.find(g => g.name === selectedView)?.type;

    switch (selectedGroupType) {
      case "date":
        return (
          <DateFilter
            selectedView={selectedView}
            dateRange={dateRange}
            setDateRange={setDateRange}
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

  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  useEffect(() => {
    try {
      const urlSafeFilters = filters.map(filter => {
        const safeValue = Array.isArray(filter.value)
          ? filter.value.map(item => ({
            value: item.value
          }))
          : filter.value;

        return {
          name: filter.name,
          type: filter.type,
          value: safeValue,
          placeholder: filter.placeholder
        };
      });

      const params = new URLSearchParams(searchParams.toString());
      if (filters.length > 0) {
        params.set('filters', encodeURIComponent(JSON.stringify(urlSafeFilters)));
      } else {
        params.delete('filters');
      }

      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
    } catch (error) {
      console.error("Failed to update URL with filters:", error);
    }
  }, [filters]);

  useEffect(() => {
    const filtersParam = searchParams.get('filters');
    if (filtersParam) {
      try {
        const parsedFilters = JSON.parse(decodeURIComponent(filtersParam));

        const hydratedFilters = parsedFilters.map((filter: any) => {

          if (Array.isArray(filter.value)) {
            const group = filterGroups.find(g => g.name === filter.name);
            console.log("group", group);

            const valuesWithLabels = filter.value.map((item: any) => {
              const matchingOption = group?.options?.find(opt => opt.value === item.value);

              return {
                value: item.value,
                label: matchingOption?.label || item.value
              };
            });

            console.log("valuesWithLabels", valuesWithLabels);

            return {
              ...filter,
              value: valuesWithLabels
            };
          }

          return filter;
        });

        setFilters(hydratedFilters);
      } catch (error) {
        console.error("Failed to parse filters from URL:", error);
      }
    }
  }, []);

  return (
    <div className="flex gap-2 flex-wrap justify-start w-full items-center">
      <div className="flex gap-2 items-center">
        <Popover _open={open} onOpenChange={handleOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              role="combobox"
              aria-expanded={open}
              size="md"
              className={cn(
                "transition group flex gap-1.5",
              )}
            >
              <ListFilter className="size-4 shrink-0 transition-all text-muted" />
              {"Filter"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="start">
            <Command>
              {filterGroups.find(group => group.name === selectedView)?.type === "select" ? (
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
              ) : null}

              <CommandList className="max-h-[300px] overflow-y-auto">
                <CommandGroup>
                  {!selectedView ? getAvailableFilterGroups() : renderFilterOptions()}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <Filters filters={filters} setFilters={setFilters} filterGroups={filterGroups} />
      {filters.filter((filter) => filter.value?.length > 0).length > 0 && <ButtonClearFilter />}
    </div>
  );
}