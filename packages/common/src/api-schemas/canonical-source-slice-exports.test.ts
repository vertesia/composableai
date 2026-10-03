import * as Canonical from '@llumiverse/conversation/schemas';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import type {
    ConversationDerivedBlockLineage,
    ConversationDerivedBlockLineageGroup,
    ConversationEditOperationV1,
    ConversationJsonInverseMapping,
    ConversationJsonPointer,
    ConversationJsonSourceRegion,
    ConversationSliceEditOperation,
    ConversationSourceBlockSlice,
    ConversationTextCodePointRange,
} from '../index.js';
import { CANONICAL_CONVERSATION_SCHEMAS as schemas } from './canonical-conversation.js';

function identity<T>(value: T): T {
    return value;
}

// Both registry and SDK aliases retain the canonical schema's exact inferred shape.
const publishedAliases = {
    ConversationEditOperationV1: identity<ConversationEditOperationV1>,
    ConversationSliceEditOperation: identity<ConversationSliceEditOperation>,
    ConversationSourceBlockSlice: identity<ConversationSourceBlockSlice>,
    ConversationJsonSourceRegion: identity<ConversationJsonSourceRegion>,
    ConversationJsonInverseMapping: identity<ConversationJsonInverseMapping>,
    ConversationDerivedBlockLineageGroup: identity<ConversationDerivedBlockLineageGroup>,
    ConversationDerivedBlockLineage: identity<ConversationDerivedBlockLineage>,
    ConversationTextCodePointRange: identity<ConversationTextCodePointRange>,
    ConversationJsonPointer: identity<ConversationJsonPointer>,
} satisfies {
    ConversationEditOperationV1: (
        value: z.infer<typeof schemas.ConversationEditOperationV1>,
    ) => z.infer<typeof Canonical.ConversationEditOperationV1Schema>;
    ConversationSliceEditOperation: (
        value: z.infer<typeof schemas.ConversationSliceEditOperation>,
    ) => z.infer<typeof Canonical.ConversationSliceEditOperationSchema>;
    ConversationSourceBlockSlice: (
        value: z.infer<typeof schemas.ConversationSourceBlockSlice>,
    ) => z.infer<typeof Canonical.SourceBlockSliceSchema>;
    ConversationJsonSourceRegion: (
        value: z.infer<typeof schemas.ConversationJsonSourceRegion>,
    ) => z.infer<typeof Canonical.JsonSourceRegionSchema>;
    ConversationJsonInverseMapping: (
        value: z.infer<typeof schemas.ConversationJsonInverseMapping>,
    ) => z.infer<typeof Canonical.JsonInverseMappingSchema>;
    ConversationDerivedBlockLineageGroup: (
        value: z.infer<typeof schemas.ConversationDerivedBlockLineageGroup>,
    ) => z.infer<typeof Canonical.DerivedBlockLineageGroupSchema>;
    ConversationDerivedBlockLineage: (
        value: z.infer<typeof schemas.ConversationDerivedBlockLineage>,
    ) => z.infer<typeof Canonical.DerivedBlockLineageSchema>;
    ConversationTextCodePointRange: (
        value: z.infer<typeof schemas.ConversationTextCodePointRange>,
    ) => z.infer<typeof Canonical.TextCodePointRangeSchema>;
    ConversationJsonPointer: (
        value: z.infer<typeof schemas.ConversationJsonPointer>,
    ) => z.infer<typeof Canonical.JsonPointerSchema>;
};

describe('published source slice component ownership', () => {
    it('registers exact authoritative schema instances and retains public inferred aliases', () => {
        expect(Object.keys(publishedAliases)).toHaveLength(9);
        expect(schemas.ConversationSourceBlockSlice).toBe(Canonical.SourceBlockSliceSchema);
        expect(schemas.ConversationSliceEditOperation).toBe(Canonical.ConversationSliceEditOperationSchema);
        expect(schemas.ConversationDerivedBlockLineage).toBe(Canonical.DerivedBlockLineageSchema);
    });
});
