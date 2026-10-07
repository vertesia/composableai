import { SelectedContextBlocksSchema } from '@llumiverse/conversation/schemas';
import { Ajv } from 'ajv';
import { expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { buildApiSchemaComponents } from './api-schemas/registry.js';
import type { ConversationSelectedContextBlocks } from './index.js';

it('exports the transitive partial-selection receipt map with the authoritative inferred type', () => {
    expectTypeOf<ConversationSelectedContextBlocks>().toEqualTypeOf<z.infer<typeof SelectedContextBlocksSchema>>();
    expect(SelectedContextBlocksSchema.meta()?.id).toBe('ConversationSelectedContextBlocks');
    const components = buildApiSchemaComponents();
    expect(components.ConversationContextChangeOperation).toHaveProperty(
        'properties.selected_block_ids.$ref',
        '#/components/schemas/ConversationSelectedContextBlocks',
    );
    const ajv = new Ajv({ strict: false });
    const validate = ajv.compile({
        $ref: '#/components/schemas/ConversationSelectedContextBlocks',
        components: { schemas: components },
    });
    for (const [value, accepted] of [
        [{ 'entry:first': ['block:first', 'block:second'] }, true],
        [{ 'entry:first': [] }, false],
        [{ 'entry:first': 'block:first' }, false],
        [{ 'entry:first': [''] }, false],
    ] as const) {
        expect(SelectedContextBlocksSchema.safeParse(value).success).toBe(accepted);
        expect(validate(value)).toBe(accepted);
    }
});
