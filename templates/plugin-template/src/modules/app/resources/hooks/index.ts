import type { AppHookDefinition } from '@vertesia/tools-sdk';

// Import app-owned hook implementations from this directory and register them here.
// Example: { kind: 'lifecycle', name: 'install', handler: install }
// Example: { kind: 'event', name: 'content-updated', handler: contentUpdated }
export const hooks = [] satisfies AppHookDefinition[];
