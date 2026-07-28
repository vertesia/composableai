import type { UserRef } from './user.js';

export interface UserGroup {
    id: string;
    account: string;
    name: string;
    description?: string;
    tags: string[];
    created_at: Date;
    updated_at: Date;
    created_by?: string;
    updated_by?: string;
    /** Custom properties for dynamic permission matching */
    properties?: Record<string, unknown>;
    /** BLP clearance level — merged with user clearance using max() */
    clearance?: number;
    /** Compartments — merged with user compartments using array union */
    compartments?: string[];
    /**
     * Projects this group is allowed to be used in. When empty or absent the group is
     * org-wide (usable in any project). When set, the group may only be used to grant
     * permissions in the listed projects.
     */
    allowed_projects?: string[];
}

export interface PopulatesUserGroup extends UserGroup {
    members: UserRef[];
}

export interface CreateUserGroupPayload {
    name: string;
    description?: string;
    tags?: string[];
    /** Restrict the new group to the given projects (empty/absent = org-wide). */
    allowed_projects?: string[];
}

export interface UpdateUserGroupPayload {
    name: string;
    description?: string;
    tags?: string[];
    properties?: Record<string, unknown>;
    clearance?: number;
    compartments?: string[];
    allowed_projects?: string[];
}

export interface UserGroupRef {
    id: string;
    name: string;
    tags?: string[];
    properties?: Record<string, unknown>;
    clearance?: number;
    compartments?: string[];
    allowed_projects?: string[];
}

export const UserGroupRefPopulate = 'id name tags description properties clearance compartments allowed_projects';

export const MEMBERS_GROUP_NAME = 'members';
