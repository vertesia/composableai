import React, { useState } from "react";
import { CommandItem, CommandEmpty } from "../../command";
import { Button } from "../../button";
import { Filter, FilterGroup, FilterGroupOption, FilterOption } from "../types";
import { DynamicLabel } from "../DynamicLabel";

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
  const [selectedOptions, setSelectedOptions] = useState<FilterOption[]>([]);
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
      const results = filteredOptions.filter(option => {
        if (option.value === undefined) return false;
        return group.filterBy!(option.value, filterLc);
      });
      return results;
    }

    const filterLc = commandInput.toLowerCase();
    return filteredOptions.filter(option => {
      const optionValue = String(option.value || '').toLowerCase();
      return optionValue.includes(filterLc);
    });
  };

  if (!selectedView) {
    return null;
  }

  const options = getFilteredOptions(selectedView);
  const selectedGroup = filterGroups.find(g => g.name === selectedView);

  if (options.length === 0) {
    return <CommandEmpty>No matching options</CommandEmpty>;
  }

  const groupTitle = selectedGroup?.placeholder || selectedGroup?.name;

  const handleApply = () => {
    if (selectedOptions.length > 0) {
      setFilters(prev => [
        ...prev.filter(f => f.name !== selectedView),
        {
          name: selectedView || "",
          placeholder: selectedGroup?.placeholder || "",
          value: selectedOptions,
          type: selectedGroup?.type || "select",
          multiple: selectedGroup?.multiple || false,
        }
      ]);
    }
    handleClose();
  };

  const handleOptionToggle = (option: FilterGroupOption) => {
    const filterOption = {
      value: option.value,
      label: option.label
    };

    if (selectedGroup?.multiple) {
      // For multiple selection, toggle the option
      const isSelected = selectedOptions.some(opt => opt.value === option.value);
      if (isSelected) {
        setSelectedOptions(prev => prev.filter(opt => opt.value !== option.value));
      } else {
        setSelectedOptions(prev => [...prev, filterOption]);
      }
    } else {
      // For single selection, apply immediately
      setFilters((prev: Filter[]) => {
        const existingFilterIndex = prev.findIndex(f => f.name === selectedView);

        if (existingFilterIndex >= 0) {
          const updatedFilters = [...prev];
          updatedFilters[existingFilterIndex] = {
            ...updatedFilters[existingFilterIndex],
            value: [filterOption]
          };
          return updatedFilters;
        } else {
          return [...prev, {
            name: selectedView || "",
            placeholder: selectedGroup?.placeholder || "",
            value: [filterOption],
            type: selectedGroup?.type || "select",
            multiple: selectedGroup?.multiple || false,
          }];
        }
      });
      handleClose();
    }
  };

  return (
    <>
      <div className="flex items-center p-1.5 text-xs text-muted">
        <span>{groupTitle}</span>
      </div>
      <div className="max-h-50 overflow-y-auto">
        {options.map((option: FilterGroupOption) => {
          const isSelected = selectedOptions.some(opt => opt.value === option.value);

          return (
            <CommandItem
              key={option.value || `option-${Math.random()}`}
              className={`group flex gap-2 items-center w-full hover:bg-muted ${selectedGroup?.multiple && isSelected ? 'bg-muted' : ''
                }`}
              onSelect={() => handleOptionToggle(option)}
            >
              <DynamicLabel
                value={option.value || ''}
                labelRenderer={option.labelRenderer || selectedGroup?.labelRenderer}
                fallbackLabel={option.label}
              />
              {selectedGroup?.multiple && isSelected && (
                <span className="ml-auto text-xs text-success">✓</span>
              )}
            </CommandItem>
          );
        })}
      </div>
      {selectedGroup?.multiple && (
        <div className="p-2 border-t">
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={handleApply} disabled={selectedOptions.length === 0}>
              Apply
            </Button>
          </div>
        </div>
      )}
    </>
  );
}