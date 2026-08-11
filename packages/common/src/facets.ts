import type { z } from 'zod';
import type { ComputedFacetResponseSchema, FacetSpecSchema } from './api-schemas/interaction.js';
// this is the mongo definition of a facet. see https://www.mongodb.com/docs/atlas/atlas-search/facet/
export interface StringFacet {
    type: 'string';
    path: string;
    numBuckets?: number;
}

export interface NumericFacet {
    type: 'number';
    path: string;
    boundaries: number[];
    default?: string;
}

export interface DateFacet<T extends Date | string = string> {
    type: 'date';
    path: string;
    boundaries: T[]; // array of dates
    default?: string;
}

export type FacetSpec = z.infer<typeof FacetSpecSchema>;

export interface FacetBucket {
    _id: string;
    count: number;
}

export interface FacetNameBucket {
    name: string;
    _id: string;
    count: number;
}

export interface ComputedFacetBucket {
    _id: string;
    count: number;
}

export type ComputedFacetResponse = z.infer<typeof ComputedFacetResponseSchema>;
