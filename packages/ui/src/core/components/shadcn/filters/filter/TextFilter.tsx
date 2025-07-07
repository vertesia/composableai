import React from "react";
import { Button } from "../../button";
import { Input } from "../../input";
import { Filter, FilterGroup } from "../types";

interface TextFilterProps {
  selectedView: string | null;
  textValue: string;
  setTextValue: (value: string) => void;
  setFilters: React.Dispatch<React.SetStateAction<Filter[]>>;
  handleClose: () => void;
  filterGroups: FilterGroup[];
}

export default function TextFilter({
  selectedView,
  textValue,
  setTextValue,
  setFilters,
  handleClose,
  filterGroups,
}: TextFilterProps) {
  const handleTextFilterAdd = () => {
    setFilters((prev: Filter[]) => {
      return [
        ...prev,
        {
          name: selectedView || "",
          placeholder: filterGroups.find(group => group.name === selectedView)?.placeholder,
          value: [{ value: textValue, label: textValue }],
          type: "text",
        }
      ];
    });

    handleClose();
  };

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
        onChange={setTextValue}
        onKeyDown={(e) => e.key === "Enter" && handleTextFilterAdd()}
        placeholder="Enter text..."
      />
      <Button
        size="sm"
        variant="outline"
        onClick={handleTextFilterAdd}
        disabled={!textValue.trim()}
      >
        Apply
      </Button>
    </div>
  );
}