import { UserGroup, UserRef } from "@vertesia/common";
import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";

export interface GroupsQueryOptions {
    search?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
    [key: string]: string | string[] | number | undefined;
}

export class GroupsApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/groups");
    }

    /**
     * List all groups in the current account
     * @param options Query options for filtering and pagination
     * @returns Array of UserGroup objects
     */
    list(options?: GroupsQueryOptions): Promise<UserGroup[]> {
        return this.get('/', { query: options });
    }

    /**
     * Create a new group
     * @param payload The group data to create
     * @returns The created UserGroup object
     */
    create(payload: Partial<UserGroup>): Promise<UserGroup> {
        return this.post('/', { payload });
    }

    /**
     * Retrieve a specific group by ID
     * @param groupId The ID of the group to retrieve
     * @returns The UserGroup object
     */
    retrieve(groupId: string): Promise<UserGroup> {
        return this.get('/' + groupId);
    }

    /**
     * Update a group
     * @param groupId The ID of the group to update
     * @param payload The group data to update
     * @returns The updated UserGroup object
     */
    update(groupId: string, payload: Partial<UserGroup>): Promise<UserGroup> {
        return this.put('/' + groupId, { payload });
    }

    /**
     * Delete a group
     * @param groupId The ID of the group to delete
     * @returns Object with the deleted group ID
     */
    delete(groupId: string): Promise<{ id: string }> {
        return this.del('/' + groupId);
    }

    /**
     * List members of a group
     * @param groupId The ID of the group
     * @returns Array of UserRef objects representing group members
     */
    listMembers(groupId: string): Promise<UserRef[]> {
        return this.get('/' + groupId + '/members');
    }

    /**
     * Add a member to a group
     * @param groupId The ID of the group
     * @param userId The ID of the user to add
     * @returns The updated UserGroup object
     */
    addMember(groupId: string, userId: string): Promise<UserGroup> {
        return this.post('/' + groupId + '/members/' + userId);
    }

    /**
     * Remove a member from a group
     * @param groupId The ID of the group
     * @param userId The ID of the user to remove
     * @returns The updated UserGroup object
     */
    removeMember(groupId: string, userId: string): Promise<UserGroup> {
        return this.del('/' + groupId + '/members/' + userId);
    }
}
