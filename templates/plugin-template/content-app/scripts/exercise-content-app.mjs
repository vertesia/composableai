#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { VertesiaClient } from '@vertesia/client';
import { seedContentApp } from './seed-content-app.mjs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const APP_NAME = packageJson.name;
const SEED_MARKER = `content-app:${APP_NAME}`;
const GUIDE_TYPE = `app:${APP_NAME}:guide`;
const GUIDE_SUMMARIZER_INTERACTION = `app:${APP_NAME}:main:guide_summarizer`;
const GUIDE_REVIEW_PROCESS = `app:${APP_NAME}:guide-review`;

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
        throw new Error(
            'VERTESIA_TOKEN is required. Use `VERTESIA_TOKEN="$(vertesia auth token)" pnpm exercise:content`.',
        );
    }
    return await VertesiaClient.fromAuthToken(token, undefined, resolveEndpoints());
}

async function main() {
    const seed = await seedContentApp();
    const client = await getClient();
    const guides = await client.objects.search({
        query: {
            type: GUIDE_TYPE,
            match: { 'properties.seed_marker': SEED_MARKER },
        },
        limit: 5,
    });
    const guide = guides.results[0];
    if (!guide) {
        throw new Error(`No guide objects found for ${GUIDE_TYPE} and marker ${SEED_MARKER}.`);
    }

    const properties = guide.properties;
    const summary = await client.interactions.executeByName(GUIDE_SUMMARIZER_INTERACTION, {
        data: {
            guide_title: properties.title,
            body: properties.body,
            location: properties.location_slug,
            audience: properties.audience,
        },
    });

    const processRun = await client.agents.start({
        process_id: GUIDE_REVIEW_PROCESS,
        run_type: 'programmatic',
        data: {
            guide_slug: properties.slug,
            guide_title: properties.title,
            guide_body: properties.body,
            location_slug: properties.location_slug,
            review_notes: '',
        },
        tags: [SEED_MARKER, 'content-app-exercise'],
    });

    return {
        app: APP_NAME,
        seed,
        search: {
            type: GUIDE_TYPE,
            count: guides.results.length,
            first_guide_id: guide.id,
        },
        interaction: {
            selector: GUIDE_SUMMARIZER_INTERACTION,
            run_id: summary.id,
            has_result: Boolean(summary.result),
        },
        process: {
            process_id: GUIDE_REVIEW_PROCESS,
            run_id: processRun.id,
            status: processRun.status,
            current_node: processRun.process_state?.current_node,
        },
    };
}

main()
    .then((result) => {
        console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    });
