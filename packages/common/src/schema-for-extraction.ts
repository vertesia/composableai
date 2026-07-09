/**
 * Extraction schema filtering.
 *
 * Content-type object_schema properties may set `"x-extract": false` to mark fields
 * that must not be filled by extraction models (match scores, ERP ids filled later,
 * internal bookkeeping). The full schema remains the object model for UI/storage;
 * only the filtered copy is used as result_schema for constrained decoding.
 */

export const X_EXTRACT = 'x-extract';

export function isExtractableSchemaNode(schema: unknown): boolean {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
        return true;
    }
    return (schema as Record<string, unknown>)[X_EXTRACT] !== false;
}

/**
 * Deep-clones a JSON schema and removes properties (recursively) marked
 * `x-extract: false`, cleaning `required` arrays to match.
 */
export function schemaForExtraction<T>(schema: T): T {
    if (!schema || typeof schema !== 'object') {
        return schema;
    }
    if (Array.isArray(schema)) {
        return schema.map((item) => schemaForExtraction(item)) as T;
    }

    const node = { ...(schema as Record<string, unknown>) };

    // Recurse into known schema containers first
    if (node.items && typeof node.items === 'object') {
        node.items = schemaForExtraction(node.items);
    }
    if (Array.isArray(node.anyOf)) {
        node.anyOf = node.anyOf.map((item) => schemaForExtraction(item));
    }
    if (Array.isArray(node.oneOf)) {
        node.oneOf = node.oneOf.map((item) => schemaForExtraction(item));
    }
    if (Array.isArray(node.allOf)) {
        node.allOf = node.allOf.map((item) => schemaForExtraction(item));
    }
    if (node.additionalProperties && typeof node.additionalProperties === 'object') {
        node.additionalProperties = schemaForExtraction(node.additionalProperties);
    }

    if (node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)) {
        const props = { ...(node.properties as Record<string, unknown>) };
        for (const [key, child] of Object.entries(props)) {
            if (!isExtractableSchemaNode(child)) {
                delete props[key];
                continue;
            }
            props[key] = schemaForExtraction(child);
        }
        node.properties = props;

        if (Array.isArray(node.required)) {
            const kept = node.required.filter((r) => typeof r === 'string' && r in props);
            if (kept.length > 0) {
                node.required = kept;
            } else {
                delete node.required;
            }
        }
    }

    // Drop the flag from the extraction copy (not needed by providers)
    delete node[X_EXTRACT];

    return node as T;
}

/**
 * Merge model output over existing properties while preserving values at paths
 * marked `x-extract: false` on the full (unfiltered) schema.
 */
export function mergePreservingNonExtractable(existing: unknown, extracted: unknown, schema: unknown): unknown {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
        return extracted;
    }
    const schemaObj = schema as Record<string, unknown>;

    // Array of objects: merge item-by-item using items schema
    if (Array.isArray(extracted)) {
        const itemSchema = schemaObj.items;
        if (!itemSchema || typeof itemSchema !== 'object') {
            return extracted;
        }
        const existingArr = Array.isArray(existing) ? existing : [];
        return extracted.map((item, i) => mergePreservingNonExtractable(existingArr[i], item, itemSchema));
    }

    if (!extracted || typeof extracted !== 'object' || Array.isArray(extracted)) {
        return extracted;
    }

    const props = schemaObj.properties;
    if (!props || typeof props !== 'object' || Array.isArray(props)) {
        return extracted;
    }

    const existingObj =
        existing && typeof existing === 'object' && !Array.isArray(existing)
            ? (existing as Record<string, unknown>)
            : {};
    const extractedObj = extracted as Record<string, unknown>;
    const propSchemas = props as Record<string, unknown>;
    const result: Record<string, unknown> = { ...extractedObj };

    for (const [key, propSchema] of Object.entries(propSchemas)) {
        if (!isExtractableSchemaNode(propSchema)) {
            // Model should not have filled this; restore prior value if any
            if (key in existingObj) {
                result[key] = existingObj[key];
            } else {
                delete result[key];
            }
            continue;
        }
        if (key in extractedObj) {
            result[key] = mergePreservingNonExtractable(existingObj[key], extractedObj[key], propSchema);
        } else if (key in existingObj) {
            // Extractable field absent from model output — keep existing
            result[key] = existingObj[key];
        }
    }

    return result;
}
