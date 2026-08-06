import { assertType, describe, it } from 'vitest';
import type { z } from 'zod';
import type { ViewExperienceConfiguration } from '../views.js';
import type { ViewExperienceConfigurationSchema } from './view-execution.js';

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/**
 * Lives here rather than next to the JSON Schema artifact in `@dglabs/platform-types`: both subjects
 * are declarations of THIS package — the public TypeScript type and the Zod schema it must mirror —
 * and asserting it from the studio-side package would have made that package depend on Zod, which it
 * must not, because composable-ui loads it in the browser.
 */
describe('ViewExperienceConfiguration', () => {
    it('keeps the temporary named TypeScript bridge identical to the runtime schema', () => {
        assertType<Equals<ViewExperienceConfiguration, z.infer<typeof ViewExperienceConfigurationSchema>>>(true);
    });
});
