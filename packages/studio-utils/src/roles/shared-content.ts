import type { AbacScope, RoleDomain } from '@vertesia/common';
import { AbacRole, type Role, type RolePartition } from './classes.js';

const SharedContentRoleDomain: RoleDomain = 'shared_content';

const APPLICABLE_SCOPES: readonly AbacScope[] = ['shared_content'];

/**
 * Names of roles owned by the `shared_content` domain. Apply to ResourceSet ACEs
 * scoped to `shared_content` — cross-project sharing of documents and collections.
 *
 * The domain is intentionally READ-ONLY: shared content is for browsing by
 * non-members, never for modification. There is deliberately no writer/manager
 * role, so the vocabulary itself forbids granting write access on shared content.
 *
 * Unlike other ABAC scopes, `shared_content` grants are NOT emitted as flat
 * `{scope}:{verb}` JWT keys. Token generation groups them by owner project under
 * `@<project_id>` keys, because a shared grant targets documents in a project the
 * principal is not a member of.
 */
export enum SharedContentRoleNames {
    shared_content_reader = 'shared_content:reader',
}

class SharedContentReaderRole extends AbacRole {
    constructor() {
        super(SharedContentRoleNames.shared_content_reader, ['read'], SharedContentRoleDomain, APPLICABLE_SCOPES);
    }
}

const sharedContentRoles: Record<SharedContentRoleNames, Role> = {
    [SharedContentRoleNames.shared_content_reader]: new SharedContentReaderRole(),
};

export const sharedContentPartition: RolePartition = {
    domain: SharedContentRoleDomain,
    roles: new Map(Object.entries(sharedContentRoles)),
};
