import { validateSupportedViewQuery } from './view-query-validation.js';
import type {
    AgenticViewSearchConfiguration,
    ViewDisplayConfiguration,
    ViewExperienceConfiguration,
    ViewNavigationItem,
    ViewResultField,
    ViewResultMedia,
} from './views.js';
import { VIEW_SEARCH_FIELD_TYPES } from './views.js';

export interface ViewValidationIssue {
    path: string;
    message: string;
}

const EXPERIENCE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const APP_VIEW_ID_PATTERN = /^app:([A-Za-z0-9][A-Za-z0-9._@-]*):([A-Za-z0-9][A-Za-z0-9._:-]*)$/;
const CONFIGURATION_ID_PATTERN = /^[a-z][a-z0-9_-]*$/;
const FIELD_PATTERN = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function addStringIssue(
    issues: ViewValidationIssue[],
    value: unknown,
    path: string,
    options: { required?: boolean; maxLength?: number } = {},
): void {
    if (value === undefined) {
        if (options.required) {
            issues.push({ path, message: 'is required' });
        }
        return;
    }
    if (typeof value !== 'string' || value.trim() === '') {
        issues.push({ path, message: 'must be a non-empty string' });
        return;
    }
    if (options.maxLength && value.length > options.maxLength) {
        issues.push({ path, message: `must contain at most ${options.maxLength} characters` });
    }
}

function addBooleanIssue(issues: ViewValidationIssue[], value: unknown, path: string): void {
    if (value !== undefined && typeof value !== 'boolean') {
        issues.push({ path, message: 'must be a boolean' });
    }
}

function addNumberIssue(
    issues: ViewValidationIssue[],
    value: unknown,
    path: string,
    options: { integer?: boolean; min?: number; max?: number } = {},
): void {
    if (value === undefined) {
        return;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        issues.push({ path, message: 'must be a finite number' });
        return;
    }
    if (options.integer && !Number.isInteger(value)) {
        issues.push({ path, message: 'must be an integer' });
    }
    if (options.min !== undefined && value < options.min) {
        issues.push({ path, message: `must be at least ${options.min}` });
    }
    if (options.max !== undefined && value > options.max) {
        issues.push({ path, message: `must be at most ${options.max}` });
    }
}

function addEnumIssue(issues: ViewValidationIssue[], value: unknown, path: string, allowed: readonly string[]): void {
    if (value !== undefined && (typeof value !== 'string' || !allowed.includes(value))) {
        issues.push({ path, message: `must be one of: ${allowed.join(', ')}` });
    }
}

function addNumberEnumIssue(
    issues: ViewValidationIssue[],
    value: unknown,
    path: string,
    allowed: readonly number[],
): void {
    if (value !== undefined && (typeof value !== 'number' || !allowed.includes(value))) {
        issues.push({ path, message: `must be one of: ${allowed.join(', ')}` });
    }
}

function addStringArrayIssues(
    issues: ViewValidationIssue[],
    value: unknown,
    path: string,
    options: { maxItems?: number; pathValues?: boolean } = {},
): void {
    if (value === undefined) {
        return;
    }
    if (!Array.isArray(value)) {
        issues.push({ path, message: 'must be an array of strings' });
        return;
    }
    if (options.maxItems && value.length > options.maxItems) {
        issues.push({ path, message: `must contain at most ${options.maxItems} values` });
    }
    value.forEach((item, index) => {
        if (typeof item !== 'string' || item.trim() === '') {
            issues.push({ path: `${path}[${index}]`, message: 'must be a non-empty string' });
        } else if (options.pathValues && !item.startsWith('/')) {
            issues.push({ path: `${path}[${index}]`, message: 'must be an absolute location path' });
        }
    });
}

function addConfigurationIdIssue(issues: ViewValidationIssue[], value: unknown, path: string): void {
    addStringIssue(issues, value, path, { required: true, maxLength: 64 });
    if (typeof value === 'string' && !CONFIGURATION_ID_PATTERN.test(value)) {
        issues.push({ path, message: 'must start with a letter and contain only letters, numbers, _ or -' });
    }
}

