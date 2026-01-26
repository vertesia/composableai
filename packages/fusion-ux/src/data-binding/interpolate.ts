/**
 * String Interpolation for Data Bindings
 *
 * Handles {{key}} and {{key.nested.path}} interpolation in strings and objects.
 */

/**
 * Pattern for matching interpolation expressions: {{key}} or {{key.path}}
 */
const INTERPOLATION_PATTERN = /\{\{([^}]+)\}\}/g;

/**
 * Get a nested value from an object using dot notation.
 *
 * @param obj - Object to get value from
 * @param path - Dot-separated path (e.g., 'route.customerId' or 'user.profile.name')
 * @returns The value at the path, or undefined if not found
 *
 * @example
 * ```ts
 * getNestedValue({ user: { name: 'John' } }, 'user.name') // 'John'
 * getNestedValue({ items: [{ id: 1 }] }, 'items.0.id') // 1
 * ```
 */
export function getNestedValue(obj: unknown, path: string): unknown {
    if (obj === null || obj === undefined) {
        return undefined;
    }

    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
        if (current === null || current === undefined) {
            return undefined;
        }

        if (typeof current === 'object') {
            current = (current as Record<string, unknown>)[part];
        } else {
            return undefined;
        }
    }

    return current;
}

/**
 * Check if a string contains interpolation expressions.
 */
export function hasInterpolation(str: string): boolean {
    return INTERPOLATION_PATTERN.test(str);
}

/**
 * Interpolate a string, replacing {{key}} with values from context.
 *
 * @param template - String with {{key}} placeholders
 * @param context - Object containing values to interpolate
 * @returns Interpolated string
 *
 * @example
 * ```ts
 * interpolateString('Hello {{user.name}}!', { user: { name: 'John' } })
 * // 'Hello John!'
 *
 * interpolateString('/api/customers/{{route.id}}', { route: { id: '123' } })
 * // '/api/customers/123'
 * ```
 */
export function interpolateString(template: string, context: Record<string, unknown>): string {
    return template.replace(INTERPOLATION_PATTERN, (match, path) => {
        const value = getNestedValue(context, path.trim());

        if (value === undefined || value === null) {
            // Keep the original placeholder if value not found
            return match;
        }

        // Convert to string
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }

        return String(value);
    });
}

/**
 * Interpolate all string values in an object recursively.
 *
 * @param obj - Object with string values containing {{key}} placeholders
 * @param context - Object containing values to interpolate
 * @returns New object with interpolated values
 *
 * @example
 * ```ts
 * interpolateObject(
 *   { filter: { customerId: '{{route.id}}' }, limit: 10 },
 *   { route: { id: '123' } }
 * )
 * // { filter: { customerId: '123' }, limit: 10 }
 * ```
 */
export function interpolateObject<T>(obj: T, context: Record<string, unknown>): T {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'string') {
        return interpolateString(obj, context) as T;
    }

    if (Array.isArray(obj)) {
        return obj.map((item) => interpolateObject(item, context)) as T;
    }

    if (typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = interpolateObject(value, context);
        }
        return result as T;
    }

    return obj;
}

/**
 * Extract all interpolation keys from a string or object.
 *
 * @param value - String or object to extract keys from
 * @returns Array of unique keys found
 *
 * @example
 * ```ts
 * extractInterpolationKeys('{{route.id}} and {{user.name}}')
 * // ['route.id', 'user.name']
 * ```
 */
export function extractInterpolationKeys(value: unknown): string[] {
    const keys = new Set<string>();

    function extract(v: unknown) {
        if (typeof v === 'string') {
            let match;
            const pattern = new RegExp(INTERPOLATION_PATTERN.source, 'g');
            while ((match = pattern.exec(v)) !== null) {
                keys.add(match[1].trim());
            }
        } else if (Array.isArray(v)) {
            v.forEach(extract);
        } else if (v !== null && typeof v === 'object') {
            Object.values(v).forEach(extract);
        }
    }

    extract(value);
    return Array.from(keys);
}

/**
 * Check if all required interpolation keys are present in context.
 *
 * @param value - String or object with interpolation placeholders
 * @param context - Context object to check against
 * @returns Object with missing keys (empty if all present)
 */
export function validateInterpolationKeys(
    value: unknown,
    context: Record<string, unknown>
): { valid: boolean; missingKeys: string[] } {
    const keys = extractInterpolationKeys(value);
    const missingKeys = keys.filter((key) => getNestedValue(context, key) === undefined);

    return {
        valid: missingKeys.length === 0,
        missingKeys,
    };
}
