import React from "react";
import { CommandItem, CommandEmpty } from "../command";
import { Filter, FilterGroup, FilterGroupOption, FilterOption } from "./types";
import { DynamicLabel } from "./DynamicLabel";

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

  const groupTitle = filterGroups.find(group => group.name === selectedView)?.placeholder || filterGroups.find(group => group.name === selectedView)?.name;

  return (
    <>
      <div className="flex items-center p-1.5 text-xs text-muted">
        <span>{groupTitle}</span>
      </div>
      {options.map((option: FilterGroupOption) => {
          const selectedGroup = filterGroups.find(g => g.name === selectedView);

          return (
            <CommandItem
              key={option.value || `option-${Math.random()}`}
              className="group flex gap-2 items-center w-full hover:bg-muted"
              onSelect={() => {
                setFilters((prev: Filter[]) => {
                  const existingFilterIndex = prev.findIndex(f => f.name === selectedView);

                  // Create filter option with value and label for storage
                  const filterOption = {
                    value: option.value,
                    label: option.label
                  };

                  if (existingFilterIndex >= 0) {
                    const updatedFilters = [...prev];
                    updatedFilters[existingFilterIndex] = {
                      ...updatedFilters[existingFilterIndex],
                      value: [...(updatedFilters[existingFilterIndex].value as FilterOption[]), filterOption]
                    };
                    return updatedFilters;
                  } else {
                    return [...prev, {
                      name: selectedView || "",
                      placeholder: selectedGroup?.placeholder || "",
                      value: [filterOption],
                      type: selectedGroup?.type || "select",
                    }];
                  }
                });

                handleClose();
              }}
            >
              <DynamicLabel
                value={option.value || ''}
                labelRenderer={option.labelRenderer || selectedGroup?.labelRenderer}
                fallbackLabel={option.label}
              />
            </CommandItem>
          );
        })}
    </>
  );
}