import { describe, expect, it } from 'vitest';
import { SupportedProviders } from '../environment.js';
import { ApiSchemaComponents, validateApiRequest, validateApiResponse } from './registry.js';

/**
 * The environment contracts, pinned where converting them changed what the document says or where
 * the conversion had a choice to make.
 *
 * Thirty-six components, of which thirty-two re-emit byte-identically; what is asserted here is the
 * four that do not, the two provider vocabularies that have to stay in step, and the secret boundary
 * that is the reason the read and write shapes are separate objects.
 */

describe('the provider vocabulary', () => {
    /**
     * `SupportedProviders` is llumiverse's `Providers` merged with the three studio-only virtual
     * providers, and the schema reads its members off that merged object rather than restating them.
     * This is the assertion that it still does: a provider added on either side has to reach the
     * document without anyone editing a list, which is the whole reason `z.enum()` takes the object.
     */
    it('publishes every member of the merged provider object, in its order', () => {
        expect(enumOf('SupportedProviders')).toEqual(Object.values(SupportedProviders));
    });

    it('includes the studio-only virtual providers, which llumiverse does not know about', () => {
        expect(enumOf('SupportedProviders')).toEqual(
            expect.arrayContaining(['virtual_lb', 'virtual_mediator', 'test']),
        );
    });

    it('rejects a provider that is neither', () => {
        expect(validateApiRequest('ExecutionEnvironmentCreatePayload', { name: 'e', provider: 'openai' }).valid).toBe(
            true,
        );
        expect(
            validateApiRequest('ExecutionEnvironmentCreatePayload', { name: 'router', provider: 'openrouter' }).valid,
        ).toBe(true);
        expect(validateApiRequest('ExecutionEnvironmentCreatePayload', { name: 'e', provider: 'gpt' }).valid).toBe(
            false,
        );
    });
});

describe('the environment secret boundary', () => {
    it('accepts an API key on create', () => {
        expect(
            validateApiRequest('ExecutionEnvironmentCreatePayload', {
                name: 'vertex',
                provider: 'vertexai',
                apiKey: 'shhh',
            }),
        ).toMatchObject({ valid: true });
    });

    it('publishes apiKey on the read shape, because what comes back is the masked value', () => {
        // Unlike the OAuth providers, the read shape does NOT drop the field: `toEnvironmentResponse`
        // overwrites it with `apikey_hint` or a masked form of the key, so the property a caller reads
        // is a display hint rather than a credential. The response contract has to allow it, or every
        // environment read would fail its own check.
        const environment = {
            id: '68b1779130afe5403a1589ba',
            name: 'vertex',
            provider: 'vertexai',
            apiKey: 'AKIA...3xQf',
            apikey_hint: 'AKIA...3xQf',
            account: '69d4762f24d3048c99149d0b',
            created_by: 'u1',
            updated_by: 'u1',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
        };

        expect(validateApiResponse('ExecutionEnvironment', environment)).toMatchObject({ valid: true });
        expect(validateApiResponse('ExecutionEnvironment', { ...environment, secret: 'x' }).valid).toBe(false);
    });
});

describe('ExecutionEnvironmentSettings', () => {
    /**
     * The one component in this closure published OPEN. It carried an index signature, so a setting
     * for a provider this build has never heard of round-trips instead of being rejected — which is
     * what the settings bag is for, and the reason it is absent from `STRICT_COMPONENTS`.
     */
    it('accepts a setting it does not declare', () => {
        expect(
            validateApiRequest('ExecutionEnvironmentUpdatePayload', {
                settings: { bucket_access_principal: 'sa@p.iam', some_future_driver_flag: true },
            }),
        ).toMatchObject({ valid: true });
    });

    it('still rejects an undeclared property on the payload around it', () => {
        expect(validateApiRequest('ExecutionEnvironmentUpdatePayload', { setttings: {} }).valid).toBe(false);
    });
});