function addFieldIssue(issues: ViewValidationIssue[], value: unknown, path: string): void {
    addStringIssue(issues, value, path, { required: true, maxLength: 160 });
    if (typeof value === 'string' && !FIELD_PATTERN.test(value)) {
        issues.push({ path, message: 'must be a dot-separated Elasticsearch field name' });
    }
}

function addResultFieldIssues(issues: ViewValidationIssue[], value: unknown, path: string): void {
    if (!isRecord(value)) {
        issues.push({ path, message: 'must be an object' });
        return;
    }
    const field = value as unknown as ViewResultField;
    addFieldIssue(issues, field.field, `${path}.field`);
    addStringIssue(issues, field.label, `${path}.label`, { maxLength: 120 });
    addStringIssue(issues, field.fallback, `${path}.fallback`, { maxLength: 240 });
    addEnumIssue(issues, field.format, `${path}.format`, [
        'text',
        'date',
        'number',
        'badge',
        'user',
        'content_type',
        'location',
    ]);
}

function addResultFieldArrayIssues(issues: ViewValidationIssue[], value: unknown, path: string): void {
    if (value === undefined) {
        return;
    }
    if (!Array.isArray(value)) {
        issues.push({ path, message: 'must be an array' });
        return;
    }
    value.forEach((field, index) => {
        addResultFieldIssues(issues, field, `${path}[${index}]`);
    });
}

function addMediaIssues(issues: ViewValidationIssue[], value: unknown, path: string, required = false): void {
    if (value === undefined) {
        if (required) {
            issues.push({ path, message: 'is required' });
        }
        return;
    }
    if (!isRecord(value)) {
        issues.push({ path, message: 'must be an object' });
        return;
    }
    const media = value as unknown as ViewResultMedia;
    addEnumIssue(issues, media.source, `${path}.source`, ['content_thumbnail', 'property', 'type_icon']);
    addEnumIssue(issues, media.fit, `${path}.fit`, ['cover', 'contain']);
    addEnumIssue(issues, media.fallback, `${path}.fallback`, ['type_icon', 'placeholder', 'none']);
    if (media.source === 'property' || media.field !== undefined) {
        addFieldIssue(issues, media.field, `${path}.field`);
    }
}

