import { VertesiaClient } from '@vertesia/client';

// Initialize the client
const client = new VertesiaClient({
    site: 'api.vertesia.io',
    apikey: 'your-api-key-here'
});

async function exampleGroupsUsage() {
    try {
        // List all groups
        const groups = await client.iam.groups.list();
        console.log('All groups:', groups);

        // List groups with query options
        const filteredGroups = await client.iam.groups.list({
            search: 'engineering',
            tags: ['developers'],
            limit: 10,
            offset: 0
        });
        console.log('Filtered groups:', filteredGroups);

        // Create a new group
        const newGroup = await client.iam.groups.create({
            name: 'Engineering Team',
            description: 'All engineering team members',
            tags: ['engineering', 'developers']
        });
        console.log('Created group:', newGroup);

        // Retrieve a specific group
        const group = await client.iam.groups.retrieve(newGroup.id);
        console.log('Retrieved group:', group);

        // Update a group
        const updatedGroup = await client.iam.groups.update(newGroup.id, {
            description: 'Updated description for engineering team',
            tags: ['engineering', 'developers', 'backend']
        });
        console.log('Updated group:', updatedGroup);

        // List group members
        const members = await client.iam.groups.listMembers(newGroup.id);
        console.log('Group members:', members);

        // Add a member to the group
        const userId = 'user-123';
        const groupWithNewMember = await client.iam.groups.addMember(newGroup.id, userId);
        console.log('Group after adding member:', groupWithNewMember);

        // Remove a member from the group
        const groupAfterRemoval = await client.iam.groups.removeMember(newGroup.id, userId);
        console.log('Group after removing member:', groupAfterRemoval);

        // Delete the group
        const deleteResult = await client.iam.groups.delete(newGroup.id);
        console.log('Delete result:', deleteResult);

    } catch (error) {
        console.error('Error:', error);
    }
}

// Run the example
exampleGroupsUsage();