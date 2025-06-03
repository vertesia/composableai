import { useUserSession } from "@vertesia/ui/session";
import { FacetSpec, SupportedEmbeddingTypes } from "@vertesia/common";
import React, { useMemo } from "react";
import { DocumentSearch, SearchContext } from "./SearchContext";

interface DocumentSearchProviderProps {
    children: React.ReactNode;
    limit?: number;
    typeId?: string;
    parent?: string;
    facets?: FacetSpec[];
    similarTo?: string; //vector search similarity
    embeddingType?: SupportedEmbeddingTypes; //vector search similarity
    collectionId?: string;
    name?: string;
}
export function DocumentSearchProvider({ children, limit, parent, typeId, facets, similarTo, embeddingType, name, collectionId }: DocumentSearchProviderProps) {
    const { store } = useUserSession();
    const search = useMemo(() => {
        let facetSpecs: FacetSpec[];
        if (facets) {
            facetSpecs = facets;
        } else {
            facetSpecs = [
                {
                    name: 'status',
                    field: 'status'
                },
                {
                    name: 'location',
                    field: 'location'
                }
            ]
            if (!typeId) {
                facetSpecs.unshift({
                    name: 'type',
                    field: 'type'
                })
            }
        }
        const search = new DocumentSearch(store, limit).withFacets(facetSpecs);
        search.collectionId = collectionId;
        search.query.type = typeId;
        search.query.parent = parent;
        search.query.similarTo = similarTo;
        search.query.embeddingType = embeddingType;
        search.query.name = name;
        return search;
    }, [typeId, limit]);

    return (
        <SearchContext.Provider value={search}>{children}</SearchContext.Provider>
    )
}