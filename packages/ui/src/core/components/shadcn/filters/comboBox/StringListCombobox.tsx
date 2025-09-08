import { useState } from "react";
import { Button } from "../../button";
import { Popover, PopoverContent, PopoverTrigger } from "../../popover";
import { InputList } from "../../../index";

export const StringListCombobox = ({
    filterType,
    filterValues,
    setFilterValues,
}: {
    filterType: string;
    filterValues: string[];
    setFilterValues: (values: string[]) => void;
}) => {
    const [open, setOpen] = useState(false);
    const [tags, setTags] = useState<string[]>(filterValues);

    const handleApply = () => {
        setFilterValues(tags);
        setOpen(false);
    };

    return (
        <Popover
            _open={open}
            onOpenChange={(open) => {
                setOpen(open);
                if (!open && JSON.stringify(tags) !== JSON.stringify(filterValues)) {
                    setTags(filterValues);
                }
            }}
        >
            <PopoverTrigger
                className="rounded-none p-1 h-8 bg-muted hover:bg-muted/50 text-muted hover:text-primary shrink-0 transition"
            >
                <div className="flex gap-1.5 items-center">
                    {filterValues.length > 0 ? (
                        filterValues.length === 1 ? filterValues[0] : `${filterValues.length} items`
                    ) : (
                        "Add tags..."
                    )}
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-3">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center p-1.5 text-xs text-muted">
                        <span>{filterType}</span>
                    </div>
                    <InputList
                        value={tags}
                        onChange={setTags}
                        placeholder={`Add ${filterType.toLowerCase()}...`}
                    />
                    <div className="flex gap-2 justify-end">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                setTags(filterValues);
                                setOpen(false);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleApply}
                        >
                            Apply
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};