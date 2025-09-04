import React from "react";
import { Button } from "../../button";
import { Input } from "../../input";
import { Filter, FilterGroup } from "../types";

interface HexFilterProps {
  selectedView: string | null;
  textValue: string;
  setTextValue: (value: string) => void;
  setFilters: React.Dispatch<React.SetStateAction<Filter[]>>;
  handleClose: () => void;
  filterGroups: FilterGroup[];
}

export default function HexFilter({
  selectedView,
  textValue,
  setTextValue,
  setFilters,
  handleClose,
  filterGroups,
}: HexFilterProps) {
  const handleHexFilterAdd = () => {
    const displayLabel = textValue;
    
    setFilters((prev: Filter[]) => {
      return [
        ...prev,
        {
          name: selectedView || "",
          placeholder: filterGroups.find(group => group.name === selectedView)?.placeholder,
          value: [{ value: textValue, label: displayLabel }],
          type: "hex",
        }
      ];
    });

    handleClose();
  };

  const handleInputChange = (value: string) => {
    // Only allow valid hex characters
    // const cleanValue = value.replace(/[^0-9a-fA-F]/g, '');
    // setTextValue(cleanValue);
    setTextValue(value); // Use error message for invalid input
  };

  const isValidInput = textValue.trim().length > 0 && /^[0-9a-fA-F]+$/i.test(textValue.trim());

  return (
    <div className="p-2 flex flex-col gap-1">
      <div className="flex items-center p-1.5 text-xs text-muted">
        <span>{filterGroups.find(group => group.name === selectedView)?.placeholder}</span>
      </div>
      <Input
        autoFocus
        type="text"
        size="sm"
        value={textValue}
        onChange={handleInputChange}
        onKeyDown={(e) => e.key === "Enter" && isValidInput && handleHexFilterAdd()}
        placeholder="Enter Full Object ID..."
        className={!isValidInput && textValue.trim().length > 0 ? "border-destructive" : ""}
      />
      
      {!isValidInput && textValue.trim().length > 0 && (
        <div className="text-xs text-destructive p-2">
          <p>Invalid ID - Please only use:</p>
          <ul className="list-disc list-inside">
            <li>Letters A-F (case insensitive)</li>
            <li>Numbers 0-9</li>
          </ul>
        </div>
      )}
      
      <div className="mt-2 p-2 border-t">
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleHexFilterAdd}
            disabled={!isValidInput}
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}