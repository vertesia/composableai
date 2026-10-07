import { ContextChangeOperationSchema, ContextChangePlacementSchema } from '@llumiverse/conversation/schemas';
import { Ajv } from 'ajv';
import { expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { buildApiSchemaComponents } from './api-schemas/registry.js';
import type { ConversationContextChangeOperation, ConversationContextChangePlacement } from './index.js';

it('names transitive context-change receipt components at the public root with inferred types', () => {
    expectTypeOf<ConversationContextChangeOperation>().toEqualTypeOf<z.infer<typeof ContextChangeOperationSchema>>();
    expectTypeOf<ConversationContextChangePlacement>().toEqualTypeOf<z.infer<typeof ContextChangePlacementSchema>>();
    expect(ContextChangeOperationSchema.meta()?.id).toBe('ConversationContextChangeOperation');
    expect(ContextChangePlacementSchema.meta()?.id).toBe('ConversationContextChangePlacement');
});

it('registers the receipt closure with strict operation and placement objects', () => {
    const components = buildApiSchemaComponents();
    const operation = components.ConversationContextChangeOperation;
    const placement = components.ConversationContextChangePlacement;
    expect(operation).toHaveProperty('additionalProperties', false);
    expect(placement).toHaveProperty('additionalProperties', false);
    expect(components.ConversationOperationReceipt).toHaveProperty(
        'properties.context_change.$ref',
        '#/components/schemas/ConversationContextChangeOperation',
    );
    expect(operation).toHaveProperty(
        'properties.placement.$ref',
        '#/components/schemas/ConversationContextChangePlacement',
    );
    const ajv = new Ajv({ strict: false });
    const validate = ajv.compile({ ...placement });
    const valid = { mode: 'first_selected', causal_order: 'contiguous' };
    expect(validate(valid)).toBe(true);
    expect(validate({ ...valid, unreviewed_policy: true })).toBe(false);
    expect(validate({ ...valid, causal_order: 'implicit' })).toBe(false);
});
