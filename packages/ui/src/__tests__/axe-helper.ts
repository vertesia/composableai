import type { AxeResults } from 'axe-core';
import { axe as baseAxe } from 'vitest-axe';

/**
 * Project-wide axe runner.
 *
 * Disables the `color-contrast` rule because axe needs `canvas.getContext()` to
 * sample rendered pixels, and jsdom doesn't implement canvas — running the rule
 * floods test output with unhandled `Not implemented: HTMLCanvasElement.prototype.getContext`
 * errors even though the assertion still succeeds via fallback. Color-token
 * contrast is covered separately by `contrast.test.ts`, which validates the
 * canonical foreground/background pairs with proper alpha compositing.
 *
 * Lives in a `.ts` file (not `.tsx`) to keep its module init free of React/JSX
 * resolution concerns.
 */
export function axe(container: Element | string): Promise<AxeResults> {
    return baseAxe(container, {
        rules: {
            'color-contrast': { enabled: false },
        },
    });
}
