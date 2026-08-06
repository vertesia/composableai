import { validateSupportedViewQuery } from './view-query-validation.js';
import type {
    ViewDisplayConfiguration,
    ViewExperienceConfiguration,
    ViewNavigationItem,
    ViewResultMedia,
} from './views.js';

export interface ViewValidationIssue {
    path: string;
    message: string;
}

const EXPERIENCE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const APP_VIEW_ID_PATTERN = /^app:([A-Za-z0-9][A-Za-z0-9._@-]*):([A-Za-z0-9][A-Za-z0-9._:-]*)$/;

function addDuplicateIssues(
    issues: ViewValidationIssue[],
    values: readonly string[],
    pathForIndex: (index: number) => string,
    message = 'must be unique',
): void {
    const seen = new Set<string>();
    values.forEach((value, index) => {
        if (seen.has(value)) {
            issues.push({ path: pathForIndex(index), message });
        }
        seen.add(value);
    });
}

function addMediaIssues(issues: ViewValidationIssue[], media: ViewResultMedia | undefined, path: string): void {
    if (media?.source === 'property' && media.field === undefined) {
        issues.push({ path: `${path}.field`, message: 'is required when media source is property' });
    }
}

function addDisplayIssues(
    issues: ViewValidationIssue[],
    display: ViewDisplayConfiguration,
    index: number,
    sortOptionIds: ReadonlySet<string>,
): void {
    const path = `results.displays[${index}]`;
    if (display.type === 'list') {
        addMediaIssues(issues, display.media, `${path}.media`);
    } else if (display.type === 'table') {
        display.columns.forEach((column, columnIndex) => {
            if (column.sort_option !== undefined && !sortOptionIds.has(column.sort_option)) {
                issues.push({
                    path: `${path}.columns[${columnIndex}].sort_option`,
                    message: 'must reference a configured sort option',
                });
            }
        });
    } else if (display.type === 'cards') {
        addMediaIssues(issues, display.media, `${path}.media`);
    } else if (display.type === 'gallery') {
        addMediaIssues(issues, display.media, `${path}.media`);
    } else {
        addMediaIssues(issues, display.card.media, `${path}.card.media`);
    }
}

function addNavigationIssues(issues: ViewValidationIssue[], navigation: readonly ViewNavigationItem[]): void {
    addDuplicateIssues(
        issues,
        navigation.map((item) => item.id),
        (index) => `navigation[${index}].id`,
    );

    navigation.forEach((item, index) => {
        const path = `navigation[${index}]`;
        if (item.source === 'hierarchy') {
            addDuplicateIssues(
                issues,
                item.levels.map((level) => level.id),
                (levelIndex) => `${path}.levels[${levelIndex}].id`,
                'must be unique within the hierarchy',
            );
            addDuplicateIssues(
                issues,
                item.levels.map((level) => level.field),
                (levelIndex) => `${path}.levels[${levelIndex}].field`,
                'must be unique within the hierarchy',
            );
        } else if (item.source === 'range') {
            addDuplicateIssues(
                issues,
                item.ranges.map((range) => range.id),
                (rangeIndex) => `${path}.ranges[${rangeIndex}].id`,
                'must be unique within the range facet',
            );
            item.ranges.forEach((range, rangeIndex) => {
                if (range.from !== undefined && range.to !== undefined && range.from >= range.to) {
                    issues.push({
                        path: `${path}.ranges[${rangeIndex}]`,
                        message: 'from must be less than to',
                    });
                }
            });
        }
    });
}

