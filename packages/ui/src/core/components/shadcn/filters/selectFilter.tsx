import React from "react";
import { CommandItem, CommandEmpty } from "../index";
import { Filter, FilterGroup, FilterOption } from "./types";

interface SelectFilterProps {
  selectedView: string | null;
  commandInput: string;
  setFilters: React.Dispatch<React.SetStateAction<Filter[]>>;
  handleClose: () => void;
  filterGroups: FilterGroup[];
}

export default function SelectFilter({
  selectedView,
  commandInput,
  setFilters,
  handleClose,
  filterGroups,
}: SelectFilterProps) {
  const getFilteredOptions = (groupName: string) => {
    const group = filterGroups.find(g => g.name === groupName);
    if (!group) return [];

    let filteredOptions = group.options || [];

    if (!commandInput.trim()) {
      return filteredOptions;
    }

    if (group.filterBy) {
      const filterLc = commandInput.toLowerCase();
      const results = filteredOptions.filter(option => {
        if (option.value === undefined) return false;
        const result = group.filterBy!(option.value, filterLc);
        return result;
      });
      return results;
    }

    const filterLc = commandInput.toLowerCase();
    return filteredOptions.filter(option => {
      const optionValue = String(option.value || '').toLowerCase();
      return optionValue.includes(filterLc);
    });
  };

  if (!selectedView) return null;
  
  const options = getFilteredOptions(selectedView);
  
  if (options.length === 0) {
    return <CommandEmpty>No matching options</CommandEmpty>;
  }
  
  return (
    <>
      {options.map((option: FilterOption) => (
        <CommandItem
          key={option.value || `option-${Math.random()}`}
          className="group flex gap-2 items-center w-full hover:bg-muted"
          onSelect={() => {
            setFilters((prev: Filter[]) => {
              const existingFilterIndex = prev.findIndex(f => f.name === selectedView);
              const selectedGroup = filterGroups.find(g => g.name === selectedView);

              if (existingFilterIndex >= 0) {
                const updatedFilters = [...prev];
                updatedFilters[existingFilterIndex] = {
                  ...updatedFilters[existingFilterIndex],
                  value: [...updatedFilters[existingFilterIndex].value, option]
                };
                return updatedFilters;
              } else {
                return [...prev, {
                  name: selectedView || "",
                  placeholder: selectedGroup?.placeholder || "",
                  value: [option],
                  type: selectedGroup?.type || "select",
                }];
              }
            });

            handleClose();
          }}
        >
          {option.label || option.value || 'Unnamed option'}
        </CommandItem>
      ))}
    </>
  );
}