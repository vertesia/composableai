import { SystemRoles } from '@vertesia/common';
import type { AppEventSubscriptionDefinition } from '@vertesia/tools-sdk';

export const subscriptions = [
    {
        id: 'content-object-changed',
        name: 'Content object changed',
        description: 'Calls the example event hook when a content object is created or updated.',
        hook: 'content-object-changed',
        filter: {
            event_category: ['content'],
            action: ['create', 'update'],
            resource_type: ['content_object'],
        },
        run_as_role: SystemRoles.automation,
    },
] satisfies AppEventSubscriptionDefinition[];
