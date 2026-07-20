import {
    ELASTICSEARCH_FIELD_PATH_PATTERN as FIELD_PATTERN,
    isViewValidationRecord as isRecord,
    SERVER_CONTROLLED_VIEW_FIELD_ROOTS,
} from './view-validation-helpers.js';
import type { ViewElasticsearchQuery } from './views.js';

export interface ViewQueryValidationIssue {
    path: string;
    message: string;
}

export interface ViewQueryValidationOptions {
    allowedFields?: ReadonlySet<string>;
    allowedOperators?: ReadonlyMap<string, ReadonlySet<string>>;
}

const ALLOWED_QUERY_TYPES = new Set([
    'bool',
    'match',
    'multi_match',
    'simple_query_string',
    'term',
    'terms',
    'range',
    'exists',
    'ids',
    'prefix',
    'match_all',
]);
const MAX_QUERY_CLAUSES = 100;
const FORBIDDEN_FIELD_ROOTS = new Set<string>(SERVER_CONTROLLED_VIEW_FIELD_ROOTS);

function addFieldIssue(
    issues: ViewQueryValidationIssue[],
    field: unknown,
    path: string,
    options: ViewQueryValidationOptions,
): void {
    if (typeof field !== 'string' || !FIELD_PATTERN.test(field)) {
        issues.push({ path, message: 'must be a dot-separated field name' });
        return;
    }
    if (FORBIDDEN_FIELD_ROOTS.has(field.split('.')[0])) {
        issues.push({ path, message: `field '${field}' is server-controlled` });
        return;
    }
    if (options.allowedFields && !options.allowedFields.has(field)) {
        issues.push({ path, message: `field '${field}' is not available to this View` });
    }
}

function addOperatorIssue(
    issues: ViewQueryValidationIssue[],
    field: string,
    operator: string,
    path: string,
    options: ViewQueryValidationOptions,
): void {
    const allowed = options.allowedOperators?.get(field);
    if (allowed && !allowed.has(operator)) {
        issues.push({
            path,
            message: `operator '${operator}' is not available for field '${field}'`,
        });
    }
}

function validateSingleFieldClause(
    issues: ViewQueryValidationIssue[],
    value: unknown,
    path: string,
    validateValue: (fieldValue: unknown, valuePath: string, field: string) => void,
    options: ViewQueryValidationOptions,
): void {
    if (!isRecord(value)) {
        issues.push({ path, message: 'must be an object keyed by field name' });
        return;
    }
    const entries = Object.entries(value);
    if (entries.length !== 1) {
        issues.push({ path, message: 'must reference exactly one field' });
        return;
    }
    const [field, fieldValue] = entries[0];
    addFieldIssue(issues, field, `${path}.${field}`, options);
    validateValue(fieldValue, `${path}.${field}`, field);
}

