import { describe, expect, it } from 'vitest';
import { NOTIFICATION_OCCURRENCE_TYPES } from './notifications.js';
import { type ApiComponentName, validateApiRequest } from './registry.js';

const OBJECT_ID = '0123456789abcdefABCDEF01';
const discovery = { type: 'sharepoint', site_url: 'https://contoso.sharepoint.com/sites/legal' };

// Identifiers and values the servers refuse with a 400 before they look anything up, published so a caller can tell a
// malformed request from one the server could serve.
const rules: Array<[ApiComponentName, Array<[string, unknown, boolean]>]> = [
    [
        'InteractionListQuery',
        [
            ['an environment ID', { environment: OBJECT_ID }, true],
            ['an empty environment, which is no filter', { environment: '' }, true],
            ['an environment that is not an ID', { environment: 'prod' }, false],
        ],
    ],
    [
        'ArchiveNotificationsPayload',
        [
            ['notification IDs', { ids: [OBJECT_ID] }, true],
            ['an empty ID', { ids: [''] }, false],
        ],
    ],
    [
        'MarkNotificationsReadPayload',
        [
            ['notification IDs', { ids: [OBJECT_ID] }, true],
            ['an ID that is not an ObjectId', { ids: ['n1'] }, false],
            ...NOTIFICATION_OCCURRENCE_TYPES.map((type): [string, unknown, boolean] => [
                `a ${type} occurrence`,
                { occurrences: [{ type, id: 'x' }] },
                true,
            ]),
            ['an unknown occurrence type', { occurrences: [{ type: 'agent_turns', id: 'x' }] }, false],
        ],
    ],
    [
        'DiscoverContentSourceSitePayload',
        [
            ['an OAuth provider ID', { ...discovery, oauth_provider_id: OBJECT_ID }, true],
            ['an OAuth provider name', { ...discovery, oauth_provider_id: 'graph' }, false],
        ],
    ],
    [
        'ExportPropertiesPayload',
        [
            ['no IDs, which exports everything', { objectIds: [], type: 'CSV' }, true],
            ['object IDs', { objectIds: [OBJECT_ID], type: 'JSON' }, true],
            ['an ID that is not an ObjectId', { objectIds: ['3'], type: 'JSON' }, false],
        ],
    ],
    [
        'NotificationPathParams',
        [
            ['a notification ID', { notificationId: OBJECT_ID }, true],
            ['a short ID', { notificationId: '0' }, false],
        ],
    ],
    [
        'ContentSourceRoundPathParams',
        [
            ['a round ID', { roundId: 'r_2026-11-01' }, true],
            ['a round ID with a dot', { roundId: 'a.b' }, false],
            ['a round ID over 64 characters', { roundId: 'r'.repeat(65) }, false],
        ],
    ],
];

describe.each(rules)('%s', (component, cases) => {
    it.each(cases)('%s: valid is %s', (_case, body, valid) => {
        const result = validateApiRequest(component, body);

        expect(result.valid, JSON.stringify(result.valid ? null : result.issues)).toBe(valid);
    });
});
