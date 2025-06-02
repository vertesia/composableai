import { X } from "lucide-react";
import { Dispatch, SetStateAction } from "react";
import { Button } from "../button";

import { DateCombobox, SelectionCombobox, TextCombobox } from "./comboBox";
import { Filter, FilterGroup } from "./types";
import dayjs from "dayjs";

interface FiltersProps {
    filters: Filter[];
    setFilters: Dispatch<SetStateAction<Filter[]>>;
    filterGroups: FilterGroup[];
}

function generateComboboxOptions(
    filter: Filter,
    setFilters: Dispatch<SetStateAction<Filter[]>>,
    filterGroups: FilterGroup[],
) {
    switch (filter.type) {
        case "date":
            return (
                <DateCombobox
                    filterType={filter.name}
                    filterValues={filter.value.map((v) => v.value || "")}
                    setFilterValues={(filterValues) => {
                        setFilters((prev) =>
                            prev.map((f) =>
                                f === filter
                                    ? {
                                          ...f,
                                          value: filterValues.map((val) => ({
                                              value: val,
                                              label: dayjs(val).format(
                                                  "LLL dd, y",
                                              ),
                                          })),
                                      }
                                    : f,
                            ),
                        );
                    }}
                />
            );
        case "text":
            return (
                <TextCombobox
                    filterType={filter.placeholder || filter.name}
                    filterValue={filter.value[0]?.value || ""}
                    setFilterValue={(textValue) => {
                        setFilters((prev) =>
                            prev.map((f) =>
                                f === filter
                                    ? {
                                          ...f,
                                          value: [
                                              {
                                                  value: textValue,
                                                  label: textValue,
                                              },
                                          ],
                                      }
                                    : f,
                            ),
                        );
                    }}
                />
            );
        case "select":
        default:
            return (
                <SelectionCombobox
                    filterType={filter.placeholder || filter.name}
                    filterValues={filter.value}
                    setFilterValues={(filterValues) => {
                        setFilters((prev) =>
                            prev.map((f) =>
                                f === filter
                                    ? { ...f, value: filterValues }
                                    : f,
                            ),
                        );
                    }}
                    options={
                        filterGroups.find((group) => group.name === filter.name)
                            ?.options || []
                    }
                />
            );
    }
}

export default function Filters({
    filters,
    setFilters,
    filterGroups,
}: FiltersProps) {
    return (
        <div className="flex gap-2 flex-wrap justify-end">
            {filters
                .filter((filter) => filter.value?.length > 0)
                .map((filter) => (
                    <div
                        className="flex gap-[1px] items-center text-sm"
                        key={
                            filter.name +
                            "-" +
                            (filter.type == "date"
                                ? "date"
                                : filter.value.map((v) => v.value).join(","))
                        }
                    >
                        <div className="flex gap-1.5 shrink-0 rounded-l bg-muted px-1.5 py-1 items-center">
                            {filter.placeholder || filter.name}
                        </div>
                        {generateComboboxOptions(
                            filter,
                            setFilters,
                            filterGroups,
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                setFilters((prev) =>
                                    prev.filter((f) => f !== filter),
                                );
                            }}
                            className="bg-muted rounded-l-none rounded-r-sm size-7 hover:text-primary hover:bg-muted/50 transition shrink-0"
                        >
                            <X className="size-6" />
                        </Button>
                    </div>
                ))}
        </div>
    );
}
