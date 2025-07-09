import dayjs from "dayjs";
import React, { useState } from "react";
import Calendar from "react-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../../popover";
import { Button } from "../../button";
import { Filter, FilterGroup } from "../types";
import { calendarStyles } from "../filter-styles";

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
  const [open, setOpen] = useState(true);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [localDateRange, setLocalDateRange] = useState<[Date | null, Date | null]>([null, null]);

  const selectedGroup = filterGroups.find(g => g.name === selectedView);
  const isDateRange = selectedGroup?.multiple;

  // Create maxDate set to end of today to ensure today is selectable
  const maxDate = new Date();
  maxDate.setHours(23, 59, 59, 999);

  // Use local state for immediate feedback, fall back to dateRange
  const effectiveDateRange: [Date | null, Date | null] = [
    localDateRange[0] || dateRange[0],
    localDateRange[1] || dateRange[1]
  ];

  const handleDateChange = (value: Value) => {
    if (isDateRange) {
      // Handle date range selection
      if (Array.isArray(value)) {
        // Update local state immediately for visual feedback
        setLocalDateRange([value[0], value[1]]);
        // Also update the main dateRange state
        setDateRange([value[0], value[1]]);
      } else {
        // Single date in range mode
        setLocalDateRange([value, null]);
        setDateRange([value, null]);
      }
    } else {
      // Handle single date selection
      const date = Array.isArray(value) ? value[0] : value;
      setSelectedDate(date || undefined);
      if (date) {
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
            multiple: selectedGroup?.multiple || false,
          } as Filter,
        ]);

        setOpen(false);
        handleClose();
      }
    }
  };

  const handleApplyDateRange = () => {
    if (dateRange[0]) {
      const startDate = new Date(dateRange[0]);
      const endDate = dateRange[1] ? new Date(dateRange[1]) : new Date(dateRange[0]);

      // Set start date to beginning of day
      startDate.setHours(0, 0, 0, 0);
      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999);

      const filterValue = [];
      filterValue.push({
        value: startDate.toISOString(),
        label: dayjs(startDate).format("LLL dd, y"),
      });

      if (dateRange[1] && dateRange[0].getTime() !== dateRange[1].getTime()) {
        filterValue.push({
          value: endDate.toISOString(),
          label: dayjs(endDate).format("LLL dd, y"),
        });
      }

      setFilters([
        ...filters,
        {
          name: selectedView || "",
          placeholder: selectedGroup?.placeholder,
          value: filterValue,
          type: selectedGroup?.type || "date",
          multiple: selectedGroup?.multiple || false,
        } as Filter,
      ]);

      setOpen(false);
      handleClose();
    }
  };

  const getDisplayText = () => {
    if (isDateRange) {
      if (effectiveDateRange[0] && effectiveDateRange[1]) {
        return (
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted">From:</span>
            <span className="text-xs font-medium">{dayjs(effectiveDateRange[0]).format("MMMM DD, YYYY")}</span>
            <span className="text-xs text-muted">To:</span>
            <span className="text-xs font-medium">{dayjs(effectiveDateRange[1]).format("MMMM DD, YYYY")}</span>
          </span>
        );
      } else if (effectiveDateRange[0]) {
        return (
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted">From:</span>
            <span className="text-xs font-medium">{dayjs(effectiveDateRange[0]).format("MMMM DD, YYYY")}</span>
            <span className="text-xs text-muted">→ Select end date</span>
          </span>
        );
      } else {
        return <span className="text-muted">Select date range</span>;
      }
    } else {
      return selectedDate ? dayjs(selectedDate).format("MMMM DD, YYYY") : "Pick a date";
    }
  };

  return (
    <Popover _open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="w-full p-2 text-left hover:bg-muted/50 rounded-sm">
        <div className="flex gap-1.5 items-center min-h-[20px]">
          {getDisplayText()}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" side="bottom" alignOffset={-4} sideOffset={6}>
        <div className="p-2">
          {isDateRange ? (
            <>
              <div className="calendar-wrapper">
                <style>{calendarStyles}</style>
                <Calendar
                  key={`${effectiveDateRange[0]?.getTime()}-${effectiveDateRange[1]?.getTime()}`}
                  value={effectiveDateRange}
                  onChange={handleDateChange}
                  selectRange={true}
                  returnValue="range"
                  maxDate={maxDate}
                  className="mb-2 border-0"
                  tileClassName={({ date, view }) => {
                    if (view === 'month') {
                      const currentDate = date.getTime();
                      const today = new Date();
                      today.setHours(23, 59, 59, 999);

                      // Check if date is disabled (future date)
                      if (currentDate > today.getTime()) {
                        return 'text-muted/20 cursor-not-allowed';
                      }

                      // Handle selected date styling
                      if (effectiveDateRange[0]) {
                        const startDate = effectiveDateRange[0].getTime();

                        if (effectiveDateRange[1]) {
                          // Both dates selected
                          const endDate = effectiveDateRange[1].getTime();

                          if (currentDate === startDate) {
                            return 'bg-primary text-primary-foreground rounded-l-md font-semibold';
                          }
                          if (currentDate === endDate) {
                            return 'bg-primary text-primary-foreground rounded-r-md font-semibold';
                          }
                          if (currentDate > startDate && currentDate < endDate) {
                            return 'bg-primary/20 text-primary font-medium';
                          }
                        } else {
                          // Only start date selected
                          if (currentDate === startDate) {
                            return 'bg-primary text-primary-foreground rounded-md font-semibold';
                          }
                        }
                      }
                    }
                    return '';
                  }}
                />
              </div>
              <div className="border-t pt-2">
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleApplyDateRange} disabled={!effectiveDateRange[0]}>
                    Apply
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="calendar-wrapper">
                <style>{calendarStyles}</style>
                <Calendar
                  value={selectedDate}
                  onChange={handleDateChange}
                  selectRange={false}
                  maxDate={maxDate}
                  className="mb-2 border-0"
                  tileClassName={({ date, view }) => {
                    if (view === 'month') {
                      const currentDate = date.getTime();
                      const today = new Date();
                      today.setHours(23, 59, 59, 999);

                      // Check if date is disabled (future date)
                      if (currentDate > today.getTime()) {
                        return 'text-muted/20 cursor-not-allowed';
                      }

                      // Handle selected date styling
                      if (selectedDate && currentDate === selectedDate.getTime()) {
                        return 'bg-primary text-primary-foreground rounded-md font-semibold';
                      }
                    }
                    return '';
                  }}
                />
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
