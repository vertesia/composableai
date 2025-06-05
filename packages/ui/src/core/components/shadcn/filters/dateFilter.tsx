import dayjs from "dayjs";
import React, { useState } from "react";
import DatePicker from "react-date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { Filter, FilterGroup } from "./types";

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

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
  const [open, setOpen] = useState(false);

  const handleDateChange = (value: Value) => {
    const date = Array.isArray(value) ? value[0] : value;
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

      setOpen(false);
      handleClose();
    }
  };

  return (
    <Popover _open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="w-full p-2 text-left hover:bg-muted/50 rounded-sm">
        <div className="flex gap-1.5 items-center">
          {selectedDate ? (
            dayjs(selectedDate).format("MMM D, YYYY")
          ) : (
            <span>Pick a date</span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <DatePicker
          value={selectedDate}
          onChange={handleDateChange}
          calendarIcon={false}
          className="p-2"
        />
      </PopoverContent>
    </Popover>
  );
}
