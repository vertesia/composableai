import { describe, expect, it } from 'vitest';
import type { ConfigResult } from './server/index.js';
import { signInWarnings } from './sign-in-warnings.js';

function token(payload: Record<string, unknown>): string {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${encode({ alg: 'none' })}.${encode(payload)}.`;
}

function result(overrides: Partial<ConfigResult>): ConfigResult {
    return {
        profile: 'agents',
        account: 'account-1',
        project: 'project-1',
        studio_server_url: 'https://api.example.test',
        zeno_server_url: 'https://store.example.test',
        oauth_server_url: 'https://sts.example.test',
        token: token({ scope: 'openid profile offline_access app:manage content:read' }),
        refresh_token: 'refresh-1',
        ...overrides,
    } as ConfigResult;
}

describe('signInWarnings', () => {
    it('stays quiet for a sign-in that can renew and holds permissions', () => {
        expect(signInWarnings(result({}))).toEqual([]);
    });

    it('says how to stay signed in when "Renew access" was not ticked', () => {
        const [warning] = signInWarnings(result({ refresh_token: undefined }));
        expect(warning).toContain('profile "agents" signs out when its access token expires');
        expect(warning).toContain('tick "Renew access"');
    });

    it('says why commands will fail when no permission was ticked', () => {
        // The server adds account:member to every grant, so it alone still means nothing was ticked.
        const warnings = signInWarnings(
            result({ token: token({ scope: 'openid profile offline_access account:member' }) }),
        );
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('granted no platform permissions');
    });

    it('ignores legacy sign-ins, which have neither renewal nor scopes', () => {
        expect(
            signInWarnings(result({ oauth_server_url: undefined, refresh_token: undefined, token: token({}) })),
        ).toEqual([]);
    });
});
