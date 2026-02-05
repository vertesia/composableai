import type { vi as viTest } from 'vitest';

declare global {
    const vi: typeof viTest;
}

export {};
