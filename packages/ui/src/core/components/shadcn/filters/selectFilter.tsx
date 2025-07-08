import React from "react";
import { CommandItem, CommandEmpty } from "../command";
import { Filter, FilterGroup, FilterGroupOption } from "./types";
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
}: Readonly<SelectFilterProps>) {
  const getFilteredOptions = (groupName: string) => {
    const group = filterGroups.find(g => g.name === groupName);
    if (!group) {
      return [];
    }

    let filteredOptions = group.options || [];

    if (!commandInput.trim()) {
      return filteredOptions;
    }

    if (group.filterBy) {
      const filterLc = commandInput.toLowerCase();
      return filteredOptions.filter(option => {
        if (option.value === undefined) return false;
        return group.filterBy!(option.value, filterLc);
      });
    }

    const filterLc = commandInput.toLowerCase();
    return filteredOptions.filter(option => {
      const optionValue = String(option.value || '').toLowerCase();
      return optionValue.includes(filterLc);
    });
  };

  const handleOptionSelect = (option: FilterGroupOption) => {
    const selectedGroup = filterGroups.find(g => g.name === selectedView);

    setFilters((prev: Filter[]) => {
      const existingFilterIndex = prev.findIndex(f => f.name === selectedView);

      const filterOption = {
        value: option.value,
        label: option.label
      };

      if (existingFilterIndex >= 0) {
        const updatedFilters = [...prev];
        updatedFilters[existingFilterIndex] = {
          ...updatedFilters[existingFilterIndex],
          value: [...updatedFilters[existingFilterIndex].value, filterOption]
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
  };

  if (!selectedView) {
    return null;
  }

  const options = getFilteredOptions(selectedView);
  const selectedGroup = filterGroups.find(group => group.name === selectedView);
  const groupTitle = selectedGroup?.placeholder || selectedGroup?.name;

  if (options.length === 0) {
    return <CommandEmpty>No matching options</CommandEmpty>;
  }

  return (
    <>
      <div className="flex items-center p-1.5 text-xs text-muted">
        <span>{groupTitle}</span>
      </div>
      <div className="max-h-64 overflow-y-auto overflow-x-hidden">
        {
          options.map((option: FilterGroupOption) => (
            <CommandItem
              key={option.value || `option-${Math.random()}`}
              className="group flex gap-2 items-center w-full hover:bg-muted"
              onSelect={() => handleOptionSelect(option)}
            >
              {<DynamicLabel
                value={option.value || ''}
                labelRenderer={option.labelRenderer || selectedGroup?.labelRenderer}
                fallbackLabel={option.label}
              />}
            </CommandItem>
          ))
        }
      </div>
    </>
  );
}