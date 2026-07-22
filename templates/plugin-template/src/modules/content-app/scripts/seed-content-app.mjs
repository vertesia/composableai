#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { VertesiaClient } from '@vertesia/client';

const packageJson = JSON.parse(readFileSync(new URL('../../../../package.json', import.meta.url), 'utf8'));
const APP_NAME = packageJson.name;
const SEED_MARKER = `content-app:${APP_NAME}`;
const GUIDE_TYPE = `app:${APP_NAME}:guide`;
const LOCATION_TYPE = `app:${APP_NAME}:location`;
const REVIEW_TASK_TYPE = `app:${APP_NAME}:review_task`;

const locations = [
    {
        slug: 'north-ridge',
        name: 'North Ridge',
        region: 'Cascade Foothills',
        country: 'US',
        terrain: 'Alpine ridge and meadow',
        best_season: 'Late summer',
        summary: 'Accessible ridge route with open views, short snowfields, and reliable water near the lower meadow.',
    },
    {
        slug: 'fern-canyon',
        name: 'Fern Canyon',
        region: 'Coastal Range',
        country: 'US',
        terrain: 'Shaded canyon',
        best_season: 'Spring',
        summary: 'Cool canyon route with dense vegetation, slick crossings, and good interpretation stops.',
    },
];

const guides = [
    {
        slug: 'north-ridge-day-loop',
        title: 'North Ridge Day Loop',
        summary: 'A moderate loop covering ridge navigation, water planning, and afternoon weather checks.',
        body:
            'Start at the lower meadow trailhead and climb gradually to the east shoulder. The ridge section is exposed ' +
            'to afternoon wind, so teams should carry layers and turn around before cloud cover settles on the saddle. ' +
            'Water is reliable at the meadow outlet through late summer. The loop is best for readers comfortable with ' +
            'four to six hours of steady movement.',
        location_slug: 'north-ridge',
        category: 'Route Guide',
        status: 'in_review',
        owner: 'Field Editorial',
        audience: 'weekend trip planners',
        tags: ['ridge', 'day-loop', 'weather'],
    },
    {
        slug: 'fern-canyon-family-notes',
        title: 'Fern Canyon Family Notes',
        summary: 'A family-friendly canyon guide focused on pacing, crossings, and interpretive stops.',
        body:
            'The canyon floor stays cool and damp. Plan short sections between stops and expect slippery stones at the ' +
            'second crossing. The best interpretive stops are the lower fern wall, the old bridge footing, and the ' +
            'upper pool. This route works well for mixed-age groups when leaders keep the pace slow.',
        location_slug: 'fern-canyon',
        category: 'Field Notes',
        status: 'draft',
        owner: 'Education Team',
        audience: 'families and volunteer guides',
        tags: ['canyon', 'family', 'interpretation'],
    },
];

const reviewTasks = [
    {
        slug: 'review-north-ridge-day-loop',
        guide_slug: 'north-ridge-day-loop',
        title: 'Review North Ridge Day Loop',
        priority: 'high',
        status: 'open',
        assignee: 'editorial',
        checklist: [
            'Confirm water availability statement.',
            'Check turn-around guidance against latest route notes.',
            'Verify difficulty label.',
        ],
        due_date: '2026-07-15',
    },
    {
        slug: 'review-fern-canyon-family-notes',
        guide_slug: 'fern-canyon-family-notes',
        title: 'Review Fern Canyon Family Notes',
        priority: 'medium',
        status: 'in_progress',
        assignee: 'education',
        checklist: [
            'Validate crossing safety language.',
            'Add accessibility notes.',
            'Confirm interpretive stop names.',
        ],
        due_date: '2026-07-22',
    },
];

function resolveEndpoints() {
    if (!process.env.VERTESIA_SERVER_URL || !process.env.VERTESIA_STORE_URL) return undefined;
    return {
        studio: process.env.VERTESIA_SERVER_URL,
        store: process.env.VERTESIA_STORE_URL,
        token: process.env.VERTESIA_TOKEN_SERVER_URL,
    };
}

async function getClient() {
    const token = process.env.VERTESIA_TOKEN;
    if (!token) {
        throw new Error('VERTESIA_TOKEN is required. Use `VERTESIA_TOKEN="$(vertesia auth token)" pnpm seed:content`.');
    }
    return await VertesiaClient.fromAuthToken(token, undefined, resolveEndpoints());
}

async function findBySlug(client, type, slug) {
    const response = await client.objects.search({
        query: {
            type,
            match: {
                'properties.seed_marker': SEED_MARKER,
                'properties.slug': slug,
            },
        },
        limit: 1,
    });
    return response.results[0];
}

async function upsertObject(client, type, record, toName) {
    const existing = await findBySlug(client, type, record.slug);
    const payload = {
        type,
        name: toName(record),
        properties: {
            ...record,
            seed_marker: SEED_MARKER,
        },
    };
    if (existing?.id) {
        await client.objects.update(existing.id, payload, { suppressWorkflows: true });
        return { id: existing.id, action: 'updated' };
    }
    const created = await client.objects.create(payload);
    return { id: created.id, action: 'created' };
}

function wrapAppScopeError(error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/app:|type|forbidden|unauthorized|permission|not found/i.test(message)) {
        return new Error(
            [
                'Content app setup could not create app-owned Store objects.',
                `App: ${APP_NAME}`,
                `Types: ${GUIDE_TYPE}, ${LOCATION_TYPE}, ${REVIEW_TASK_TYPE}`,
                'Verify the app was published or is running in preview, is installed/visible to the project,',
                'and the token has an app scope that includes this app. Do not work around this by creating API keys.',
                `Original error: ${message}`,
            ].join('\n'),
            { cause: error },
        );
    }
    return error;
}

export async function seedContentApp() {
    const client = await getClient();
    const results = [];
    try {
        for (const location of locations) {
            results.push(await upsertObject(client, LOCATION_TYPE, location, (item) => item.name));
        }
        for (const guide of guides) {
            results.push(await upsertObject(client, GUIDE_TYPE, guide, (item) => item.title));
        }
        for (const task of reviewTasks) {
            results.push(await upsertObject(client, REVIEW_TASK_TYPE, task, (item) => item.title));
        }
    } catch (error) {
        throw wrapAppScopeError(error);
    }
    return {
        app: APP_NAME,
        marker: SEED_MARKER,
        counts: {
            locations: locations.length,
            guides: guides.length,
            review_tasks: reviewTasks.length,
        },
        results,
    };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    seedContentApp()
        .then((result) => {
            console.log(JSON.stringify(result, null, 2));
        })
        .catch((error) => {
            console.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
        });
}
