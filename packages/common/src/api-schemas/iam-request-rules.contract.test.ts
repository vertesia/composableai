import { describe, expect, it } from 'vitest';
import { type ApiComponentName, validateApiRequest } from './registry.js';

// Rules the identity, credential and project endpoints enforce on a request, published so that a request the
// schema accepts is one the server accepts. Each table pins the accepted and refused bodies.
const id = '0123456789abcdef01234567';

const rules: Array<[ApiComponentName, string, Array<[string, unknown, boolean]>]> = [
    [
        'CreateApiKeyPayload',
        'gives a SCIM provisioning key the admin role and refuses NUL property names',
        [
            ['an admin SCIM key', { name: 'k', role: 'admin', scim_provisioning: true }, true],
            ['a member key', { name: 'k', role: 'member', scim_provisioning: false }, true],
            ['a custom-role SCIM key', { name: 'k', role: 'c:ops', scim_provisioning: true }, false],
            ['a property name', { name: 'k', role: 'member', properties: { team: 'a' } }, true],
            ['a NUL in a property name', { name: 'k', role: 'member', properties: { 'a\u0000': 1 } }, false],
            [
                'a NUL in a SCIM key property name',
                { name: 'k', role: 'admin', scim_provisioning: true, properties: { 'a\u0000': 1 } },
                false,
            ],
        ],
    ],
    [
        'UpdateApiKeyPayload',
        'publishes SCIM provisioning as a boolean (the server refuses false)',
        [
            ['enabling it', { scim_provisioning: true }, true],
            ['revoking it', { scim_provisioning: false }, true],
            ['a NUL in a property name', { properties: { 'a\u0000': 1 } }, false],
        ],
    ],
    [
        'ACECreatePayload',
        'names a project by its ID',
        [
            [
                'a project ID',
                { role: 'member', resource_type: 'project', resource: id, principal_type: 'user', principal: id },
                true,
            ],
            [
                'a project name',
                { role: 'member', resource_type: 'project', resource: 'genai', principal_type: 'user', principal: id },
                false,
            ],
            [
                'a resource set name',
                {
                    role: 'content:reader',
                    resource_type: 'content_set',
                    resource: 'finance',
                    principal_type: 'principal_set',
                    principal: 'auditors',
                },
                true,
            ],
        ],
    ],
    [
        'CreateOAuthClientPayload',
        'refuses a wildcard redirect URI',
        [
            ['an https redirect', { client_name: 'c', redirect_uris: ['https://app.example.com/cb'] }, true],
            ['a wildcard redirect', { client_name: 'c', redirect_uris: ['https://*.example.com/cb'] }, false],
        ],
    ],
    [
        'BulkRevokeOAuthGrantsPayload',
        'filters by ObjectIds',
        [
            ['a user ID', { user_id: id }, true],
            ['an empty user ID', { user_id: '' }, true],
            ['a user name', { user_id: 'lr' }, false],
            ['a project name', { project_id: 'genai' }, false],
        ],
    ],
    [
        'ICreateProjectPayload',
        'takes a namespace of letters, digits, -, _, [ and ]',
        [
            ['a namespace', { name: 'p', namespace: 'acme_prod-[1]' }, true],
            ['an empty namespace', { name: 'p', namespace: '' }, false],
            ['a dotted namespace', { name: 'p', namespace: 'acme.prod' }, false],
            ['an empty name', { name: '', namespace: 'acme' }, false],
        ],
    ],
    [
        'UpdateAccountPayload',
        'keeps the name the account model requires',
        [
            ['a name', { name: 'Acme' }, true],
            ['no name', { email_domains: [] }, true],
            ['an empty name', { name: '' }, false],
        ],
    ],
    [
        'CreateSecretRequest',
        'needs a website host and a base32 TOTP seed',
        [
            ['a host', { kind: 'website_credential', metadata: { name: 'n', websites: [{ host: 'a.com' }] } }, true],
            ['a blank host', { kind: 'website_credential', metadata: { name: 'n', websites: [{ host: ' ' }] } }, false],
            [
                'a spaced lower-case seed',
                {
                    kind: 'website_credential',
                    metadata: { name: 'n', websites: [{ host: 'a.com' }] },
                    secret: { totp: { seed: 'jbsw y3dp ehpk 3pxp==' } },
                },
                true,
            ],
            [
                'a seed outside base32',
                {
                    kind: 'website_credential',
                    metadata: { name: 'n', websites: [{ host: 'a.com' }] },
                    secret: { totp: { seed: '}P' } },
                },
                false,
            ],
            [
                'a seed of separators only',
                {
                    kind: 'website_credential',
                    metadata: { name: 'n', websites: [{ host: 'a.com' }] },
                    secret: { totp: { seed: '= -' } },
                },
                false,
            ],
        ],
    ],
    [
        'UpdateSecretRequest',
        'needs a website host',
        [['a blank host', { metadata: { websites: [{ host: '' }] } }, false]],
    ],
    [
        'CreateUserGroupPayload',
        'takes non-empty tags and project IDs',
        [
            ['tags and a project', { name: 'g', tags: ['a'], allowed_projects: [id] }, true],
            ['an empty tag', { name: 'g', tags: ['a', ''] }, false],
            ['an empty project', { name: 'g', allowed_projects: [''] }, false],
        ],
    ],
    [
        'UpdateUserGroupPayload',
        'takes non-empty tags and project IDs',
        [
            ['tags and a project', { name: 'g', tags: ['a'], allowed_projects: [id] }, true],
            ['an empty tag', { name: 'g', tags: [''] }, false],
            ['a project name', { name: 'g', allowed_projects: ['genai'] }, false],
        ],
    ],
    [
        'ListUserGroupsQuery',
        'filters by a project ID',
        [
            ['a project ID', { project: id }, true],
            ['an empty project', { project: '' }, true],
            ['a project name', { project: 'genai' }, false],
        ],
    ],
    [
        'CreateUserPayload',
        'adds the user to groups by ID',
        [
            ['a group ID', { email: 'a@b.com', groups: [id] }, true],
            ['an empty group', { email: 'a@b.com', groups: [''] }, false],
        ],
    ],
    [
        'UpdateOAuthProviderPayload',
        'keeps the create bounds on the fields it carries',
        [
            ['a kebab-case name', { name: 'acme-sso' }, true],
            ['an empty name', { name: '' }, false],
            ['an empty display name', { display_name: '' }, false],
            ['an empty client id', { client_id: '' }, false],
        ],
    ],
];

describe('IAM request rules', () => {
    for (const [component, rule, cases] of rules) {
        describe(`${component} ${rule}`, () => {
            it.each(cases)('%s', (_label, body, valid) => {
                expect(validateApiRequest(component, body).valid).toBe(valid);
            });
        });
    }
});