function addNavigationIssues(issues: ViewValidationIssue[], navigation: unknown): void {
    if (navigation === undefined) {
        return;
    }
    if (!Array.isArray(navigation)) {
        issues.push({ path: 'navigation', message: 'must be an array' });
        return;
    }
    if (navigation.length > 20) {
        issues.push({ path: 'navigation', message: 'must contain at most 20 navigation items' });
    }
    const ids = new Set<string>();
    navigation.forEach((rawItem, index) => {
        const path = `navigation[${index}]`;
        if (!isRecord(rawItem)) {
            issues.push({ path, message: 'must be an object' });
            return;
        }
        const item = rawItem as unknown as ViewNavigationItem;
        addConfigurationIdIssue(issues, item.id, `${path}.id`);
        if (typeof item.id === 'string') {
            if (ids.has(item.id)) {
                issues.push({ path: `${path}.id`, message: 'must be unique' });
            }
            ids.add(item.id);
        }
        addStringIssue(issues, item.label, `${path}.label`, { required: true, maxLength: 120 });
        addStringIssue(issues, item.source, `${path}.source`, { required: true });
        addEnumIssue(issues, item.presentation, `${path}.presentation`, ['tree', 'list', 'select', 'chips']);
        addBooleanIssue(issues, item.multi_select, `${path}.multi_select`);
        addNumberIssue(issues, item.order, `${path}.order`, { integer: true });
        addStringIssue(issues, item.renderer, `${path}.renderer`, { maxLength: 120 });
        addEnumIssue(issues, item.source, `${path}.source`, ['location', 'collection', 'terms', 'hierarchy', 'range']);

        if (item.source === 'location') {
            addStringArrayIssues(issues, item.roots, `${path}.roots`, { maxItems: 50, pathValues: true });
            addNumberIssue(issues, item.depth, `${path}.depth`, { integer: true, min: 1, max: 20 });
        } else if (item.source === 'collection') {
            addStringArrayIssues(issues, item.roots, `${path}.roots`, { maxItems: 50 });
            addBooleanIssue(issues, item.include_descendants, `${path}.include_descendants`);
        } else if (item.source === 'terms') {
            addFieldIssue(issues, item.field, `${path}.field`);
            addNumberIssue(issues, item.size, `${path}.size`, { integer: true, min: 1, max: 500 });
            addEnumIssue(issues, item.sort, `${path}.sort`, ['count', 'label']);
            addStringIssue(issues, item.missing_label, `${path}.missing_label`, { maxLength: 120 });
        } else if (item.source === 'hierarchy') {
            if (item.multi_select !== undefined && item.multi_select !== false) {
                issues.push({ path: `${path}.multi_select`, message: 'must be false for a property hierarchy' });
            }
            if (!Array.isArray(item.levels) || item.levels.length < 2 || item.levels.length > 10) {
                issues.push({ path: `${path}.levels`, message: 'must contain between 2 and 10 hierarchy levels' });
            } else {
                const levelIds = new Set<string>();
                const levelFields = new Set<string>();
                item.levels.forEach((level, levelIndex) => {
                    const levelPath = `${path}.levels[${levelIndex}]`;
                    addConfigurationIdIssue(issues, level?.id, `${levelPath}.id`);
                    addStringIssue(issues, level?.label, `${levelPath}.label`, {
                        required: true,
                        maxLength: 120,
                    });
                    addFieldIssue(issues, level?.field, `${levelPath}.field`);
                    addNumberIssue(issues, level?.size, `${levelPath}.size`, {
                        integer: true,
                        min: 1,
                        max: 500,
                    });
                    addEnumIssue(issues, level?.sort, `${levelPath}.sort`, ['count', 'label']);
                    if (typeof level?.id === 'string') {
                        if (levelIds.has(level.id)) {
                            issues.push({ path: `${levelPath}.id`, message: 'must be unique within the hierarchy' });
                        }
                        levelIds.add(level.id);
                    }
                    if (typeof level?.field === 'string') {
                        if (levelFields.has(level.field)) {
                            issues.push({
                                path: `${levelPath}.field`,
                                message: 'must be unique within the hierarchy',
                            });
                        }
                        levelFields.add(level.field);
                    }
                });
            }
        } else if (item.source === 'range') {
            addFieldIssue(issues, item.field, `${path}.field`);
            if (!Array.isArray(item.ranges) || item.ranges.length === 0) {
                issues.push({ path: `${path}.ranges`, message: 'must contain at least one range' });
            } else {
                const rangeIds = new Set<string>();
                item.ranges.forEach((range, rangeIndex) => {
                    const rangePath = `${path}.ranges[${rangeIndex}]`;
                    addConfigurationIdIssue(issues, range?.id, `${rangePath}.id`);
                    addStringIssue(issues, range?.label, `${rangePath}.label`, {
                        required: true,
                        maxLength: 120,
                    });
                    addNumberIssue(issues, range?.from, `${rangePath}.from`);
                    addNumberIssue(issues, range?.to, `${rangePath}.to`);
                    if (range?.from === undefined && range?.to === undefined) {
                        issues.push({ path: rangePath, message: 'must define from, to, or both' });
                    }
                    if (range?.from !== undefined && range?.to !== undefined && range.from >= range.to) {
                        issues.push({ path: rangePath, message: 'from must be less than to' });
                    }
                    if (typeof range?.id === 'string') {
                        if (rangeIds.has(range.id)) {
                            issues.push({ path: `${rangePath}.id`, message: 'must be unique within the range facet' });
                        }
                        rangeIds.add(range.id);
                    }
                });
            }
        }
    });
}

