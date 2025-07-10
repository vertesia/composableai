import { useState } from "react";
import { Button } from "../../button";
import { Input } from "../../input";
import { Popover, PopoverContent, PopoverTrigger } from "../../popover";

export const TextCombobox = ({
    filterType,
    filterValue,
    setFilterValue,
}: {
    filterType: string;
    filterValue: string;
    setFilterValue: (value: string) => void;
}) => {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(filterValue);

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "Enter") {
            setFilterValue(inputValue);
            setOpen(false);
        }
    };

    return (
        <Popover
            _open={open}
            onOpenChange={(open) => {
                setOpen(open);
                if (!open && inputValue !== filterValue) {
                    setInputValue(filterValue);
                }
            }}
        >
            <PopoverTrigger
                className="rounded-none p-1 h-8 bg-muted hover:bg-muted/50 text-muted hover:text-primary shrink-0 transition"
            >
                <div className="flex gap-1.5 items-center">
                    {filterValue || "Enter text..."}
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-3">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center p-1.5 text-xs text-muted">
                        <span>{filterType}</span>
                    </div>
                    <Input autoFocus
                        type="text" size={"sm"}
                        value={inputValue}
                        onChange={setInputValue}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter text..."
                    />
                    <div className="flex gap-2 justify-end">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setInputValue(filterValue);
                                setOpen(false);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => {
                                setFilterValue(inputValue);
                                setOpen(false);
                            }}
                        >
                            Apply
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};