
import React from "react";
import { Calendar } from "../calendar";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Filter, FilterGroup } from "./types";

interface DateFilterProps {
  selectedView: string | null;
  dateRange: DateRange | undefined;
  setDateRange: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
  setFilters: React.Dispatch<React.SetStateAction<Filter[]>>;
  filters: Filter[];
  handleClose: () => void;
  filterGroups: FilterGroup[];
}

export default function DateFilter({
  selectedView,
  dateRange,
  setDateRange,
  setFilters,
  filters,
  handleClose,
  filterGroups,
}: DateFilterProps) {
  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      const selectedGroup = filterGroups.find(g => g.name === selectedView);
      
      // Set from date to start of day (00:00) and to date to end of day (23:59:59)
      const fromDate = new Date(range.from);
      fromDate.setHours(0, 0, 0, 0);
      
      const toDate = new Date(range.to);
      toDate.setHours(23, 59, 59, 999);
      
      setFilters([
        ...filters,
        {
          name: selectedView || "",
          value: [
            {
              value: fromDate.toISOString(),
              label: format(range.from!, "LLL dd, y")
            },
            {
              value: toDate.toISOString(),
              label: format(range.to!, "LLL dd, y")
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
        initialFocus
        mode="range"
        defaultMonth={dateRange?.from}
        selected={dateRange}
        onSelect={handleDateRangeSelect}
        size="sm"
      />
    </div>
  );
}