function addAgenticSearchIssues(
    issues: ViewValidationIssue[],
    value: AgenticViewSearchConfiguration | undefined,
    path: string,
): void {
    if (value === undefined) {
        return;
    }
    if (!isRecord(value)) {
        issues.push({ path, message: 'must be an object' });
        return;
    }
    addStringIssue(issues, value.interaction, `${path}.interaction`, { maxLength: 200 });
    addStringIssue(issues, value.instructions, `${path}.instructions`, { maxLength: 4_000 });
    addEnumIssue(issues, value.mode, `${path}.mode`, ['query', 'rerank', 'curate']);
    addNumberIssue(issues, value.candidate_limit, `${path}.candidate_limit`, { integer: true, min: 1, max: 500 });
    addNumberIssue(issues, value.timeout_ms, `${path}.timeout_ms`, { integer: true, min: 100, max: 30_000 });
    addNumberIssue(issues, value.minimum_confidence, `${path}.minimum_confidence`, { min: 0, max: 1 });
    if (value.config !== undefined && !isRecord(value.config)) {
        issues.push({ path: `${path}.config`, message: 'must be an object' });
    }
    if (value.annotations !== undefined) {
        if (!isRecord(value.annotations)) {
            issues.push({ path: `${path}.annotations`, message: 'must be an object' });
        } else {
            addEnumIssue(issues, value.annotations.mode, `${path}.annotations.mode`, ['none', 'why_match', 'answer']);
            addStringIssue(issues, value.annotations.instructions, `${path}.annotations.instructions`, {
                maxLength: 4_000,
            });
        }
    }
}

function addSearchIssues(issues: ViewValidationIssue[], value: unknown): void {
    if (value === undefined) {
        return;
    }
    if (!isRecord(value)) {
        issues.push({ path: 'search', message: 'must be an object' });
        return;
    }
    addStringIssue(issues, value.renderer, 'search.renderer', { maxLength: 120 });
    addStringIssue(issues, value.placeholder, 'search.placeholder', { maxLength: 240 });
    addEnumIssue(issues, value.mode, 'search.mode', ['deterministic', 'agentic']);
    if (value.mode === 'agentic') {
        addAgenticSearchIssues(issues, value.agentic as AgenticViewSearchConfiguration | undefined, 'search.agentic');
    } else if (value.agentic !== undefined) {
        issues.push({ path: 'search.agentic', message: 'requires search.mode to be agentic' });
    }

    if (value.fields !== undefined) {
        if (!Array.isArray(value.fields)) {
            issues.push({ path: 'search.fields', message: 'must be an array' });
        } else {
            if (value.fields.length > 50) {
                issues.push({ path: 'search.fields', message: 'must contain at most 50 fields' });
            }
            const fields = new Set<string>();
            value.fields.forEach((rawField, index) => {
                const path = `search.fields[${index}]`;
                if (!isRecord(rawField)) {
                    issues.push({ path, message: 'must be an object' });
                    return;
                }
                addFieldIssue(issues, rawField.field, `${path}.field`);
                addStringIssue(issues, rawField.description, `${path}.description`, { maxLength: 500 });
                addEnumIssue(issues, rawField.type, `${path}.type`, VIEW_SEARCH_FIELD_TYPES);
                addEnumIssue(issues, rawField.mode, `${path}.mode`, ['auto', 'full_text', 'exact']);
                addNumberIssue(issues, rawField.boost, `${path}.boost`, { min: 0.1, max: 20 });
                if (rawField.mode === 'full_text' && rawField.type !== undefined && rawField.type !== 'text') {
                    issues.push({ path: `${path}.type`, message: 'must be text when mode is full_text' });
                }
                if (typeof rawField.field === 'string') {
                    if (fields.has(rawField.field)) {
                        issues.push({ path: `${path}.field`, message: 'must be unique' });
                    }
                    fields.add(rawField.field);
                }
            });
        }
    }

    if (value.key_terms !== undefined) {
        if (!Array.isArray(value.key_terms)) {
            issues.push({ path: 'search.key_terms', message: 'must be an array' });
        } else {
            if (value.key_terms.length > 50) {
                issues.push({ path: 'search.key_terms', message: 'must contain at most 50 terms' });
            }
            const ids = new Set<string>();
            value.key_terms.forEach((rawTerm, index) => {
                const path = `search.key_terms[${index}]`;
                if (!isRecord(rawTerm)) {
                    issues.push({ path, message: 'must be an object' });
                    return;
                }
                addConfigurationIdIssue(issues, rawTerm.id, `${path}.id`);
                addStringIssue(issues, rawTerm.label, `${path}.label`, { required: true, maxLength: 120 });
                addEnumIssue(issues, rawTerm.type, `${path}.type`, VIEW_SEARCH_FIELD_TYPES);
                addEnumIssue(issues, rawTerm.operator, `${path}.operator`, ['match', 'term', 'range']);
                addBooleanIssue(issues, rawTerm.multiple, `${path}.multiple`);
                if (rawTerm.field !== undefined) {
                    addFieldIssue(issues, rawTerm.field, `${path}.field`);
                } else if (value.mode !== 'agentic') {
                    issues.push({ path: `${path}.field`, message: 'is required for deterministic search' });
                }
                if (typeof rawTerm.id === 'string') {
                    if (ids.has(rawTerm.id)) {
                        issues.push({ path: `${path}.id`, message: 'must be unique' });
                    }
                    ids.add(rawTerm.id);
                }
            });
        }
    }
}