describe('the create and update payloads', () => {
    /**
     * They used to be `Omit<ExecutionEnvironment, ...>` and `Partial<Omit<...>>`. Both are stated
     * where they are named now, from one shared field list — so the assertion that matters is that
     * the two still describe the same fields, which the mapped types used to guarantee structurally.
     */
    it('describe the same fields, one requiring name and provider and the other requiring nothing', () => {
        expect(propertiesOf('ExecutionEnvironmentUpdatePayload')).toEqual(
            propertiesOf('ExecutionEnvironmentCreatePayload'),
        );
        expect(requiredOf('ExecutionEnvironmentCreatePayload')).toEqual(['name', 'provider']);
        expect(requiredOf('ExecutionEnvironmentUpdatePayload')).toEqual([]);
    });

    it('neither accepts a server-owned field', () => {
        // `id`, `account` and the audit fields are on the read shape only. A payload carrying one used
        // to be silently ignored; the write shapes not listing them is what makes it a 400.
        for (const field of ['id', 'account', 'created_by', 'created_at', 'apikey_hint']) {
            expect(
                validateApiRequest('ExecutionEnvironmentCreatePayload', { name: 'e', provider: 'test', [field]: 'x' })
                    .valid,
            ).toBe(false);
            expect(validateApiRequest('ExecutionEnvironmentUpdatePayload', { [field]: 'x' }).valid).toBe(false);
        }
    });

    it('accepts an empty update body', () => {
        expect(validateApiRequest('ExecutionEnvironmentUpdatePayload', {}).valid).toBe(true);
    });
});

describe('the model search query', () => {
    /**
     * `text` was published `required: true` and is optional now. The interface declared it
     * non-optional, but `EnvironmentsApi.listModels(id, payload?)` takes the payload optionally and
     * three existing call sites pass nothing — so enforcing the requirement the document stated would
     * have 400'd the UI on a parameter the server never wanted.
     */
    it('takes no required parameter', () => {
        // The scanner expands this component into four query parameters, and a property the component
        // does not require becomes a parameter the document does not require.
        expect(requiredOf('ModelSearchPayload')).toEqual([]);
        expect(validateApiRequest('ModelSearchPayload', {}).valid).toBe(true);
    });

    it('still rejects a value outside the model-type vocabulary', () => {
        expect(validateApiRequest('ModelSearchPayload', { type: 'text' }).valid).toBe(true);
        expect(validateApiRequest('ModelSearchPayload', { type: 'spreadsheet' }).valid).toBe(false);
    });
});

describe('the embeddings request', () => {
    it('discriminates its four input shapes on type', () => {
        expect(ApiSchemaComponents.EmbeddingsApiInput).toMatchObject({
            discriminator: {
                propertyName: 'type',
                mapping: { text: expect.stringContaining('EmbeddingsApiTextInput') },
            },
        });
    });

    it('accepts a text input and refuses one carrying an image source', () => {
        const request = (input: unknown) => validateApiRequest('EmbeddingsApiRequest', { inputs: [input] });

        expect(request({ type: 'text', text: 'hello' })).toMatchObject({ valid: true });
        expect(request({ type: 'text', text: 'hello', source: { url: 'gs://b/o' } }).valid).toBe(false);
        expect(request({ type: 'image', source: { url: 'gs://b/o' } })).toMatchObject({ valid: true });
    });

    it('accepts an empty inputs array, which the handler rejects rather than the schema', () => {
        // `minItems` is deliberately not published: an empty batch is well-formed and useless, and
        // adding the constraint would newly reject a request the document has always described.
        expect(validateApiRequest('EmbeddingsApiRequest', { inputs: [] }).valid).toBe(true);
    });

    it('accepts the logical project embedding type and rejects unknown types', () => {
        expect(
            validateApiRequest('EmbeddingsApiRequest', {
                embedding_type: 'properties',
                inputs: [{ type: 'text', text: '{}' }],
            }).valid,
        ).toBe(true);
        expect(
            validateApiRequest('EmbeddingsApiRequest', {
                embedding_type: 'audio',
                inputs: [{ type: 'audio', source: { url: 'gs://b/o' } }],
            }).valid,
        ).toBe(false);
    });
});

function enumOf(component: 'SupportedProviders'): string[] {
    const emitted = ApiSchemaComponents[component] as { enum?: unknown };
    if (!Array.isArray(emitted?.enum)) throw new Error(`${component} is not published as an enum`);
    return emitted.enum as string[];
}

function propertiesOf(component: string): string[] {
    const emitted = ApiSchemaComponents[component] as { properties?: Record<string, unknown> };
    return Object.keys(emitted?.properties ?? {});
}

function requiredOf(component: string): string[] {
    const emitted = ApiSchemaComponents[component] as { required?: unknown };
    return Array.isArray(emitted?.required) ? (emitted.required as string[]) : [];
}
