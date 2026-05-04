import { UserRef } from "./user.js";


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
    properties?: Record<string, any>;
    /** BLP clearance level — merged with user clearance using max() */
    clearance?: number;
    /** Compartments — merged with user compartments using array union */
    compartments?: string[];
}

export interface PopulatesUserGroup extends UserGroup {
    members: UserRef[];
}

export interface CreateUserGroupPayload {
    name: string;
    description?: string;
    tags?: string[];
}

export interface UpdateUserGroupPayload {
    name: string;
    description?: string;
    tags?: string[];
    properties?: Record<string, any>;
    clearance?: number;
    compartments?: string[];
}

export interface UserGroupRef {
    id: string;
    name: string;
    tags?: string[];
    properties?: Record<string, any>;
    clearance?: number;
    compartments?: string[];
}

export const UserGroupRefPopulate = 'id name tags description properties clearance compartments';

export const MEMBERS_GROUP_NAME = 'members';
