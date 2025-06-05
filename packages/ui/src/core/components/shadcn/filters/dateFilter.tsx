import dayjs from "dayjs";
import React from "react";
import DatePicker from "react-date-picker";
import { Filter, FilterGroup } from "./types";

type Value = Date | null;

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
  const handleDateSelect = (date: Value) => {
    setSelectedDate(date || undefined);
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
              label: dayjs(selectedDateStart).format("LLL dd, y"),
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
      <DatePicker
        value={selectedDate}
        onChange={handleDateSelect}
        calendarIcon={false}
        className="react-date-picker--sm"
      />
    </div>
  );
}
