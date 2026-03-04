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
        <div className="vta-search">
            <input
                type="search"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder || 'Search collections...'}
                className="vta-search-input"
                autoComplete="off"
            />
            {hasQuery && !noResults && (
                <p className="vta-search-hint">
                    Showing {resultCount} of {totalCount} resources
                </p>
            )}
            {noResults && (
                <p className="vta-search-empty">
                    No resources match this search.
                </p>
            )}
        </div>
    );
}
