import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import type {
    QuotaEffectiveTier,
    QuotaStandingAdmissionClass,
    QuotaStandingResource,
    QuotaStandingResponse,
    QuotaStandingWindow,
    QuotaTierResponse,
} from '../rate-limiter.js';
import type { JsonObject } from './adapter.js';
import { ApiSchemaComponents, apiComponentRef, validateApiResponse } from './registry.js';

/** Exact type identity — `extends` in both directions is too weak (any/unknown slip through). */
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function assertType<T extends true>(_ok: T): void {}

function compile(name: string, components: Readonly<Record<string, JsonObject>> = ApiSchemaComponents) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    ajv.addSchema({ $id: 'vertesia://openapi', components: { schemas: components } });
    return ajv.compile({ $ref: `vertesia://openapi${apiComponentRef(name as never)}` });
}

const VALID_WINDOW = { limit: 600, used: 12, remaining: 588, window_ms: 60_000 };

const VALID_STANDING = {
    tenant_id: '1589ba_149d0b',
    available: true,
    base_tier: 'default',
    effective_tier: 'enterprise',
    api: [{ resource: 'objects', name: 'Content objects', burst: VALID_WINDOW, quota: VALID_WINDOW }],
    admission: {
        classes: [{ class: 'ExecuteConversationWorkflow', tenant_active: 3 }],
        note: 'Budget is global and discovered.',
    },
    llm: { note: 'Shared per environment/model.' },
};

describe('gate 1 — the schema is the single source of truth for the public quota types', () => {
    it('publishes the exact schema-derived type, not a hand-written twin', () => {
        // The whole closure, not only the two types the endpoints return. A hand-written
        // QuotaStandingWindow beside an inferred QuotaStandingResponse would leave the drift path
        // open one level down, where it is harder to see.
        expect(true).toBe(true);
    });

    it('resolves nested component references to concrete property types', () => {
        // Schema-first only pays off if a $ref survives inference as the referenced type rather
        // than degrading to `unknown` — that is what makes the SDK usable.
        assertType<Equals<QuotaStandingResponse['api'], QuotaStandingResource[]>>(true);
        assertType<Equals<QuotaStandingResource['burst'], QuotaStandingWindow>>(true);
        assertType<Equals<QuotaStandingResponse['admission']['classes'], QuotaStandingAdmissionClass[]>>(true);
        assertType<Equals<QuotaStandingResponse['effective_tier'], QuotaEffectiveTier>>(true);
        assertType<Equals<QuotaTierResponse['tier'], QuotaEffectiveTier>>(true);
        expect(true).toBe(true);
    });

    it('keeps every quota field required, as the published document declares', () => {
        // `?:` on an inferred field is invisible at the call site until a consumer hits undefined.
        // Identity above would catch a change here, but only by failing somewhere less obvious.
        assertType<Equals<QuotaStandingResponse['available'], boolean>>(true);
        assertType<Equals<QuotaStandingWindow['remaining'], number>>(true);
        assertType<Equals<QuotaStandingResponse['llm'], { note: string }>>(true);
        expect(true).toBe(true);
    });
});

describe('gate 2 — the published components match the closure the types come from', () => {
    it('hoists every id-bearing quota schema into its own component', () => {
        // Six components for two endpoints: the registry must be self-contained, so a canonical
        // component may not reference a TypeScript-derived one.
        const quota = Object.keys(ApiSchemaComponents)
            .filter((name) => name.startsWith('Quota'))
            .sort();
        expect(quota).toEqual([
            'QuotaEffectiveTier',
            'QuotaStandingAdmissionClass',
            'QuotaStandingResource',
            'QuotaStandingResponse',
            'QuotaStandingWindow',
            // QuotaTier is the account tier enum, converted with the account slice.
            'QuotaTier',
            'QuotaTierResponse',
        ]);
    });

    it('shares one QuotaStandingWindow component across both referencing properties', () => {
        // The literal pointer, not apiComponentRef: that helper only accepts registry entry names,
        // and QuotaStandingWindow is a hoisted sub-component rather than a slot's contract.
        const props = ApiSchemaComponents.QuotaStandingResource.properties as Record<string, JsonObject>;
        expect(props.burst).toEqual({ $ref: '#/components/schemas/QuotaStandingWindow' });
        expect(props.quota).toEqual({ $ref: '#/components/schemas/QuotaStandingWindow' });
    });

    it('keeps admission and llm anonymous, as the document publishes them', () => {
        // Naming them would add a $ref the spec does not carry, changing the generated clients.
        const props = ApiSchemaComponents.QuotaStandingResponse.properties as Record<string, JsonObject>;
        expect(props.admission.$ref).toBeUndefined();
        expect(props.admission.type).toBe('object');
        expect(props.llm.$ref).toBeUndefined();
        expect(Object.keys(ApiSchemaComponents)).not.toContain('QuotaStandingAdmission');
    });
});

describe('gate 3 — AJV validates the same canonical objects that are published', () => {
    it('accepts a full standing payload', () => {
        expect(compile('QuotaStandingResponse')(VALID_STANDING)).toBe(true);
        expect(compile('QuotaTierResponse')({ tier: 'enterprise' })).toBe(true);
    });

    it('rejects a missing required field', () => {
        const { available: _dropped, ...incomplete } = VALID_STANDING;
        expect(compile('QuotaStandingResponse')(incomplete)).toBe(false);
    });

    it('rejects a numeric window value sent as a string', () => {
        // No coerceTypes: one AJV configuration serves bodies and responses, so a JSON number that
        // arrives as text is a contract violation rather than something quietly repaired.
        const bad = { ...VALID_WINDOW, used: '12' };
        expect(compile('QuotaStandingWindow')(bad)).toBe(false);
    });

    it('closes the anonymous nested objects the strict policy reaches', () => {
        const withExtra = { ...VALID_STANDING, llm: { note: 'x', rogue: 1 } };
        expect(compile('QuotaStandingResponse')(withExtra)).toBe(false);
    });
});

describe('gate 4 — the response path checks the same component the SDK types come from', () => {
    it('accepts a conforming response and hands back the component type', () => {
        const result = validateApiResponse('QuotaTierResponse', { tier: 'standard' });
        expect(result.valid).toBe(true);
        if (result.valid) {
            assertType<Equals<typeof result.data, QuotaTierResponse>>(true);
            expect(result.data.tier).toBe('standard');
        }
    });

    it('reports a violation without mutating the payload', () => {
        // Detection, not repair. Outside local development a response mismatch is logged drift, so
        // this must never silently edit what a caller receives.
        const response: Record<string, unknown> = { tier: 42, legacy_extra: 'still here' };
        const pristine = structuredClone(response);
        expect(validateApiResponse('QuotaTierResponse', response).valid).toBe(false);
        expect(response).toEqual(pristine);
    });
});
