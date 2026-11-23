import { Command } from 'commander';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { registerSharePointOnboardingCommand } from './index.js';

const getClient = vi.hoisted(() => vi.fn());
vi.mock('../client.js', () => ({ getClient }));

const api = {
    beginOrganizationLink: vi.fn(),
    listOrganizations: vi.fn(),
    listLibraryRequests: vi.fn(),
    resolveRequestProject: vi.fn(),
};

async function run(...args: string[]) {
    const program = new Command().exitOverride();
    registerSharePointOnboardingCommand(program);
    await program.parseAsync(['sharepoint-onboarding', ...args], { from: 'user' });
}

beforeEach(() => {
    getClient.mockResolvedValue({ sharepointOnboarding: api });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
});

it('uses the selected Vertesia account to list links and begin a Microsoft organization authorization', async () => {
    await run('list-organizations');
    await run('begin-organization-link', 'c1819196-2d83-441f-ab5d-814604361b1d');
    expect(api.listOrganizations).toHaveBeenCalledOnce();
    expect(api.beginOrganizationLink).toHaveBeenCalledWith({ tenant_id: 'c1819196-2d83-441f-ab5d-814604361b1d' });
});

it('uses the service cursor and resolves a receipt through project authorization', async () => {
    await run('list-requests', '--cursor', '012345678901234567890123');
    await run('open-request', '123456789012345678901234');
    expect(api.listLibraryRequests).toHaveBeenCalledWith({ cursor: '012345678901234567890123' });
    expect(api.resolveRequestProject).toHaveBeenCalledWith('123456789012345678901234');
});