function validateQueryNode(
    issues: ViewQueryValidationIssue[],
    value: unknown,
    path: string,
    state: { clauses: number },
    options: ViewQueryValidationOptions,
): void {
    state.clauses++;
    if (state.clauses > MAX_QUERY_CLAUSES) {
        issues.push({ path, message: `exceeds the maximum of ${MAX_QUERY_CLAUSES} query clauses` });
        return;
    }
    if (!isRecord(value)) {
        issues.push({ path, message: 'must be an Elasticsearch query object' });
        return;
    }
    const entries = Object.entries(value);
    if (entries.length !== 1) {
        issues.push({ path, message: 'must contain exactly one query clause' });
        return;
    }
    const [type, body] = entries[0];
    if (!ALLOWED_QUERY_TYPES.has(type)) {
        issues.push({ path: `${path}.${type}`, message: `query type '${type}' is not supported` });
        return;
    }

    if (type === 'match_all') {
        if (!isRecord(body)) {
            issues.push({ path: `${path}.match_all`, message: 'must be an object' });
        }
        return;
    }
    if (type === 'bool') {
        if (!isRecord(body)) {
            issues.push({ path: `${path}.bool`, message: 'must be an object' });
            return;
        }
        const allowed = new Set(['must', 'filter', 'should', 'must_not', 'minimum_should_match']);
        for (const key of Object.keys(body)) {
            if (!allowed.has(key)) {
                issues.push({ path: `${path}.bool.${key}`, message: 'is not supported' });
            }
        }
        for (const key of ['must', 'filter', 'should', 'must_not'] as const) {
            const child = body[key];
            if (child === undefined) continue;
            const children = Array.isArray(child) ? child : [child];
            if (children.length > 50) {
                issues.push({ path: `${path}.bool.${key}`, message: 'must contain at most 50 clauses' });
            }
            children.forEach((item, index) => {
                validateQueryNode(issues, item, `${path}.bool.${key}[${index}]`, state, options);
            });
        }
        const minimumShouldMatch = body.minimum_should_match;
        if (
            minimumShouldMatch !== undefined &&
            typeof minimumShouldMatch !== 'number' &&
            typeof minimumShouldMatch !== 'string'
        ) {
            issues.push({ path: `${path}.bool.minimum_should_match`, message: 'must be a number or string' });
        }
        return;
    }
    if (type === 'exists') {
        if (!isRecord(body)) {
            issues.push({ path: `${path}.exists`, message: 'must be an object' });
        } else {
            addFieldIssue(issues, body.field, `${path}.exists.field`, options);
            if (typeof body.field === 'string') {
                addOperatorIssue(issues, body.field, 'exists', `${path}.exists.field`, options);
            }
        }
        return;
    }
    if (type === 'ids') {
        if (!isRecord(body) || !Array.isArray(body.values) || body.values.length > 1_000) {
            issues.push({ path: `${path}.ids.values`, message: 'must be an array containing at most 1000 IDs' });
        } else if (body.values.some((id) => typeof id !== 'string')) {
            issues.push({ path: `${path}.ids.values`, message: 'must contain only strings' });
        }
        return;
    }
    if (type === 'multi_match' || type === 'simple_query_string') {
        if (!isRecord(body) || typeof body.query !== 'string') {
            issues.push({ path: `${path}.${type}.query`, message: 'must be a string' });
            return;
        }
        if (!Array.isArray(body.fields) || body.fields.length === 0 || body.fields.length > 20) {
            issues.push({ path: `${path}.${type}.fields`, message: 'must contain between 1 and 20 fields' });
        } else {
            body.fields.forEach((rawField, index) => {
                const field = typeof rawField === 'string' ? rawField.split('^')[0] : rawField;
                addFieldIssue(issues, field, `${path}.${type}.fields[${index}]`, options);
                if (typeof field === 'string') {
                    addOperatorIssue(issues, field, type, `${path}.${type}.fields[${index}]`, options);
                }
            });
        }
        return;
    }

    if (isRecord(body)) {
        const fieldEntries = Object.entries(body);
        if (fieldEntries.length === 1) {
            addOperatorIssue(issues, fieldEntries[0][0], type, `${path}.${type}.${fieldEntries[0][0]}`, options);
        }
    }
    validateSingleFieldClause(
        issues,
        body,
        `${path}.${type}`,
        (fieldValue, valuePath, field) => {
            if (type === 'terms') {
                if (!Array.isArray(fieldValue) || fieldValue.length > 1_000) {
                    issues.push({ path: valuePath, message: 'must be an array containing at most 1000 values' });
                }
                return;
            }
            if (type === 'range') {
                if (!isRecord(fieldValue)) {
                    issues.push({ path: valuePath, message: 'must be a range object' });
                    return;
                }
                const allowed = new Set(['gt', 'gte', 'lt', 'lte']);
                if (Object.keys(fieldValue).length === 0 || Object.keys(fieldValue).some((key) => !allowed.has(key))) {
                    issues.push({ path: valuePath, message: 'supports only gt, gte, lt, and lte' });
                }
                return;
            }
            if (type === 'prefix') {
                if (field !== 'location') {
                    issues.push({ path: valuePath, message: 'prefix queries are supported only for location' });
                }
                const prefix = isRecord(fieldValue) ? fieldValue.value : fieldValue;
                if (typeof prefix !== 'string' || !prefix.startsWith('/') || !prefix.endsWith('/')) {
                    issues.push({ path: valuePath, message: 'must be a boundary-aware absolute location prefix' });
                }
                return;
            }
            if (type === 'match') {
                const query = isRecord(fieldValue) ? fieldValue.query : fieldValue;
                if (typeof query !== 'string') {
                    issues.push({ path: valuePath, message: 'must contain a string query' });
                }
                return;
            }
            if (type === 'term' && isRecord(fieldValue)) {
                const allowed = new Set(['value', 'boost', 'case_insensitive']);
                if (!('value' in fieldValue) || Object.keys(fieldValue).some((key) => !allowed.has(key))) {
                    issues.push({
                        path: valuePath,
                        message: 'supports only value, boost, and case_insensitive options',
                    });
                    return;
                }
                if (isRecord(fieldValue.value) || Array.isArray(fieldValue.value)) {
                    issues.push({ path: `${valuePath}.value`, message: 'must be a scalar value' });
                }
                if (fieldValue.boost !== undefined && typeof fieldValue.boost !== 'number') {
                    issues.push({ path: `${valuePath}.boost`, message: 'must be a number' });
                }
                if (fieldValue.case_insensitive !== undefined && typeof fieldValue.case_insensitive !== 'boolean') {
                    issues.push({ path: `${valuePath}.case_insensitive`, message: 'must be a boolean' });
                }
                return;
            }
            if (isRecord(fieldValue) || Array.isArray(fieldValue)) {
                issues.push({ path: valuePath, message: 'must be a scalar value' });
            }
        },
        options,
    );
}