function addDisplayIssues(
    issues: ViewValidationIssue[],
    rawDisplay: unknown,
    index: number,
    sortOptionIds: Set<string>,
): string | undefined {
    const path = `results.displays[${index}]`;
    if (!isRecord(rawDisplay)) {
        issues.push({ path, message: 'must be an object' });
        return undefined;
    }
    const display = rawDisplay as unknown as ViewDisplayConfiguration;
    addConfigurationIdIssue(issues, display.id, `${path}.id`);
    addStringIssue(issues, display.label, `${path}.label`, { required: true, maxLength: 120 });
    addStringIssue(issues, display.renderer, `${path}.renderer`, { maxLength: 120 });
    addNumberIssue(issues, display.page_size, `${path}.page_size`, { integer: true, min: 1, max: 200 });
    addEnumIssue(issues, display.type, `${path}.type`, ['list', 'table', 'cards', 'gallery', 'board']);

    if (display.type === 'list') {
        addResultFieldIssues(issues, display.title, `${path}.title`);
        addResultFieldArrayIssues(issues, display.subtitle, `${path}.subtitle`);
        if (display.description !== undefined) {
            addResultFieldIssues(issues, display.description, `${path}.description`);
        }
        addMediaIssues(issues, display.media, `${path}.media`);
        addResultFieldArrayIssues(issues, display.badges, `${path}.badges`);
    } else if (display.type === 'table') {
        if (!Array.isArray(display.columns) || display.columns.length === 0) {
            issues.push({ path: `${path}.columns`, message: 'must contain at least one column' });
        } else {
            display.columns.forEach((column, columnIndex) => {
                const columnPath = `${path}.columns[${columnIndex}]`;
                addResultFieldIssues(issues, column, columnPath);
                addNumberIssue(issues, column?.width, `${columnPath}.width`, { integer: true, min: 40, max: 2_000 });
                addBooleanIssue(issues, column?.sortable, `${columnPath}.sortable`);
                if (column?.sort_option !== undefined) {
                    addConfigurationIdIssue(issues, column.sort_option, `${columnPath}.sort_option`);
                    if (!sortOptionIds.has(column.sort_option)) {
                        issues.push({
                            path: `${columnPath}.sort_option`,
                            message: 'must reference a configured sort option',
                        });
                    }
                }
            });
        }
    } else if (display.type === 'cards') {
        addResultFieldIssues(issues, display.title, `${path}.title`);
        if (display.description !== undefined) {
            addResultFieldIssues(issues, display.description, `${path}.description`);
        }
        addMediaIssues(issues, display.media, `${path}.media`);
        addResultFieldArrayIssues(issues, display.fields, `${path}.fields`);
        addResultFieldArrayIssues(issues, display.badges, `${path}.badges`);
        addNumberEnumIssue(issues, display.columns, `${path}.columns`, [2, 3, 4, 5, 6]);
    } else if (display.type === 'gallery') {
        addMediaIssues(issues, display.media, `${path}.media`, true);
        addResultFieldIssues(issues, display.title, `${path}.title`);
        addResultFieldArrayIssues(issues, display.caption, `${path}.caption`);
        addNumberEnumIssue(issues, display.columns, `${path}.columns`, [2, 3, 4, 5, 6]);
    } else if (display.type === 'board') {
        addFieldIssue(issues, display.group_by, `${path}.group_by`);
        if (display.card === undefined || !isRecord(display.card)) {
            issues.push({ path: `${path}.card`, message: 'must be an object' });
        } else {
            addResultFieldIssues(issues, display.card.title, `${path}.card.title`);
            if (display.card.description !== undefined) {
                addResultFieldIssues(issues, display.card.description, `${path}.card.description`);
            }
            addMediaIssues(issues, display.card.media, `${path}.card.media`);
            addResultFieldArrayIssues(issues, display.card.fields, `${path}.card.fields`);
            addResultFieldArrayIssues(issues, display.card.badges, `${path}.card.badges`);
        }
    }
    return typeof display.id === 'string' ? display.id : undefined;
}

