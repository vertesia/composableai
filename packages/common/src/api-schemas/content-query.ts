import { z } from 'zod';
import { conditional, nonEmpty } from './schema-primitives.js';

const sql = nonEmpty('sql');
const esql = nonEmpty('esql');

export const ContentQueryPayloadSchema = z
    .strictObject({
        sql: z.string().optional(),
        esql: z.string().optional(),
        dsl: z
            .strictObject({
                query: z.record(z.string(), z.unknown()).optional(),
                aggs: z.record(z.string(), z.unknown()).optional(),
                size: z.number().optional(),
                from: z.number().optional(),
                sort: z.array(z.record(z.string(), z.unknown())).optional(),
            })
            .optional(),
        format: z.enum(['json', 'csv', 'table']).optional(),
    })
    .meta({
        id: 'ContentQueryPayload',
        description: 'Exactly one of `sql`, `esql` or `dsl`. An empty `sql` or `esql` counts as absent.',
        allOf: [
            conditional({ not: { anyOf: [sql, esql] } }, { required: ['dsl'] }),
            conditional(sql, { not: { anyOf: [esql, { required: ['dsl'] }] } }),
            conditional(esql, { not: { required: ['dsl'] } }),
        ],
    });

export const ContentQueryResultSchema = z
    .strictObject({
        type: z.enum(['sql', 'esql', 'dsl']),
        columns: z.array(z.strictObject({ name: z.string(), type: z.string() })).optional(),
        rows: z.array(z.array(z.unknown())).optional(),
        hits: z.array(z.strictObject({ id: z.string(), score: z.number(), source: z.unknown() })).optional(),
        total: z.number().optional(),
        aggregations: z.record(z.string(), z.unknown()).optional(),
        cursor: z.string().optional(),
        took: z.number().optional(),
    })
    .meta({ id: 'ContentQueryResult' });
