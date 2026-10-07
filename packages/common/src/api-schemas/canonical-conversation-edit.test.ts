import {
    AcceptedToolSelectionSchema,
    type ConversationEditAnchorSchema,
    ConversationEditOperationSchema,
    type ConversationEditPlacementSchema,
    type ConversationEditRecordRefSchema,
} from '@llumiverse/conversation/schemas';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { ApiSchemaComponents } from '../api-contract/index.js';
import type {
    ConversationAcceptedToolSelection,
    ConversationEditAnchor,
    ConversationEditOperation,
    ConversationEditPlacement,
    ConversationEditRecordRef,
} from '../canonical-conversation.js';
import { CANONICAL_CONVERSATION_SCHEMAS } from './canonical-conversation.js';

describe('published canonical edit receipt closure', () => {
    it('keeps each public type and registered schema identical to the core contract', () => {
        expectTypeOf<ConversationAcceptedToolSelection>().toEqualTypeOf<z.infer<typeof AcceptedToolSelectionSchema>>();
        expectTypeOf<ConversationEditAnchor>().toEqualTypeOf<z.infer<typeof ConversationEditAnchorSchema>>();
        expectTypeOf<ConversationEditOperation>().toEqualTypeOf<z.infer<typeof ConversationEditOperationSchema>>();
        expectTypeOf<ConversationEditPlacement>().toEqualTypeOf<z.infer<typeof ConversationEditPlacementSchema>>();
        expectTypeOf<ConversationEditRecordRef>().toEqualTypeOf<z.infer<typeof ConversationEditRecordRefSchema>>();
        expect(CANONICAL_CONVERSATION_SCHEMAS.ConversationAcceptedToolSelection).toBe(AcceptedToolSelectionSchema);
        expect(CANONICAL_CONVERSATION_SCHEMAS.ConversationEditOperation).toBe(ConversationEditOperationSchema);
    });

    it('publishes strict named components for receipt dependencies', () => {
        for (const name of [
            'ConversationAcceptedToolSelection',
            'ConversationEditAnchor',
            'ConversationEditOperation',
            'ConversationEditPlacement',
            'ConversationEditRecordRef',
        ]) {
            expect(ApiSchemaComponents[name as keyof typeof ApiSchemaComponents]).toBeDefined();
        }
    });
});
