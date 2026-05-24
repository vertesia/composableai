/**
 * Type augmentation for `vitest-axe` matchers under modern Vitest.
 *
 * `vitest-axe@0.1.0` was published against Vitest 0.x and augments the now-deprecated
 * `Vi.Assertion` namespace. Vitest 4 declares its matchers on the `Assertion` /
 * `AsymmetricMatchersContaining` interfaces exported from the `vitest` module, so the
 * upstream augmentation doesn't reach the editor's TypeScript service. The matchers
 * themselves work at runtime (registered via `expect.extend(matchers)` in `setup.ts`);
 * this file just re-declares them on the interfaces the editor actually looks at.
 *
 * Scoped to the __tests__/ directory; not shipped (the package's tsconfig excludes
 * __tests__/**, and this file is .d.ts-only).
 */
import 'vitest';
import type { AxeMatchers } from 'vitest-axe';

declare module 'vitest' {
    interface Assertion<T = unknown> extends AxeMatchers {}
    interface AsymmetricMatchersContaining extends AxeMatchers {}
}
