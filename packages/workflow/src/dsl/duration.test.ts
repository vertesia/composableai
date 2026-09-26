import type { DurationValue } from '@vertesia/common';
import type { StringValue } from 'ms';
import { describe, expectTypeOf, it } from 'vitest';

describe('DurationValue', () => {
    it('carries exactly the duration strings ms() accepts', () => {
        // `@vertesia/common` declares the string half itself instead of depending on `ms`; this is where the
        // two meet, so a drift between them fails `typecheck:test` here.
        expectTypeOf<Exclude<DurationValue, number>>().toEqualTypeOf<StringValue>();
    });
});
