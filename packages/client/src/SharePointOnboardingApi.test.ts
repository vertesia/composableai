import { expect, it } from 'vitest';
import { VertesiaClient } from './client.js';

it('configures and removes the tenant reader using the organization resource', async () => {
    const tenant = 'c1819196-2d83-441f-ab5d-814604361b1d';
    const application = 'dd09df3f-6b22-454a-8b95-26793fd164d1';
    const organization = { tenant_id: tenant, linked_at: '2026-11-24T00:00:00.000Z' };
    const configured = {
        ...organization,
        reader: {
            client_id: application,
            issuer: 'https://sts.example.com',
            subject: 'sharepoint-reader:example',
            audience: 'api://AzureADTokenExchange',
        },
    };
    const client = new VertesiaClient({
        serverUrl: 'https://api.example.com',
        storeUrl: 'https://api.example.com',
        fetch: async (input, init) => {
            const request = new Request(input, init);
            expect(new URL(request.url).pathname).toBe(`/api/v1/sharepoint-onboarding/organization/${tenant}/reader`);
            if (request.method === 'PUT') {
                expect(await request.json()).toEqual({ client_id: application });
                return Response.json(configured);
            }
            expect(request.method).toBe('DELETE');
            expect(request.body).toBeNull();
            return Response.json(organization);
        },
    });
    expect(await client.sharepointOnboarding.configureOrganizationReader(tenant, { client_id: application })).toEqual(
        configured,
    );
    expect(await client.sharepointOnboarding.removeOrganizationReader(tenant)).toEqual(organization);
});
