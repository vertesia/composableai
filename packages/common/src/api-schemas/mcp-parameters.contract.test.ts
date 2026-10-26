import { describe, expect, it } from 'vitest';
import { type MCPToolCollectionObject, normalizeToolCollection } from '../apps.js';
import { validateApiRequest } from './registry.js';

const collection: MCPToolCollectionObject = {
    type: 'mcp',
    id: 'graph',
    name: 'Graph',
    description: 'Graph',
    namespace: 'graph',
    url: 'https://example.com/{{tenant}}/mcp',
    auth: 'none',
};

describe('MCP connection parameter wire contracts', () => {
    it('accepts public defaults and secret declarations', () => {
        expect(
            validateApiRequest('ToolCollectionObject', {
                ...collection,
                parameters: { tenant: { default: 'common' }, key: { type: 'secret', required: true } },
                headers: { 'X-Key': '{{key}}' },
            }).valid,
        ).toBe(true);
    });
    it('rejects secret defaults and unsupported parameter names in emitted schemas', () => {
        expect(
            validateApiRequest('ToolCollectionObject', {
                ...collection,
                parameters: { key: { type: 'secret', default: 'plaintext' } },
            }).valid,
        ).toBe(false);
        expect(
            validateApiRequest('ToolCollectionObject', { ...collection, parameters: { 'bad-name': { default: 'x' } } })
                .valid,
        ).toBe(false);
    });
    it('accepts omission, replacement and explicit clearing at install/update', () => {
        for (const mcp_parameters of [
            undefined,
            {},
            { graph: { tenant: 'one', key: 'secret' } },
            { graph: { key: null } },
        ]) {
            expect(validateApiRequest('AppInstallationPayload', { app_id: 'app', mcp_parameters }).valid).toBe(true);
        }
        expect(
            validateApiRequest('AppInstallationPayload', { app_id: 'app', mcp_parameters: { graph: { key: 123 } } })
                .valid,
        ).toBe(false);
    });
});

it('preserves declared parameters when their names match platform endpoints', () => {
    const normalized = normalizeToolCollection(
        {
            type: 'mcp',
            id: 'graph',
            name: 'Graph',
            description: 'Graph',
            namespace: 'graph',
            url: 'https://example.com/{{store}}/mcp',
            parameters: { store: { default: 'tenant' } },
        },
        { store: 'https://platform.example.com' },
    );
    expect(normalized.url).toBe('https://example.com/{{store}}/mcp');
});

describe('manifest-level MCP parameters', () => {
    const manifest = {
        name: 'shared-tools',
        title: 'Shared',
        description: 'Shared',
        publisher: 'Test',
        status: 'beta',
        visibility: 'private',
        tool_collections: [collection],
    };
    it('accepts shared declarations and rejects secret defaults and invalid names', () => {
        for (const component of ['AppManifestData', 'AppManifest'] as const) {
            const base =
                component === 'AppManifest'
                    ? {
                          ...manifest,
                          id: 'app',
                          edit_revision: 1,
                          created_at: '2026-10-16T00:00:00Z',
                          updated_at: '2026-10-16T00:00:00Z',
                      }
                    : manifest;
            expect(
                validateApiRequest(component, {
                    ...base,
                    parameters: { tenant: { default: 'common' }, key: { type: 'secret', required: true } },
                }).valid,
            ).toBe(true);
            expect(
                validateApiRequest(component, {
                    ...base,
                    parameters: { key: { type: 'secret', default: 'plaintext' } },
                }).valid,
            ).toBe(false);
            expect(validateApiRequest(component, { ...base, parameters: { 'bad-name': {} } }).valid).toBe(false);
        }
    });
    it('accepts shared omission, replacement and clearing while rejecting non-string values', () => {
        for (const mcp_shared_parameters of [undefined, {}, { tenant: 'one', key: 'private' }, { key: null }]) {
            expect(validateApiRequest('AppInstallationPayload', { app_id: 'app', mcp_shared_parameters }).valid).toBe(
                true,
            );
        }
        expect(
            validateApiRequest('AppInstallationPayload', { app_id: 'app', mcp_shared_parameters: { key: 123 } }).valid,
        ).toBe(false);
    });
    it('preserves shared parameter names that match endpoint aliases', () => {
        expect(normalizeToolCollection(collection, { store: 'https://platform.example.com' }, { store: {} }).url).toBe(
            collection.url,
        );
        expect(
            normalizeToolCollection(
                { ...collection, url: 'https://example.com/{{store}}/mcp' },
                { store: 'https://platform.example.com' },
                { store: {} },
            ).url,
        ).toBe('https://example.com/{{store}}/mcp');
    });
});
