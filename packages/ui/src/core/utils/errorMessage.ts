interface ErrorLike {
    message?: unknown;
}

function hasMessage(error: unknown): error is ErrorLike {
    return typeof error === 'object' && error !== null && 'message' in error;
}

export function errorMessage(error: unknown, fallback = 'An error occurred'): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (hasMessage(error) && typeof error.message === 'string') {
        return error.message;
    }
    return fallback;
}
