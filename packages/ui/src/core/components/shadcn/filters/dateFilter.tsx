import dayjs from "dayjs";
import React from "react";
import { DateRange } from "react-day-picker";
import { Calendar } from "../calendar";
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
            const selectedGroup = filterGroups.find(
                (g) => g.name === selectedView,
            );
            setFilters([
                ...filters,
                {
                    name: selectedView || "",
                    value: [
                        {
                            value: dayjs(range.from!).format("yyyy-MM-dd"),
                            label: dayjs(range.from!).format("LLL dd, y"),
                        },
                        {
                            value: dayjs(range.to!).format("yyyy-MM-dd"),
                            label: dayjs(range.to!).format("LLL dd, y"),
                        },
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
