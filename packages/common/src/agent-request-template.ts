function isRecordValue(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getTemplatePathValue(data: unknown, path: string): unknown {
    if (path === '.' || path === 'json') return data;

    return path.split('.').reduce<unknown>((current, part) => {
        if (Array.isArray(current) && /^\d+$/.test(part)) return current[Number(part)];
        if (!isRecordValue(current)) return undefined;
        return current[part];
    }, data);
}

function stringifyTemplateValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

export function renderAgentRequestTemplate(template: string, data: unknown): string {
    return template.replace(/\{\{\s*([\w.-]+|\.)\s*\}\}/g, (_match, path: string) => (
        stringifyTemplateValue(getTemplatePathValue(data, path))
    ));
}

export function renderAgentRequestFallback(data: unknown): string {
    if (typeof data === 'string') return data;
    if (data === null || data === undefined) return '';
    return stringifyTemplateValue(data);
}

export function renderAgentRequestMessage(template: string | undefined, data: unknown): string {
    const trimmedTemplate = template?.trim();
    if (!trimmedTemplate) return renderAgentRequestFallback(data);

    const rendered = renderAgentRequestTemplate(trimmedTemplate, data).trim();
    return rendered || renderAgentRequestFallback(data);
}
