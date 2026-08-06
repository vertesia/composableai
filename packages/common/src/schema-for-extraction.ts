/**
 * Extraction schema filtering.
 *
 * Content-type object_schema properties may set `"x-extract": false` to mark fields
 * that must not be filled by extraction models (match scores, ERP ids filled later,
 * internal bookkeeping). The full schema remains the object model for UI/storage;
 * only the filtered copy is used as result_schema for constrained decoding.
 */

export const X_EXTRACT = 'x-extract';

function unescapeJsonPointerSegment(segment: string): string {
    return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function resolveLocalRef(ref: string, root: unknown): unknown {
    if (!ref.startsWith('#/')) {
        return undefined;
    }
    let current = root;
    for (const segment of ref.slice(2).split('/').map(unescapeJsonPointerSegment)) {
        if (!current || typeof current !== 'object' || Array.isArray(current)) {
            return undefined;
        }
        current = (current as Record<string, unknown>)[segment];
    }
    return current;
}

function isExtractableSchemaNodeInternal(schema: unknown, root: unknown, seenRefs: Set<string>): boolean {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
        return true;
    }
    const schemaObj = schema as Record<string, unknown>;
    if (schemaObj[X_EXTRACT] === false) {
        return false;
    }
    if (typeof schemaObj.$ref === 'string' && !seenRefs.has(schemaObj.$ref)) {
        seenRefs.add(schemaObj.$ref);
        const resolved = resolveLocalRef(schemaObj.$ref, root);
        if (resolved !== undefined) {
            return isExtractableSchemaNodeInternal(resolved, root, seenRefs);
        }
    }
    return true;
}

export function isExtractableSchemaNode(schema: unknown, root: unknown = schema): boolean {
    return isExtractableSchemaNodeInternal(schema, root, new Set());
}

function filterSchemaArray(value: unknown, root: unknown): unknown[] | undefined {
    if (!Array.isArray(value)) {
        return undefined;
    }
    const filtered = value
        .map((item) => schemaForExtractionNode(item, root))
        .filter((item): item is unknown => item !== undefined);
    return filtered.length > 0 ? filtered : undefined;
}

function filterSchemaMap(value: unknown, root: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    const filtered: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
        const childFiltered = schemaForExtractionNode(child, root);
        if (childFiltered !== undefined) {
            filtered[key] = childFiltered;
        }
    }
    return Object.keys(filtered).length > 0 ? filtered : undefined;
}

function schemaForExtractionNode(schema: unknown, root: unknown): unknown {
    if (!schema || typeof schema !== 'object') {
        return schema;
    }
    if (Array.isArray(schema)) {
        return schema.map((item) => schemaForExtractionNode(item, root));
    }
    if (!isExtractableSchemaNode(schema, root)) {
        return undefined;
    }

    const node = { ...(schema as Record<string, unknown>) };

    for (const defsKey of ['$defs', 'definitions']) {
        const defs = filterSchemaMap(node[defsKey], root);
        if (defs) {
            node[defsKey] = defs;
        } else {
            delete node[defsKey];
        }
    }

    if (node.items && typeof node.items === 'object') {
        const items = schemaForExtractionNode(node.items, root);
        if (items !== undefined) {
            node.items = items;
        } else {
            delete node.items;
        }
    }
    for (const unionKey of ['anyOf', 'oneOf', 'allOf']) {
        if (Array.isArray(node[unionKey])) {
            const filtered = filterSchemaArray(node[unionKey], root);
            if (!filtered) {
                return undefined;
            }
            node[unionKey] = filtered;
        }
    }
    if (node.additionalProperties && typeof node.additionalProperties === 'object') {
        const additionalProperties = schemaForExtractionNode(node.additionalProperties, root);
        node.additionalProperties = additionalProperties ?? false;
    }

    if (node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)) {
        const props: Record<string, unknown> = {};
        for (const [key, child] of Object.entries(node.properties as Record<string, unknown>)) {
            const childFiltered = schemaForExtractionNode(child, root);
            if (childFiltered !== undefined) {
                props[key] = childFiltered;
            }
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

    return node;
}

/**
 * Deep-clones a JSON schema and removes properties (recursively) marked
 * `x-extract: false`, cleaning `required` arrays to match.
 */
export function schemaForExtraction<T>(schema: T): T {
    return (schemaForExtractionNode(schema, schema) ?? {}) as T;
}

function resolveSchemaNode(schema: unknown, root: unknown): unknown {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
        return schema;
    }
    const schemaObj = schema as Record<string, unknown>;
    if (typeof schemaObj.$ref !== 'string') {
        return schema;
    }
    return resolveLocalRef(schemaObj.$ref, root) ?? schema;
}

function mergePreservingNonExtractableNode(
    existing: unknown,
    extracted: unknown,
    schema: unknown,
    root: unknown,
): unknown {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
        return extracted;
    }
    const resolved = resolveSchemaNode(schema, root);
    if (!resolved || typeof resolved !== 'object' || Array.isArray(resolved)) {
        return extracted;
    }
    const schemaObj = resolved as Record<string, unknown>;

    // Arrays are new extraction output. Without a declared stable item key, index
    // merging can attach preserved ERP/match fields to the wrong row.
    if (Array.isArray(extracted)) {
        const itemSchema = schemaObj.items;
        if (!itemSchema || typeof itemSchema !== 'object') {
            return extracted;
        }
        return extracted.map((item) => mergePreservingNonExtractableNode(undefined, item, itemSchema, root));
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
        if (!isExtractableSchemaNode(propSchema, root)) {
            // Model should not have filled this; restore prior value if any.
            if (key in existingObj) {
                result[key] = existingObj[key];
            } else {
                delete result[key];
            }
            continue;
        }
        if (key in extractedObj) {
            result[key] = mergePreservingNonExtractableNode(existingObj[key], extractedObj[key], propSchema, root);
        }
    }

    return result;
}

/**
 * Merge model output over existing properties while preserving values at paths
 * marked `x-extract: false` on the full (unfiltered) schema.
 */
export function mergePreservingNonExtractable(existing: unknown, extracted: unknown, schema: unknown): unknown {
    return mergePreservingNonExtractableNode(existing, extracted, schema, schema);
}
