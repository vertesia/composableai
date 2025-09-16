import { Check, ChevronsUpDown } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { CollectionItem } from "@vertesia/common";
import {
    Button, cn, ErrorBox, useDebounce, useFetch,
    Popover, PopoverContent, PopoverTrigger,
    Command, CommandEmpty, CommandGroup, CommandItem, CommandInput
} from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";

/**
 * A component to select a collection from a list of collections.
 * It fetches the collections from the store and displays them in a dropdown.
 * @param props - The properties for the component.
 * @returns A dropdown to select a collection.
**/
interface SelectCollectionProps {
    value?: string; // Collection ID
    onChange: (collectionId: string | undefined, collection?: CollectionItem) => void;
    disabled?: boolean;
    placeholder?: string;
    searchPlaceholder?: string;
}
export function SelectCollection({ onChange, value, disabled = false, placeholder = "Select a collection", searchPlaceholder = "Search collections" }: SelectCollectionProps) {
    const { client } = useUserSession();

    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    // Debounce the search query to avoid excessive API calls
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    // Memoize the search function to prevent unnecessary re-renders
    const searchCollections = useCallback(async (query: string) => {
        setIsSearching(true);
        const trimmedQuery = query.trim();

        const collections = await client.store.collections.search({
            dynamic: false,
            name: trimmedQuery || undefined
        });

        setIsSearching(false);
        return collections;
    }, [client]);

    // Fetch collections based on debounced search query
    const { data: collections, error } = useFetch(
        () => searchCollections(debouncedSearchQuery),
        [debouncedSearchQuery, searchCollections]
    );

    // Memoize the selected collection to avoid recalculation on every render
    const selectedCollection = useMemo(() => {
        return collections?.find((collection: CollectionItem) => collection.id === value);
    }, [collections, value]);

    // Handle collection selection
    const handleSelect = useCallback((collection: CollectionItem) => {
        onChange(collection.id, collection);
    }, [onChange]);

    // Handle clear selection
    const handleClear = useCallback(() => {
        onChange(undefined, undefined);
    }, [onChange]);

    // Handle search input change
    const handleSearchChange = useCallback((query: string) => {
        setSearchQuery(query);
    }, []);

    // Show error state
    if (error) {
        return (
            <ErrorBox title="Collection fetch failed">
                {error.message}
            </ErrorBox>
        );
    }

    const hasSearchQuery = searchQuery.trim().length > 0;
    const showClearOption = selectedCollection && hasSearchQuery;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-haspopup="listbox"
                    className={cn("w-full justify-between min-w-0")}
                    disabled={disabled}
                >
                    <span className="truncate flex-1 text-left min-w-0">
                        {selectedCollection ? selectedCollection.name : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="mt-2 mb-2 w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false}>
                    <div className="flex justify-between items-center border-b px-3" cmdk-input-wrapper="">
                        <CommandInput
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            onValueChange={handleSearchChange}
                            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        {
                            isSearching && (
                                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            )
                        }
                    </div>
                    <CommandEmpty>
                        {
                            isSearching
                                ? "Searching..."
                                : hasSearchQuery
                                    ? "No collections found."
                                    : "No collections available."
                        }
                    </CommandEmpty>
                    <CommandGroup className="max-h-[300px] overflow-auto">
                        {
                            showClearOption && (
                                <CommandItem
                                    value="__clear__"
                                    onSelect={handleClear}
                                    className="text-muted-foreground"
                                >
                                    Clear selection
                                </CommandItem>
                            )
                        }
                        {
                            collections?.map((collection: CollectionItem) => (
                                <CommandItem
                                    key={collection.id}
                                    value={collection.id}
                                    onSelect={() => handleSelect(collection)}
                                    className={cn(
                                        "flex items-center justify-between",
                                        value === collection.id ? "bg-muted/20" : ""
                                    )}
                                >
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="truncate font-medium">
                                            {collection.name}
                                        </span>
                                        {
                                            collection.description && (
                                                <span className="text-sm text-muted-foreground truncate">
                                                    {collection.description}
                                                </span>
                                            )
                                        }
                                    </div>
                                    <Check
                                        className={cn(
                                            "ml-2 h-4 w-4 shrink-0",
                                            value === collection.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                </CommandItem>
                            ))
                        }
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    );
}