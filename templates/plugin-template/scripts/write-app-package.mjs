import { mkdir, writeFile } from 'node:fs/promises';
import { getProcessDefinitionValidationResult } from '@vertesia/common';
import { ServerConfig } from '../lib/config.js';
import server from '../lib/server.js';

const PACKAGE_BUILD_ORIGIN = 'https://app-package-build.local';

function names(items, selector) {
    return (items || []).map(selector).filter(Boolean).sort();
}

function normalizePrefix(prefix) {
    const value = typeof prefix === 'string' && prefix.trim() ? prefix.trim() : '/api';
    const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
    return withLeadingSlash.replace(/\/+$/, '') || '/api';
}

function assertPackage(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Package endpoint did not return an object');
    }
    return value;
}

function processLabel(process, index) {
    if (process && typeof process === 'object') {
        if (typeof process.id === 'string' && process.id) return process.id;
        if (typeof process.name === 'string' && process.name) return process.name;
    }
    return `#${index + 1}`;
}

function validatePackageProcesses(pkg) {
    const processes = Array.isArray(pkg.processes) ? pkg.processes : [];
    const errors = [];
    const seenIds = new Set();
    const seenNames = new Set();

    processes.forEach((process, index) => {
        const label = processLabel(process, index);
        if (!process || typeof process !== 'object' || Array.isArray(process)) {
            errors.push(`process ${label} must be an object`);
            return;
        }
        if (typeof process.id !== 'string' || !process.id) {
            errors.push(`process ${label} is missing id`);
        } else if (seenIds.has(process.id)) {
            errors.push(`process ${label} duplicates id "${process.id}"`);
        } else {
            seenIds.add(process.id);
        }
        if (typeof process.name !== 'string' || !process.name) {
            errors.push(`process ${label} is missing name`);
        } else if (seenNames.has(process.name)) {
            errors.push(`process ${label} duplicates name "${process.name}"`);
        } else {
            seenNames.add(process.name);
        }
        if (!process.definition || typeof process.definition !== 'object' || Array.isArray(process.definition)) {
            errors.push(`process ${label} is missing definition`);
            return;
        }

        const result = getProcessDefinitionValidationResult(process.definition);
        for (const error of result.errors) {
            errors.push(`process ${label}: ${error}`);
        }
    });

    if (errors.length > 0) {
        throw new Error(`App package process validation failed:\n- ${errors.join('\n- ')}`);
    }
}

async function readAppPackage() {
    const prefix = normalizePrefix(ServerConfig.prefix);
    const url = new URL(`${prefix}/package`, PACKAGE_BUILD_ORIGIN);
    url.searchParams.set('scope', 'all');

    const response = await server.fetch(new Request(url, { method: 'GET' }));
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Package endpoint failed with ${response.status}: ${body}`);
    }

    return assertPackage(await response.json());
}

function summarizeAppPackage(pkg) {
    const tools = names(pkg.tools, (tool) => tool.name);
    return {
        ui: Boolean(pkg.ui),
        settings: Boolean(pkg.settings_schema),
        tools: tools.filter((name) => !name.startsWith('learn_')),
        skills: tools.filter((name) => name.startsWith('learn_')),
        interactions: names(pkg.interactions, (interaction) => interaction.id || interaction.name),
        types: names(pkg.types, (type) => type.id || type.name),
        processes: names(pkg.processes, (process) => process.id || process.name),
        templates: names(pkg.templates, (template) => template.id || template.name || template.path),
        dashboards: names(pkg.dashboards, (dashboard) => dashboard.id || dashboard.name),
        widgets: Object.keys(pkg.widgets || {}).sort(),
        activities: names(pkg.activities, (activity) =>
            activity.collection ? `${activity.collection}:${activity.name}` : activity.name,
        ),
    };
}

function printSummary(summary) {
    console.log('App package artifacts:');
    for (const [key, value] of Object.entries(summary)) {
        if (Array.isArray(value)) {
            console.log(`  ${key}: ${value.length}${value.length > 0 ? ` (${value.join(', ')})` : ''}`);
        } else {
            console.log(`  ${key}: ${value ? 'yes' : 'no'}`);
        }
    }
}

await mkdir('dist', { recursive: true });

const pkg = await readAppPackage();
validatePackageProcesses(pkg);
const summary = summarizeAppPackage(pkg);

await writeFile('dist/app-package.json', `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile('dist/app-package-summary.json', `${JSON.stringify(summary, null, 2)}\n`);
printSummary(summary);
