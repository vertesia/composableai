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
}

export interface PopulatesUserGroup extends UserGroup {
    members: UserRef[];
}

export interface UserGroupRef {
    id: string;
    name: string;
    tags?: string[];
}

export const UserGroupRefPopulate = 'id name tags';