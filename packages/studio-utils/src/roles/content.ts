import type { AbacScope, RoleDomain } from '@vertesia/common';
import { AbacRole, type Role, type RolePartition } from './classes.js';

const ContentRoleDomain: RoleDomain = 'content';

// Scopes where content can be written/managed. `shared_content` is deliberately absent — shared content
// is read-only, so writer/manager never apply to it.
const WRITABLE_CONTENT_SCOPES: readonly AbacScope[] = ['document', 'collection'];

// content:reader additionally serves the read-only `shared_content` scope: cross-project sharing reuses
// the content read permission — `shared_content` is a SCOPE over content (like `collection`), not its own
// domain. Only the reader lists it, so the vocabulary can't grant write/manage on shared content.
const READER_SCOPES: readonly AbacScope[] = [...WRITABLE_CONTENT_SCOPES, 'shared_content'];

/**
 * Names of roles owned by the `content` domain. Apply to ResourceSet ACEs
 * scoped to either `document` or `collection` — the semantics of "read
 * content" are the same for both kinds.
 */
export enum ContentRoleNames {
    content_reader = 'content:reader',
    content_writer = 'content:writer',
    content_manager = 'content:manager',
}

class ContentReaderRole extends AbacRole {
    constructor() {
        super(ContentRoleNames.content_reader, ['read'], ContentRoleDomain, READER_SCOPES);
    }
}

class ContentWriterRole extends AbacRole {
    constructor() {
        super(ContentRoleNames.content_writer, ['read', 'write'], ContentRoleDomain, WRITABLE_CONTENT_SCOPES);
    }
}

class ContentManagerRole extends AbacRole {
    constructor() {
        super(
            ContentRoleNames.content_manager,
            ['read', 'write', 'delete'],
            ContentRoleDomain,
            WRITABLE_CONTENT_SCOPES,
        );
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
