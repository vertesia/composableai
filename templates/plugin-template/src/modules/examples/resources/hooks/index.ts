import type { AppHookDefinition } from '@vertesia/tools-sdk';
import { contentObjectChanged } from './content-object-changed.js';
import { install } from './install.js';
import { uninstall } from './uninstall.js';

export const hooks = [
    { kind: 'lifecycle', name: 'install', handler: install },
    { kind: 'lifecycle', name: 'uninstall', handler: uninstall },
    {
        kind: 'event',
        name: 'content-object-changed',
        description: 'Logs the title of a content object after it is created or updated.',
        handler: contentObjectChanged,
    },
] satisfies AppHookDefinition[];
