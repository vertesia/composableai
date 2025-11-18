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
    value?: string | string[];
    onChange: (collectionId: string | string[] | undefined, collection?: CollectionItem | CollectionItem[]) => void;
    disabled?: boolean;
    placeholder?: string;
    searchPlaceholder?: string;
    filterOut?: string[]; // collection IDs to filter out from the list
    allowDynamic?: boolean;
    multiple?: boolean;
}

export function SelectCollection({ onChange, value, disabled = false, placeholder = "Select a collection", searchPlaceholder = "Search collections", filterOut, allowDynamic = true, multiple = false }: SelectCollectionProps) {
    const { client } = useUserSession();

    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [useServerSearch, setUseServerSearch] = useState(false);

    // Debounce the search query to avoid excessive API calls (only used for server-side search)
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    // Memoize the search function to prevent unnecessary re-renders
    const searchCollections = useCallback(async (query: string) => {
        setIsSearching(true);
        const trimmedQuery = query.trim();

        const collections = await client.store.collections.search({
            dynamic: allowDynamic ? undefined : false,
            name: useServerSearch ? (trimmedQuery || undefined) : undefined
        });

        setIsSearching(false);

        // Check if we hit the maximum limit (1000 collections) - if so, enable server-side search
        if (!useServerSearch && collections.length >= 1000) {
            setUseServerSearch(true);
        }

        // Filter out collections if filterOut is provided
        if (filterOut && filterOut.length > 0) {
            return collections.filter(col => !filterOut.includes(col.id));
        }
        return collections;
    }, [client, allowDynamic, filterOut, useServerSearch]);

    // Fetch collections based on search mode
    const { data: collections, error } = useFetch(
        () => searchCollections(useServerSearch ? debouncedSearchQuery : ''),
        [useServerSearch ? debouncedSearchQuery : '', searchCollections]
    );

    // Memoize the selected collection(s)
    const selectedCollection = useMemo(() => {
        if (!collections) return multiple ? [] : undefined;

        if (multiple && Array.isArray(value)) {
            return collections.filter((collection: CollectionItem) => value.includes(collection.id));
        } else if (!multiple && typeof value === 'string') {
            return collections.find((collection: CollectionItem) => collection.id === value);
        }
        return multiple ? [] : undefined;
    }, [collections, value, multiple]);

    // Handle collection selection
    const handleSelect = useCallback((collection: CollectionItem) => {
        if (multiple) {
            const currentValues = Array.isArray(value) ? value : [];
            const isSelected = currentValues.includes(collection.id);

            if (isSelected) {
                // Remove from selection
                const newValues = currentValues.filter(id => id !== collection.id);
                const newCollections = collections?.filter(c => newValues.includes(c.id)) || [];
                onChange(newValues, newCollections);
            } else {
                // Add to selection
                const newValues = [...currentValues, collection.id];
                const newCollections = collections?.filter(c => newValues.includes(c.id)) || [];
                onChange(newValues, newCollections);
            }
        } else {
            onChange(collection.id, collection);
        }
    }, [onChange, value, collections, multiple]);

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

    // Client-side filtering when not using server search
    const filteredCollections = useMemo(() => {
        if (!collections) return [];

        // If using server search, collections are already filtered by the server
        if (useServerSearch) return collections;

        // Otherwise, do client-side filtering
        if (!hasSearchQuery) return collections;

        const queryLower = searchQuery.toLowerCase();
        return collections.filter(col => col.name.toLowerCase().includes(queryLower));
    }, [collections, useServerSearch, hasSearchQuery, searchQuery]);

    // Get display text for the button
    const getDisplayText = () => {
        if (multiple && Array.isArray(selectedCollection) && selectedCollection.length > 0) {
            if (selectedCollection.length === 1) {
                return selectedCollection[0].name;
            }
            return `${selectedCollection.length} collections selected`;
        } else if (!multiple && selectedCollection && !Array.isArray(selectedCollection)) {
            return selectedCollection.name;
        }
        return placeholder;
    };

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
                        {getDisplayText()}
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
                            showClearOption && !multiple && (
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
                            filteredCollections.map((collection: CollectionItem) => {
                                const isSelected = multiple && Array.isArray(value)
                                    ? value.includes(collection.id)
                                    : value === collection.id;

                                return (
                                    <CommandItem
                                        key={collection.id}
                                        value={collection.id}
                                        onSelect={() => handleSelect(collection)}
                                        className="flex items-center justify-between"
                                    >
                                        <span className="truncate">{collection.name}</span>
                                        {isSelected && (
                                            <Check className="ml-2 h-4 w-4 shrink-0" />
                                        )}
                                    </CommandItem>
                                );
                            })
                        }
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
