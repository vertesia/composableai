export type CliOptions<T extends object = object> = Record<string, unknown> & T;

export function getStringOption(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function getBooleanOption(value: unknown): boolean {
    return value === true;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export function hasErrorCode(error: unknown, code: string): boolean {
    return isRecord(error) && error.code === code;
}

export function hasStatus(error: unknown, status: number): boolean {
    return isRecord(error) && error.status === status;
}
