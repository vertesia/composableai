import { Dispatch, SetStateAction, useState } from "react";
import { InputList } from "../../index";
import { Button } from "../button";
import { Filter, FilterGroup } from "./types";

interface StringListFilterProps {
  selectedView: string;
  setFilters: Dispatch<SetStateAction<Filter[]>>;
  handleClose: () => void;
  filterGroups: FilterGroup[];
}

export default function StringListFilter({
  selectedView,
  setFilters,
  handleClose,
  filterGroups,
}: StringListFilterProps) {
  const [tags, setTags] = useState<string[]>([]);
  
  const selectedGroup = filterGroups.find(g => g.name === selectedView);

  const handleApply = () => {
    if (tags.length > 0) {
      setFilters(prev => [
        ...prev.filter(f => f.name !== selectedView),
        {
          name: selectedView,
          placeholder: selectedGroup?.placeholder,
          value: tags,
          type: "stringList" as const
        }
      ]);
    }
    handleClose();
  };

  return (
    <div className="p-2 space-y-3">
      <div className="space-y-2">
        <InputList 
          value={tags} 
          onChange={setTags} 
          placeholder={selectedGroup?.placeholder || `Add ${selectedView}...`}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={handleClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleApply} disabled={tags.length === 0}>
          Apply
        </Button>
      </div>
    </div>
  );
}