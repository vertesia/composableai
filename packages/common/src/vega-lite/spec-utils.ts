/**
 * Vega-Lite Spec Utilities
 *
 * Pure functions for processing Vega-Lite specifications.
 * Shared between client (UI) and server (tools) code.
 */

// ============================================================================
// Types
// ============================================================================

export interface ArtifactReference {
    /** Path to the data object in the spec tree */
    path: string[];
    /** The artifact path (without "artifact:" prefix) */
    artifactPath: string;
}

// ============================================================================
// Artifact URL Resolution
// ============================================================================

/**
 * Walk a Vega-Lite spec and find all artifact: URL references in data.url fields.
 * Returns an array of references with their paths in the spec tree.
 */
export function findArtifactReferences(
    spec: Record<string, unknown>,
    currentPath: string[] = []
): ArtifactReference[] {
    const references: ArtifactReference[] = [];

    if (!spec || typeof spec !== 'object') {
        return references;
    }

    // Check if this object has a data.url that's an artifact reference
    const data = spec.data as Record<string, unknown> | undefined;
    if (data && typeof data === 'object') {
        const url = data.url;
        if (typeof url === 'string' && url.startsWith('artifact:')) {
            references.push({
                path: [...currentPath, 'data'],
                artifactPath: url.replace(/^artifact:/, '').trim(),
            });
        }
    }

    // Recursively check nested objects (layer, vconcat, hconcat, concat, spec, etc.)
    const nestedKeys = ['layer', 'vconcat', 'hconcat', 'concat', 'spec', 'repeat', 'facet'];
    for (const key of nestedKeys) {
        if (key in spec) {
            const value = spec[key];
            if (Array.isArray(value)) {
                value.forEach((item, index) => {
                    if (item && typeof item === 'object') {
                        references.push(
                            ...findArtifactReferences(
                                item as Record<string, unknown>,
                                [...currentPath, key, String(index)]
                            )
                        );
                    }
                });
            } else if (typeof value === 'object' && value !== null) {
                references.push(
                    ...findArtifactReferences(
                        value as Record<string, unknown>,
                        [...currentPath, key]
                    )
                );
            }
        }
    }

    return references;
}

/**
 * Deep clone and update the spec by replacing artifact URLs with resolved data values.
 */
export function replaceArtifactData(
    spec: Record<string, unknown>,
    resolvedData: Map<string, unknown[]>
): Record<string, unknown> {
    const result = JSON.parse(JSON.stringify(spec)) as Record<string, unknown>;

    for (const [pathKey, data] of resolvedData) {
        const path = pathKey.split('.');
        let current: Record<string, unknown> = result;

        // Navigate to the parent of the data object
        for (let i = 0; i < path.length - 1; i++) {
            const segment = path[i];
            if (current[segment] === undefined) {
                break;
            }
            current = current[segment] as Record<string, unknown>;
        }

        // Replace data.url with data.values
        const lastKey = path[path.length - 1];
        const dataObj = current[lastKey];
        if (dataObj && typeof dataObj === 'object') {
            const dataRecord = dataObj as Record<string, unknown>;
            delete dataRecord.url;
            dataRecord.values = data;
        }
    }

    return result;
}

// ============================================================================
// Selection Parameter Fixes
// ============================================================================

/**
 * Check if a view has encoding using any of the specified fields.
 */