function addResultsIssues(issues: ViewValidationIssue[], value: unknown): void {
    if (value === undefined) {
        return;
    }
    if (!isRecord(value)) {
        issues.push({ path: 'results', message: 'must be an object' });
        return;
    }
    addConfigurationIdIssue(issues, value.default_display, 'results.default_display');
    addBooleanIssue(issues, value.allow_display_switch, 'results.allow_display_switch');

    const sortOptionIds = new Set<string>();
    if (value.sort_options !== undefined) {
        if (!Array.isArray(value.sort_options)) {
            issues.push({ path: 'results.sort_options', message: 'must be an array' });
        } else {
            value.sort_options.forEach((rawOption, index) => {
                const path = `results.sort_options[${index}]`;
                if (!isRecord(rawOption)) {
                    issues.push({ path, message: 'must be an object' });
                    return;
                }
                addConfigurationIdIssue(issues, rawOption.id, `${path}.id`);
                addStringIssue(issues, rawOption.label, `${path}.label`, { required: true, maxLength: 120 });
                if (!Array.isArray(rawOption.sort) || rawOption.sort.length === 0) {
                    issues.push({ path: `${path}.sort`, message: 'must contain at least one sort clause' });
                } else {
                    rawOption.sort.forEach((rawClause, clauseIndex) => {
                        const clausePath = `${path}.sort[${clauseIndex}]`;
                        if (!isRecord(rawClause)) {
                            issues.push({ path: clausePath, message: 'must be an object' });
                            return;
                        }
                        addFieldIssue(issues, rawClause.field, `${clausePath}.field`);
                        addEnumIssue(issues, rawClause.order, `${clausePath}.order`, ['asc', 'desc']);
                    });
                }
                if (typeof rawOption.id === 'string') {
                    if (sortOptionIds.has(rawOption.id)) {
                        issues.push({ path: `${path}.id`, message: 'must be unique' });
                    }
                    sortOptionIds.add(rawOption.id);
                }
            });
        }
    }

    if (value.default_sort !== undefined) {
        addConfigurationIdIssue(issues, value.default_sort, 'results.default_sort');
        if (typeof value.default_sort === 'string' && !sortOptionIds.has(value.default_sort)) {
            issues.push({ path: 'results.default_sort', message: 'must reference a configured sort option' });
        }
    }

    if (!Array.isArray(value.displays) || value.displays.length === 0) {
        issues.push({ path: 'results.displays', message: 'must contain at least one display' });
        return;
    }
    if (value.displays.length > 10) {
        issues.push({ path: 'results.displays', message: 'must contain at most 10 displays' });
    }
    const displayIds = new Set<string>();
    value.displays.forEach((display, index) => {
        const id = addDisplayIssues(issues, display, index, sortOptionIds);
        if (id) {
            if (displayIds.has(id)) {
                issues.push({ path: `results.displays[${index}].id`, message: 'must be unique' });
            }
            displayIds.add(id);
        }
    });
    if (typeof value.default_display === 'string' && !displayIds.has(value.default_display)) {
        issues.push({ path: 'results.default_display', message: 'must reference a configured display' });
    }
}

