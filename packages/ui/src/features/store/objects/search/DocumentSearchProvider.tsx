import type { FacetSpec } from '@vertesia/common';
import { useUserSession } from '@vertesia/ui/session';
import type React from 'react';
import { useMemo } from 'react';
import { DocumentSearch, SearchContext } from './DocumentSearchContext';

interface DocumentSearchProviderProps {
    children: React.ReactNode;
    limit?: number;
    typeId?: string;
    parent?: string;
    facets?: FacetSpec[];
    collectionId?: string;
    name?: string;
}
export function DocumentSearchProvider({
    children,
    limit,
    parent,
    typeId,
    facets,
    name,
    collectionId,
}: DocumentSearchProviderProps) {
    const { store } = useUserSession();
    const search = useMemo(() => {
        let facetSpecs: FacetSpec[];
        if (facets) {
            facetSpecs = facets;
        } else {
            facetSpecs = [
                {
                    name: 'status',
                    field: 'status',
                },
                {
                    name: 'location',
                    field: 'location',
                },
            ];
            if (!typeId) {
                facetSpecs.unshift({
                    name: 'type',
                    field: 'type',
                });
            }
        }
        const search = new DocumentSearch(store, limit).withFacets(facetSpecs);
        search.collectionId = collectionId;
        search.query.type = typeId;
        search.query.parent = parent;
        search.query.name = name;
        if (collectionId) {
            search.query.all_revisions = true;
        }
        return search;
    }, [collectionId, facets, limit, name, parent, store, typeId]);

    return <SearchContext.Provider value={search}>{children}</SearchContext.Provider>;
}
