import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import type {
    AgentTokenRequest,
    ApiKeyTokenRequest,
    EnvironmentTokenRequest,
    IssueTokenForbiddenResponse,
    IssueTokenRequest,
    IssueTokenResponse,
    ProjectTokenRequest,
    ServiceAccountTokenRequest,
    SigningAlgorithm,
    UserTokenRequest,
} from '../sts-token-types.js';
import { validateApiRequest, validateApiResponse } from './registry.js';
import type {
    AgentTokenRequestSchema,
    ApiKeyTokenRequestSchema,
    EnvironmentTokenRequestSchema,
    IssueTokenForbiddenResponseSchema,
    IssueTokenRequestSchema,
    IssueTokenResponseSchema,
    ProjectTokenRequestSchema,
    ServiceAccountTokenRequestSchema,
    SigningAlgorithmSchema,
    UserTokenRequestSchema,
} from './sts.js';

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function assertType<T extends true>(_value: T): void {}

describe('STS canonical contracts', () => {
    it('derives every public component type from its schema', () => {
        assertType<Equals<SigningAlgorithm, z.infer<typeof SigningAlgorithmSchema>>>(true);
        assertType<Equals<ApiKeyTokenRequest, z.infer<typeof ApiKeyTokenRequestSchema>>>(true);
        assertType<Equals<UserTokenRequest, z.infer<typeof UserTokenRequestSchema>>>(true);
        assertType<Equals<ProjectTokenRequest, z.infer<typeof ProjectTokenRequestSchema>>>(true);
        assertType<Equals<EnvironmentTokenRequest, z.infer<typeof EnvironmentTokenRequestSchema>>>(true);
        assertType<Equals<AgentTokenRequest, z.infer<typeof AgentTokenRequestSchema>>>(true);
        assertType<Equals<ServiceAccountTokenRequest, z.infer<typeof ServiceAccountTokenRequestSchema>>>(true);
        assertType<Equals<IssueTokenRequest, z.infer<typeof IssueTokenRequestSchema>>>(true);
        assertType<Equals<IssueTokenResponse, z.infer<typeof IssueTokenResponseSchema>>>(true);
        assertType<Equals<IssueTokenForbiddenResponse, z.infer<typeof IssueTokenForbiddenResponseSchema>>>(true);
        expect(true).toBe(true);
    });

    it('enforces the discriminated request branch and closed object policy', () => {
        expect(
            validateApiRequest('IssueTokenRequest', {
                type: 'project',
                account_id: 'acc_1',
                project_id: 'proj_1',
            }).valid,
        ).toBe(true);
        expect(
            validateApiRequest('IssueTokenRequest', {
                type: 'project',
                account_id: 'acc_1',
                project_id: 'proj_1',
                key: 'not-valid-on-this-branch',
            }).valid,
        ).toBe(false);
        expect(validateApiRequest('IssueTokenRequest', { type: 'project', account_id: 'acc_1' }).valid).toBe(false);
    });

    it('bounds the lifetime an agent token request may ask for', () => {
        const agent = { type: 'agent', account_id: 'acc_1', project_id: 'proj_1', on_behalf_of: 'user:u_1' };
        expect(validateApiRequest('IssueTokenRequest', agent).valid).toBe(true);
        for (const ttl_seconds of [60, 660, 3600]) {
            expect(validateApiRequest('IssueTokenRequest', { ...agent, ttl_seconds }).valid).toBe(true);
        }
        for (const ttl_seconds of [0, 59, 3601, 90.5, '120']) {
            expect(validateApiRequest('IssueTokenRequest', { ...agent, ttl_seconds }).valid).toBe(false);
        }
        // Only the agent branch takes a lifetime.
        expect(
            validateApiRequest('IssueTokenRequest', {
                type: 'project',
                account_id: 'acc_1',
                project_id: 'proj_1',
                ttl_seconds: 120,
            }).valid,
        ).toBe(false);
    });

    it('checks every documented response shape and forbidden error-code literal', () => {
        expect(validateApiResponse('IssueTokenResponse', { token: 'signed', token_type: 'Bearer' }).valid).toBe(true);
        expect(validateApiResponse('IssueTokenResponse', { token: 'signed', token_type: 'bearer' }).valid).toBe(false);
        for (const errorCode of [
            'requested_scope_unavailable',
            'no_accessible_account',
            'restricted_environment',
            'token_issuance_forbidden',
        ]) {
            expect(
                validateApiResponse('IssueTokenForbiddenResponse', {
                    error: 'Forbidden',
                    message: 'The requested scope is unavailable',
                    errorCode,
                }).valid,
            ).toBe(true);
        }
        expect(
            validateApiResponse('IssueTokenForbiddenResponse', {
                error: 'Forbidden',
                message: 'No',
                errorCode: 'resource_not_found',
            }).valid,
        ).toBe(false);
        expect(
            validateApiResponse('IssueTokenForbiddenResponse', {
                error: 'Forbidden',
                message: 'No',
                errorCode: 'requested_scope_unavailable',
                project_id: 'secret',
            }).valid,
        ).toBe(false);
        expect(
            validateApiResponse('IssueTokenUnavailableResponse', {
                error: 'Service Unavailable',
                message: 'Token signing temporarily unavailable',
            }).valid,
        ).toBe(true);
        expect(
            validateApiResponse('IssueTokenUnavailableResponse', {
                error: 'Service Unavailable',
                message: 'Token signing temporarily unavailable',
                retry_after: 5,
            }).valid,
        ).toBe(false);
    });
});
