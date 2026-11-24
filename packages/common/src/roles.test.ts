import { describe, expect, test } from 'vitest';
import { SystemRoles } from './project.js';
import { AbacScopes } from './roles/types.js';

describe('shared role vocabulary', () => {
    test('exports all system roles', () => {
        expect(Object.values(SystemRoles).sort()).toEqual(
            [
                'admin',
                'app_admin',
                'app_member',
                'application',
                'auditor',
                'automation',
                'billing',
                'consumer',
                'content_processor',
                'content_superadmin',
                'developer',
                'executor',
                'manager',
                'member',
                'owner',
                'project_admin',
                'project_app_admin',
                'project_auditor',
                'project_support',
                'reader',
                'support',
            ].sort(),
        );
    });

    test('exports ABAC scopes used by role wire types', () => {
        expect(AbacScopes).toEqual(['document', 'collection', 'agent_run', 'shared_content', 'task']);
    });
});
