import type { AppEventSubscriptionDefinition } from '@vertesia/tools-sdk';

// Register app-owned event subscriptions here. Each subscription points to the name of an
// event hook registered in ../hooks/index.ts; Studio derives its project and delivery URL.
// Example:
// {
//     id: 'content-updated',
//     name: 'Content updated',
//     hook: 'content-updated',
//     filter: { action: ['updated'], resource_type: ['content_object'] },
//     run_as_role: 'automation',
// }
export const subscriptions = [] satisfies AppEventSubscriptionDefinition[];
