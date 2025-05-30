import { X } from "lucide-react";
import { Dispatch, SetStateAction } from "react";
import { Button } from "../button";

import { Filter, FilterGroup } from "./types";
import { SelectionCombobox, DateCombobox, TextCombobox } from "./comboBox";
import { format } from "date-fns";

interface FiltersProps {
    filters: Filter[];
    setFilters: Dispatch<SetStateAction<Filter[]>>;
    filterGroups: FilterGroup[];
}

function generateComboboxOptions(
    filter: Filter,
    setFilters: Dispatch<SetStateAction<Filter[]>>,
    filterGroups: FilterGroup[]
) {
    switch (filter.type) {
        case 'date':
            return (
                <DateCombobox
                    filterValues={filter.value.map(v => v.value || '')}
                    setFilterValues={(filterValues) => {
                        setFilters((prev) =>
                            prev.map((f) =>
                                f === filter ? {
                                    ...f,
                                    value: filterValues.length > 0 ? [{
                                        value: filterValues[0],
                                        label: format(new Date(filterValues[0]), "LLL dd, y")
                                    }] : []
                                } : f
                            )
                        );
                    }}
                />
            );
        case 'text':
            return (
                <TextCombobox
                    filterType={filter.placeholder || filter.name}
                    filterValue={filter.value[0]?.value || ''}
                    setFilterValue={(textValue) => {
                        setFilters((prev) =>
                            prev.map((f) =>
                                f === filter ? {
                                    ...f,
                                    value: [{
                                        value: textValue,
                                        label: textValue
                                    }]
                                } : f
                            )
                        );
                    }}
                />
            );
        case 'select':
        default: {
            const filterGroup = filterGroups.find(group => group.name === filter.name);
            return (
                <SelectionCombobox
                    filterType={filter.placeholder || filter.name}
                    filterValues={filter.value}
                    setFilterValues={(filterValues) => {
                        setFilters((prev) =>
                            prev.map((f) =>
                                f === filter ? { ...f, value: filterValues } : f
                            )
                        );
                    }}
                    options={filterGroup?.options || []}
                    labelRenderer={filterGroup?.labelRenderer}
                />
            );
        }
    }
}

export default function Filters({
    filters,
    setFilters,
    filterGroups,
}: FiltersProps) {

    return (
        <div className="flex gap-2 flex-wrap justify-start">
            {filters
                .filter((filter) => filter.value?.length > 0)
                .map((filter) => (
                    <div className="flex gap-[1px] items-center text-sm" key={filter.name + '-' + (filter.type == 'date' ? 'date' : filter.value.map(v => v.value).join(','))}>
                        <div className="flex gap-1.5 shrink-0 rounded-l bg-muted p-1.5 h-8 items-center">
                            {filter.placeholder || filter.name}
                        </div>
                        {generateComboboxOptions(filter, setFilters, filterGroups)}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                setFilters((prev) => prev.filter((f) => f !== filter));
                            }}
                            className="bg-muted rounded-l-none rounded-r-sm size-8 hover:text-primary hover:bg-muted/50 transition shrink-0"
                        >
                            <X className="size-6" />
                        </Button>
                    </div>
                ))}
        </div>
    );
}