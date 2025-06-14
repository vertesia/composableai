export interface UserGroup {
    id: string;
    account: string;
    name: string;
    description?: string;
    members: string[];
    tags: string[];
    created_at: Date;
    updated_at: Date;
    created_by?: string;
    updated_by?: string;
}

export interface UserGroupRef {
    id: string;
    name: string;
}

export const UserGroupRefPopulate = 'id name';