function viewHasField(view: Record<string, unknown>, fields: string[]): boolean {
    if (!view || !view.encoding) return false;

    const encoding = view.encoding as Record<string, unknown>;
    for (const field of fields) {
        for (const channel of Object.values(encoding)) {
            if (channel && typeof channel === 'object' && (channel as Record<string, unknown>).field === field) {
                return true;
            }
        }
    }

    // Also check nested layers
    if (Array.isArray(view.layer)) {
        for (const layer of view.layer) {
            if (layer && typeof layer === 'object' && viewHasField(layer as Record<string, unknown>, fields)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Check if a view has color encoding using any of the specified fields.
 */
function viewHasColorEncoding(view: Record<string, unknown>, fields: string[]): boolean {
    if (!view) return false;

    const checkEncoding = (encoding: Record<string, unknown> | undefined): boolean => {
        if (!encoding) return false;
        const color = encoding.color as Record<string, unknown> | undefined;
        const colorField = color?.field as string | undefined;
        return colorField !== undefined && fields.includes(colorField);
    };

    if (checkEncoding(view.encoding as Record<string, unknown> | undefined)) return true;

    // Check nested layers
    if (Array.isArray(view.layer)) {
        for (const layer of view.layer) {
            if (layer && typeof layer === 'object') {
                const layerRecord = layer as Record<string, unknown>;
                if (checkEncoding(layerRecord.encoding as Record<string, unknown> | undefined)) {
                    return true;
                }
            }
        }
    }

    return false;
}

/**
 * Preprocess a Vega-Lite spec to fix duplicate signal names that occur
 * when params with selections are used in vconcat/hconcat layouts.
 *
 * The issue: Vega-Lite creates internal signals like `paramName_tuple` for
 * point selections. When a param is defined at the root level of a vconcat/hconcat
 * spec, Vega-Lite's compiler creates duplicate signals when propagating the
 * selection to sub-views.
 *
 * Solution: Move selection params from the root level to the first sub-view
 * (where selections typically originate). Cross-view references are preserved
 * so that clicking in one view filters other views.
 */
export function fixVegaLiteSelectionParams(spec: Record<string, unknown>): Record<string, unknown> {
    // Deep clone the spec to avoid mutations
    const result = JSON.parse(JSON.stringify(spec)) as Record<string, unknown>;

    // Check if this is a concatenated spec with root-level selection params
    const concatKeys = ['vconcat', 'hconcat', 'concat'];
    const hasConcatViews = concatKeys.some(key => Array.isArray(result[key]));

    if (!hasConcatViews) {
        // Not a concatenated spec, no special handling needed
        return result;
    }

    // Check for selection params at the root level
    const rootSelectionParams: Array<{ name: string; param: Record<string, unknown> }> = [];
    if (Array.isArray(result.params)) {
        for (const param of result.params) {
            if (param && typeof param === 'object') {
                const paramRecord = param as Record<string, unknown>;
                if (paramRecord.name && paramRecord.select) {
                    rootSelectionParams.push({ name: paramRecord.name as string, param: paramRecord });
                }
            }
        }
    }

    if (rootSelectionParams.length === 0) {
        // No selection params at root level, no special handling needed
        return result;
    }

    // Strategy: Move the selection param to the first sub-view that has an
    // encoding field matching the selection. Keep cross-view references intact
    // so filtering works across views.

    for (const { name: paramName, param } of rootSelectionParams) {
        const select = param.select as Record<string, unknown>;
        const selectFields = (select?.fields as string[]) || [];
        const hasLegendBinding = select?.bind === 'legend';

        // Find the concat array
        let concatArray: unknown[] | null = null;
        for (const key of concatKeys) {
            if (Array.isArray(result[key])) {
                concatArray = result[key] as unknown[];
                break;
            }
        }

        if (!concatArray || concatArray.length === 0) continue;

        // Find the first view that has the selection field in its encoding
        // This is typically where users click to make selections
        let targetViewIndex = 0;
        for (let i = 0; i < concatArray.length; i++) {
            const view = concatArray[i] as Record<string, unknown>;
            if (viewHasField(view, selectFields) || (hasLegendBinding && viewHasColorEncoding(view, selectFields))) {
                targetViewIndex = i;
                break;
            }
        }

        // Move the param to the target view
        const targetView = concatArray[targetViewIndex] as Record<string, unknown>;
        if (!targetView.params) {
            targetView.params = [];
        }
        (targetView.params as unknown[]).push(param);

        // Remove the param from root level
        result.params = (result.params as unknown[]).filter(
            (p) => (p as Record<string, unknown>).name !== paramName
        );

        // Cross-view references are kept intact - Vega-Lite handles signal
        // propagation from the view where the selection is defined to other views
    }

    // Clean up empty params array at root
    if (Array.isArray(result.params) && result.params.length === 0) {
        delete result.params;
    }

    return result;
}

// ============================================================================
// Parameter Values
// ============================================================================

/**
 * Apply parameter values to a Vega-Lite spec.
 * Updates the 'value' field of named params, allowing models to set
 * initial values for interactive controls (sliders, dropdowns, etc.).
 */
export function applyParameterValues(
    spec: Record<string, unknown>,
    parameterValues: Record<string, unknown>
): Record<string, unknown> {
    if (!parameterValues || Object.keys(parameterValues).length === 0) {
        return spec;
    }

    const result = JSON.parse(JSON.stringify(spec)) as Record<string, unknown>;

    // Helper to update params in a view
    const updateParams = (params: unknown[]) => {
        for (const param of params) {
            if (param && typeof param === 'object') {
                const paramRecord = param as Record<string, unknown>;
                const paramName = paramRecord.name;
                if (typeof paramName === 'string' && paramName in parameterValues) {
                    paramRecord.value = parameterValues[paramName];
                }
            }
        }
    };

    // Update root-level params
    if (Array.isArray(result.params)) {
        updateParams(result.params);
    }

    // Update params in nested views (vconcat, hconcat, concat)
    const updateNestedViews = (views: unknown[]) => {
        if (!Array.isArray(views)) return;
        for (const view of views) {
            if (view && typeof view === 'object') {
                const viewRecord = view as Record<string, unknown>;
                if (Array.isArray(viewRecord.params)) {
                    updateParams(viewRecord.params);
                }
                // Recursively handle nested concatenations
                if (viewRecord.vconcat) updateNestedViews(viewRecord.vconcat as unknown[]);
                if (viewRecord.hconcat) updateNestedViews(viewRecord.hconcat as unknown[]);
                if (viewRecord.concat) updateNestedViews(viewRecord.concat as unknown[]);
                // Handle layers
                if (Array.isArray(viewRecord.layer)) {
                    for (const layer of viewRecord.layer) {
                        if (layer && typeof layer === 'object') {
                            const layerRecord = layer as Record<string, unknown>;
                            if (Array.isArray(layerRecord.params)) {
                                updateParams(layerRecord.params);
                            }
                        }
                    }
                }
            }
        }
    };

    if (result.vconcat) updateNestedViews(result.vconcat as unknown[]);
    if (result.hconcat) updateNestedViews(result.hconcat as unknown[]);
    if (result.concat) updateNestedViews(result.concat as unknown[]);
    if (Array.isArray(result.layer)) {
        for (const layer of result.layer) {
            if (layer && typeof layer === 'object') {
                const layerRecord = layer as Record<string, unknown>;
                if (Array.isArray(layerRecord.params)) {
                    updateParams(layerRecord.params);
                }
            }
        }
    }

    return result;
}