function normalizeViewQueryNode(value: unknown, state: { clauses: number }): unknown {
    state.clauses++;
    if (state.clauses > MAX_QUERY_CLAUSES) return value;
    if (!isRecord(value)) return value;
    const entries = Object.entries(value);
    if (entries.length !== 1) return value;
    const [type, body] = entries[0];
    if (type === 'bool' && isRecord(body)) {
        const normalizedBody: Record<string, unknown> = { ...body };
        for (const key of ['must', 'filter', 'should', 'must_not'] as const) {
            const child = body[key];
            if (Array.isArray(child)) {
                normalizedBody[key] = child.map((item) => normalizeViewQueryNode(item, state));
            } else if (child !== undefined) {
                normalizedBody[key] = normalizeViewQueryNode(child, state);
            }
        }
        return { bool: normalizedBody };
    }
    if (type !== 'term' || !isRecord(body)) return value;
    const fieldEntries = Object.entries(body);
    if (fieldEntries.length !== 1) return value;
    const [field, fieldValue] = fieldEntries[0];
    if (!isRecord(fieldValue) || Object.keys(fieldValue).length !== 1 || !('value' in fieldValue)) return value;
    return { term: { [field]: fieldValue.value } };
}

export function normalizeViewQuery(value: unknown): unknown {
    return normalizeViewQueryNode(value, { clauses: 0 });
}

export function validateSupportedViewQuery(
    value: unknown,
    path = 'query',
    options: ViewQueryValidationOptions = {},
): ViewQueryValidationIssue[] {
    const issues: ViewQueryValidationIssue[] = [];
    validateQueryNode(issues, normalizeViewQuery(value), path, { clauses: 0 }, options);
    return issues;
}

export function asSupportedViewQuery(
    value: unknown,
    path = 'query',
    options: ViewQueryValidationOptions = {},
): ViewElasticsearchQuery {
    const normalized = normalizeViewQuery(value);
    const issues: ViewQueryValidationIssue[] = [];
    validateQueryNode(issues, normalized, path, { clauses: 0 }, options);
    if (issues.length > 0) {
        throw new Error(issues.map((issue) => `${issue.path} ${issue.message}`).join('; '));
    }
    return normalized as ViewElasticsearchQuery;
}
