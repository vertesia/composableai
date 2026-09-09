import { z } from 'zod';
import { isPlainObject, type JsonObject } from './adapter.js';

const EXPLICIT_UNION = 'x-vertesia-explicit-union';

/** Preserve the published explicit-union spelling across Zod's final compaction pass. */
export function emitJsonSchema(schema: z.ZodType): JsonObject {
    const emitted = z.toJSONSchema(schema, {
        target: 'draft-2020-12',
        io: 'input',
        override: ({ jsonSchema }) => {
            // Zod 4.5 compacts bare anyOf branches AFTER override runs. Carry the original
            // branches through that pass; optional wrappers inherit this metadata as well.
            const branches = jsonSchema.anyOf;
            if (
                branches?.every(
                    (branch) => isPlainObject(branch) && Object.keys(branch).length === 1 && 'type' in branch,
                )
            ) {
                jsonSchema[EXPLICIT_UNION] = branches;
            }
        },
    });
    restoreExplicitUnions(emitted);
    return emitted;
}

function restoreExplicitUnions(value: unknown): void {
    if (Array.isArray(value)) {
        for (const child of value) restoreExplicitUnions(child);
    } else if (isPlainObject(value)) {
        const branches = value[EXPLICIT_UNION];
        if (Array.isArray(branches)) {
            delete value[EXPLICIT_UNION];
            delete value.type;
            value.anyOf = branches;
        }
        for (const child of Object.values(value)) restoreExplicitUnions(child);
    }
}
