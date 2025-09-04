import React, { useState } from "react";
import { Button } from "../../button";
import { Input } from "../../input";
import { Checkbox } from "../../checkbox";
import { Filter, FilterGroup } from "../types";

interface IDFilterProps {
  selectedView: string | null;
  textValue: string;
  setTextValue: (value: string) => void;
  setFilters: React.Dispatch<React.SetStateAction<Filter[]>>;
  handleClose: () => void;
  filterGroups: FilterGroup[];
}

export default function IDFilter({
  selectedView,
  textValue,
  setTextValue,
  setFilters,
  handleClose,
  filterGroups,
}: IDFilterProps) {
  const [prefixWildcard, setPrefixWildcard] = useState(true);
  const [suffixWildcard, setSuffixWildcard] = useState(false);

  const handleIDFilterAdd = () => {
    // Build pattern value
    let patternValue = textValue;
    if (prefixWildcard) patternValue = `*${patternValue}`;
    if (suffixWildcard) patternValue = `${patternValue}*`;
    
    // Build display label
    let displayLabel: string;
    if (!prefixWildcard && !suffixWildcard) displayLabel = `Exact: ${textValue}`;
    else if (prefixWildcard && suffixWildcard) displayLabel = `Contains: ${textValue}`;
    else if (prefixWildcard) displayLabel = `Ends with: ${textValue}`;
    else displayLabel = `Starts with: ${textValue}`;
    
    setFilters((prev: Filter[]) => {
      return [
        ...prev,
        {
          name: selectedView || "",
          placeholder: filterGroups.find(group => group.name === selectedView)?.placeholder,
          value: [{ value: patternValue, label: displayLabel }],
          type: "text",
        }
      ];
    });

    handleClose();
  };

  const handleInputChange = (value: string) => {
    // Only allow valid hex characters
    const cleanValue = value.replace(/[^0-9a-fA-F]/g, '');
    setTextValue(cleanValue);
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
        onKeyDown={(e) => e.key === "Enter" && isValidInput && handleIDFilterAdd()}
        placeholder="Enter ObjectId (hex characters only)..."
        className={!isValidInput && textValue.trim().length > 0 ? "border-destructive" : ""}
      />
      
      {!isValidInput && textValue.trim().length > 0 && (
        <div className="text-xs text-destructive px-1">
          Only hexadecimal characters (0-9, A-F) are allowed
        </div>
      )}

      <div className="space-y-2 mt-2">
        <div className="text-sm font-medium text-muted">Find Partial Matches</div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="prefix-wildcard"
            checked={prefixWildcard}
            onCheckedChange={(checked) => setPrefixWildcard(checked === true)}
          />
          <label
            htmlFor="prefix-wildcard"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            At start of ID
          </label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="suffix-wildcard"
            checked={suffixWildcard}
            onCheckedChange={(checked) => setSuffixWildcard(checked === true)}
          />
          <label
            htmlFor="suffix-wildcard"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            At end of ID
          </label>
        </div>
      </div>
      
      <div className="mt-2 p-2 border-t">
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleIDFilterAdd}
            disabled={!isValidInput}
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}