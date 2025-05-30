
import React from "react";
import { Calendar } from "../calendar";
import { format } from "date-fns";
import { Filter, FilterGroup } from "./types";

interface DateFilterProps {
  selectedView: string | null;
  selectedDate: Date | undefined;
  setSelectedDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
  setFilters: React.Dispatch<React.SetStateAction<Filter[]>>;
  filters: Filter[];
  handleClose: () => void;
  filterGroups: FilterGroup[];
}

export default function DateFilter({
  selectedView,
  selectedDate,
  setSelectedDate,
  setFilters,
  filters,
  handleClose,
  filterGroups,
}: DateFilterProps) {
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      const selectedGroup = filterGroups.find(g => g.name === selectedView);
      
      // Set date to start of day (00:00)
      const selectedDateStart = new Date(date);
      selectedDateStart.setHours(0, 0, 0, 0);
      
      setFilters([
        ...filters,
        {
          name: selectedView || "",
          placeholder: selectedGroup?.placeholder,
          value: [
            {
              value: selectedDateStart.toISOString(),
              label: format(date, "LLL dd, y")
            }
          ],
          type: selectedGroup?.type || "date",
        } as Filter,
      ]);

      handleClose();
    }
  };

  return (
    <div className="p-2">
      <Calendar
        mode="single"
        defaultMonth={selectedDate}
        selected={selectedDate}
        onSelect={handleDateSelect}
        size="sm"
      />
    </div>
  );
}