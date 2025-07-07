import { useState, useEffect } from "react";
import dayjs from "dayjs";
import ReactCalendar from "react-calendar";
import { Button } from "../../button";
import { Popover, PopoverContent, PopoverTrigger } from "../../popover";
import { calendarStyles } from "../filter-styles";

export const DateCombobox = ({
    filterValues,
    setFilterValues,
    isRange = false,
}: {
    filterValues: string[];
    setFilterValues: (values: string[]) => void;
    isRange?: boolean;
}) => {
    const [open, setOpen] = useState(false);
    const [localDateRange, setLocalDateRange] = useState<[Date | null, Date | null]>([null, null]);

    // For single date
    const selectedDate = filterValues[0] ? new Date(filterValues[0]) : undefined;

    // For date range - use local state for immediate feedback, fall back to filter values
    const dateRange: [Date | null, Date | null] = isRange ? [
        localDateRange[0] || (filterValues[0] ? new Date(filterValues[0]) : null),
        localDateRange[1] || (filterValues[1] ? new Date(filterValues[1]) : null)
    ] : [null, null];

    // Update local state when filter values change
    useEffect(() => {
        if (isRange) {
            setLocalDateRange([
                filterValues[0] ? new Date(filterValues[0]) : null,
                filterValues[1] ? new Date(filterValues[1]) : null
            ]);
        }
    }, [filterValues, isRange]);

    const getDisplayText = () => {
        if (isRange) {
            if (dateRange[0] && dateRange[1]) {
                return (
                    <span className="flex items-center gap-1.5">
                        <span className="font-medium">{dayjs(dateRange[0]).format("MMMM DD, YYYY")}</span>
                        <span className="text-xs text-muted-foreground">-</span>
                        <span className="font-medium">{dayjs(dateRange[1]).format("MMMM DD, YYYY")}</span>
                    </span>
                );
            } else if (dateRange[0]) {
                return (
                    <span className="flex items-center gap-1.5">
                        <span className="font-medium">{dayjs(dateRange[0]).format("MMMM DD, YYYY")}</span>
                        <span className="text-xs text-muted-foreground">- Select end</span>
                    </span>
                );
            } else {
                return <span className="text-muted-foreground">Select range</span>;
            }
        } else {
            return selectedDate ? dayjs(selectedDate).format("MMMM DD, YYYY") : "Pick a date";
        }
    };

    const handleDateChange = (date: any) => {
        if (isRange) {
            // Update local state immediately for visual feedback
            if (Array.isArray(date)) {
                setLocalDateRange([date[0], date[1]]);

                // Update filter values
                if (date[0] && date[1]) {
                    setFilterValues([
                        dayjs(date[0]).format("YYYY-MM-DD"),
                        dayjs(date[1]).format("YYYY-MM-DD")
                    ]);
                } else if (date[0]) {
                    setFilterValues([dayjs(date[0]).format("YYYY-MM-DD")]);
                }
            }
        } else {
            if (date) {
                const actualDate = Array.isArray(date) ? date[0] : date;
                if (actualDate) {
                    setFilterValues([dayjs(actualDate).format("YYYY-MM-DD")]);
                    setOpen(false);
                }
            }
        }
    };

    return (
        <Popover _open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                className="rounded-none p-1 h-8 bg-muted hover:bg-muted/50 text-muted hover:text-primary shrink-0 transition"
            >
                <div className="flex gap-1.5 items-center min-h-[20px]">
                    {getDisplayText()}
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="p-2">
                    {isRange ? (
                        <>
                            <div className="calendar-wrapper">
                                <style>{calendarStyles}</style>
                                <ReactCalendar
                                    value={dateRange}
                                    onChange={handleDateChange}
                                    selectRange={true}
                                    returnValue="range"
                                    maxDate={(() => {
                                        const maxDate = new Date();
                                        maxDate.setHours(23, 59, 59, 999);
                                        return maxDate;
                                    })()}
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
                                            if (dateRange[0]) {
                                                const startDate = dateRange[0].getTime();

                                                if (dateRange[1]) {
                                                    // Both dates selected
                                                    const endDate = dateRange[1].getTime();

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
                            {dateRange[0] && dateRange[1] && (
                                <div className="border-t pt-2">
                                    <div className="flex gap-2 justify-end">
                                        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                                            Close
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="calendar-wrapper">
                            <style>{calendarStyles}</style>
                            <ReactCalendar
                                value={selectedDate}
                                onChange={handleDateChange}
                                selectRange={false}
                                maxDate={(() => {
                                    const maxDate = new Date();
                                    maxDate.setHours(23, 59, 59, 999);
                                    return maxDate;
                                })()}
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
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
};