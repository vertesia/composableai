import type { AbacScope, RoleDomain } from '@vertesia/common';
import { AbacRole, type Role, type RolePartition } from './classes.js';

const ContentRoleDomain: RoleDomain = 'content';

const APPLICABLE_SCOPES: readonly AbacScope[] = ['document', 'collection'];

/**
 * Names of roles owned by the `content` domain. Apply to ContentSet ACEs
 * scoped to either `document` or `collection` — the semantics of "read
 * content" are the same for both kinds.
 */
export enum ContentRoleNames {
    content_reader = 'content_reader',
    content_writer = 'content_writer',
    content_manager = 'content_manager',
}

class ContentReaderRole extends AbacRole {
    constructor() {
        super(ContentRoleNames.content_reader, ['read'], ContentRoleDomain, APPLICABLE_SCOPES);
    }
}

class ContentWriterRole extends AbacRole {
    constructor() {
        super(ContentRoleNames.content_writer, ['read', 'write'], ContentRoleDomain, APPLICABLE_SCOPES);
    }
}

class ContentManagerRole extends AbacRole {
    constructor() {
        super(ContentRoleNames.content_manager, ['read', 'write', 'delete'], ContentRoleDomain, APPLICABLE_SCOPES);
    }
}

const contentRoles: Record<ContentRoleNames, Role> = {
    [ContentRoleNames.content_reader]: new ContentReaderRole(),
    [ContentRoleNames.content_writer]: new ContentWriterRole(),
    [ContentRoleNames.content_manager]: new ContentManagerRole(),
};

export const contentPartition: RolePartition = {
    domain: ContentRoleDomain,
    roles: new Map(Object.entries(contentRoles)),
};