function addSearchIssues(issues: ViewValidationIssue[], configuration: ViewExperienceConfiguration): void {
    const search = configuration.search;
    if (search === undefined) return;

    if (search.mode !== 'agentic' && search.agentic !== undefined) {
        issues.push({ path: 'search.agentic', message: 'requires search.mode to be agentic' });
    }

    const fields = search.fields ?? [];
    addDuplicateIssues(
        issues,
        fields.map((field) => field.field),
        (index) => `search.fields[${index}].field`,
    );
    fields.forEach((field, index) => {
        if (field.mode === 'full_text' && field.type !== undefined && field.type !== 'text') {
            issues.push({
                path: `search.fields[${index}].type`,
                message: 'must be text when mode is full_text',
            });
        }
    });

    const keyTerms = search.key_terms ?? [];
    addDuplicateIssues(
        issues,
        keyTerms.map((term) => term.id),
        (index) => `search.key_terms[${index}].id`,
    );
    if (search.mode !== 'agentic') {
        keyTerms.forEach((term, index) => {
            if (term.field === undefined) {
                issues.push({
                    path: `search.key_terms[${index}].field`,
                    message: 'is required for deterministic search',
                });
            }
        });
    }
}

function addResultsIssues(issues: ViewValidationIssue[], configuration: ViewExperienceConfiguration): void {
    const results = configuration.results;
    if (results === undefined) return;

    const sortOptions = results.sort_options ?? [];
    addDuplicateIssues(
        issues,
        sortOptions.map((option) => option.id),
        (index) => `results.sort_options[${index}].id`,
    );
    const sortOptionIds = new Set(sortOptions.map((option) => option.id));
    if (results.default_sort !== undefined && !sortOptionIds.has(results.default_sort)) {
        issues.push({
            path: 'results.default_sort',
            message: 'must reference a configured sort option',
        });
    }

    addDuplicateIssues(
        issues,
        results.displays.map((display) => display.id),
        (index) => `results.displays[${index}].id`,
    );
    const displayIds = new Set(results.displays.map((display) => display.id));
    if (!displayIds.has(results.default_display)) {
        issues.push({
            path: 'results.default_display',
            message: 'must reference a configured display',
        });
    }
    results.displays.forEach((display, index) => {
        addDisplayIssues(issues, display, index, sortOptionIds);
    });
}

/**
 * Validate relationships and runtime constraints that JSON Schema cannot
 * express. Callers must establish structural validity first.
 */
export function validateViewExperienceSemantics(
    configuration: ViewExperienceConfiguration,
    mode: 'draft' | 'persisted' = 'draft',
): ViewValidationIssue[] {
    const issues: ViewValidationIssue[] = [];
    if (mode === 'persisted' && configuration.description?.trim().length === 0) {
        issues.push({
            path: 'description',
            message: 'must explain the View purpose',
        });
    }
    if (configuration.scope?.fixed_filter !== undefined) {
        issues.push(...validateSupportedViewQuery(configuration.scope.fixed_filter, 'scope.fixed_filter'));
    }
    addNavigationIssues(issues, configuration.navigation ?? []);
    addSearchIssues(issues, configuration);
    addResultsIssues(issues, configuration);
    return issues;
}

export function validateViewExperienceId(value: unknown): ViewValidationIssue[] {
    if (typeof value !== 'string' || value.trim() === '') {
        return [{ path: 'id', message: 'must be a non-empty string' }];
    }
    const issues: ViewValidationIssue[] = [];
    if (value.length > 64) {
        issues.push({ path: 'id', message: 'must contain at most 64 characters' });
    }
    if (!EXPERIENCE_ID_PATTERN.test(value)) {
        issues.push({ path: 'id', message: 'must be a lowercase URL-safe slug' });
    }
    return issues;
}

export interface AppViewExperienceId {
    app_name: string;
    local_id: string;
}

/**
 * Parse an app-contributed View id without allowing URL path separators or
 * percent-encoded path material into a downstream privileged request.
 */
export function parseAppViewExperienceId(value: unknown): AppViewExperienceId | undefined {
    if (typeof value !== 'string') return undefined;
    const match = APP_VIEW_ID_PATTERN.exec(value);
    if (!match) return undefined;
    return { app_name: match[1], local_id: match[2] };
}
