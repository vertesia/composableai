import { useUserSession } from "@vertesia/ui/session";
import React, { useMemo } from "react";
import { ObjectTypeSearch, ObjectTypeSearchContext } from "./ObjectTypeSearchContext";

interface SearchProviderProps {
    children: React.ReactNode;
    limit?: number;
    offset?: number;
    name?: string;
    chunkable?: boolean;
}
export function ObjectTypeSearchProvider({ children, limit, name, chunkable: chunkable }: SearchProviderProps) {
    const { store } = useUserSession();
    const search = useMemo(() => {
        const search = new ObjectTypeSearch(store, limit);
        search.query.name = name;
        search.query.chunkable = chunkable;
        return search;
    }, [limit]);

    return (
        <ObjectTypeSearchContext.Provider value={search}>{children}</ObjectTypeSearchContext.Provider>
    )
}
