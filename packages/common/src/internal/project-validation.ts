/**
 * Validation for `ProjectIndexingConfiguration.property_mappings`.
 *
 * Lives here rather than in `../project.ts` so the public types module has no edge into the internal
 * tree: `project.ts` declares the wire types, this declares the server-side rule that guards them.
 * Both the Studio API boundary and zeno-server's index-creation path call it.
 */
import type { ProjectSearchPropertyType } from '../project.js';
import { ELASTICSEARCH_FIELD_PATH_PATTERN } from '../view-validation-helpers.js';

const PROJECT_SEARCH_PROPERTY_TYPES: readonly ProjectSearchPropertyType[] = [
    'keyword',
    'text',
    'boolean',
    'long',
    'double',
    'date',
];

const MAX_PROJECT_SEARCH_PROPERTY_MAPPINGS = 200;
const MAX_KEYWORD_IGNORE_ABOVE = 8191;

/**
 * Validate property mappings at API and index-creation boundaries.
 *
 * Returns user-facing issue strings instead of throwing so callers can map the
 * result to the error type appropriate for their boundary.
 */
export function validateProjectSearchPropertyMappings(value: unknown): string[] {
    if (value === undefined) return [];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return ['indexing.property_mappings must be an object keyed by property path'];
    }

    const entries = Object.entries(value as Record<string, unknown>);
    const issues: string[] = [];
    if (entries.length > MAX_PROJECT_SEARCH_PROPERTY_MAPPINGS) {
        issues.push(`indexing.property_mappings must contain at most ${MAX_PROJECT_SEARCH_PROPERTY_MAPPINGS} fields`);
    }

    const supportedTypes = new Set<string>(PROJECT_SEARCH_PROPERTY_TYPES);
    for (const [path, rawMapping] of entries) {
        const field = `indexing.property_mappings.${path}`;
        if (!ELASTICSEARCH_FIELD_PATH_PATTERN.test(path)) {
            issues.push(`${field} must be a dot-separated path containing only letters, numbers, and underscores`);
        }
        if (!rawMapping || typeof rawMapping !== 'object' || Array.isArray(rawMapping)) {
            issues.push(`${field} must be an object`);
            continue;
        }
        const mapping = rawMapping as Record<string, unknown>;
        const extraKeys = Object.keys(mapping).filter(
            (key) => !['type', 'format', 'ignore_above', 'ignore_malformed'].includes(key),
        );
        if (extraKeys.length > 0) {
            issues.push(`${field} contains unsupported option(s): ${extraKeys.join(', ')}`);
        }
        if (typeof mapping.type !== 'string' || !supportedTypes.has(mapping.type)) {
            issues.push(`${field}.type must be one of: ${PROJECT_SEARCH_PROPERTY_TYPES.join(', ')}`);
        }
        if (mapping.format !== undefined && (mapping.type !== 'date' || typeof mapping.format !== 'string')) {
            issues.push(`${field}.format is supported only for date mappings`);
        }
        if (
            mapping.ignore_above !== undefined &&
            (mapping.type !== 'keyword' ||
                !Number.isInteger(mapping.ignore_above) ||
                (mapping.ignore_above as number) < 1 ||
                (mapping.ignore_above as number) > MAX_KEYWORD_IGNORE_ABOVE)
        ) {
            issues.push(
                `${field}.ignore_above is supported only for keyword mappings and must be an integer from 1 to ${MAX_KEYWORD_IGNORE_ABOVE}`,
            );
        }
        if (
            mapping.ignore_malformed !== undefined &&
            (!['long', 'double', 'date'].includes(String(mapping.type)) ||
                typeof mapping.ignore_malformed !== 'boolean')
        ) {
            issues.push(`${field}.ignore_malformed is supported only for long, double, and date mappings`);
        }
    }
    return issues;
}
