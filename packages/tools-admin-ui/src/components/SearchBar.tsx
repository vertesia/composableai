import { Input } from '@vertesia/ui/core';

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    resultCount?: number;
    totalCount?: number;
}

export function SearchBar({ value, onChange, placeholder, resultCount, totalCount }: SearchBarProps) {
    const hasQuery = value.trim().length > 0;
    const noResults = hasQuery && resultCount === 0;

    return (
        <div className="mb-7">
            <Input
                type="search"
                value={value}
                onChange={onChange}
                placeholder={placeholder || 'Search collections...'}
                className="max-w-sm rounded-full"
                autoComplete="off"
            />
            {hasQuery && !noResults && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                    Showing {resultCount} of {totalCount} resources
                </p>
            )}
            {noResults && (
                <p className="mt-2 text-sm text-destructive">
                    No resources match this search.
                </p>
            )}
        </div>
    );
}