export function validateViewExperienceId(value: unknown): ViewValidationIssue[] {
    const issues: ViewValidationIssue[] = [];
    addStringIssue(issues, value, 'id', { required: true, maxLength: 64 });
    if (typeof value === 'string' && !EXPERIENCE_ID_PATTERN.test(value)) {
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

export function validateViewExperienceConfiguration(value: unknown): ViewValidationIssue[] {
    const issues: ViewValidationIssue[] = [];
    if (!isRecord(value)) {
        return [{ path: '', message: 'must be an object' }];
    }
    const configuration = value as unknown as ViewExperienceConfiguration;
    addStringIssue(issues, configuration.name, 'name', { required: true, maxLength: 120 });
    addStringIssue(issues, configuration.description, 'description', { maxLength: 4_000 });
    addBooleanIssue(issues, configuration.enabled, 'enabled');
    if (configuration.layout !== undefined) {
        if (!isRecord(configuration.layout)) {
            issues.push({ path: 'layout', message: 'must be an object' });
        } else {
            addEnumIssue(issues, configuration.layout.mode, 'layout.mode', ['browse', 'worklist']);
            addEnumIssue(issues, configuration.layout.navigation_position, 'layout.navigation_position', [
                'sidebar',
                'top',
                'drawer',
            ]);
        }
    }
    if (configuration.scope !== undefined) {
        if (!isRecord(configuration.scope)) {
            issues.push({ path: 'scope', message: 'must be an object' });
        } else {
            addStringArrayIssues(issues, configuration.scope.type_ids, 'scope.type_ids', { maxItems: 100 });
            addStringArrayIssues(issues, configuration.scope.locations, 'scope.locations', {
                maxItems: 100,
                pathValues: true,
            });
            addStringArrayIssues(issues, configuration.scope.collection_ids, 'scope.collection_ids', {
                maxItems: 100,
            });
            addBooleanIssue(
                issues,
                configuration.scope.include_collection_descendants,
                'scope.include_collection_descendants',
            );
            addBooleanIssue(issues, configuration.scope.head_only, 'scope.head_only');
            if (configuration.scope.fixed_filter !== undefined) {
                issues.push(...validateSupportedViewQuery(configuration.scope.fixed_filter, 'scope.fixed_filter'));
            }
        }
    }
    addNavigationIssues(issues, configuration.navigation);
    addSearchIssues(issues, configuration.search);
    addResultsIssues(issues, configuration.results);
    return issues;
}

/**
 * Validate the additional documentation contract for project-scoped persisted
 * Views without imposing it on inline or app-contributed View definitions.
 */
export function validatePersistedViewExperienceConfiguration(value: unknown): ViewValidationIssue[] {
    const issues = validateViewExperienceConfiguration(value);
    if (isRecord(value) && (typeof value.description !== 'string' || value.description.trim().length === 0)) {
        issues.push({
            path: 'description',
            message: 'is required and must explain the View purpose',
        });
    }
    return issues;
}
