import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getProcessDefinitionValidationResult, getProcessInteractionValidationSelectors } from '@vertesia/common';
import { ServerConfig } from '../lib/config.js';
import server from '../lib/server.js';

const PACKAGE_BUILD_ORIGIN = 'https://app-package-build.local';
const cwd = process.cwd();
const SYSTEM_INTERACTION_SELECTORS = [
    'sys:GeneralAgent',
    'sys:StudioAssistant',
    'sys:AppDeveloper',
    'sys:AppDesigner',
    'sys:AppTester',
    'sys:AppReviewer',
    'sys:AppSolutionArchitect',
];

function names(items, selector) {
    return (items || []).map(selector).filter(Boolean).sort();
}

async function readJsonIfExists(path) {
    try {
        return JSON.parse(await readFile(path, 'utf8'));
    } catch {
        return undefined;
    }
}

async function walk(root) {
    if (!existsSync(root)) return [];
    const out = [];
    async function visit(dir) {
        for (const entry of await readdir(dir)) {
            if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
            const full = path.join(dir, entry);
            const info = await stat(full);
            if (info.isDirectory()) {
                await visit(full);
            } else {
                out.push(full);
            }
        }
    }
    await visit(root);
    return out;
}

function rel(file) {
    return path.relative(cwd, file).replaceAll(path.sep, '/');
}

function isSourceFile(file) {
    return /\.(ts|tsx|js|jsx|mjs|cjs|hbs|md|yaml|yml)$/.test(file);
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

function packageJsonName(packageJson) {
    return typeof packageJson?.name === 'string' && packageJson.name ? packageJson.name : undefined;
}

function isTemplateScaffoldPackageName(name) {
    return name === 'plugin-template' || /^integration-test-plugin-\d+$/.test(name ?? '');
}

function itemId(item) {
    if (!item || typeof item !== 'object') return undefined;
    if (typeof item.id === 'string' && item.id) return item.id;
    if (typeof item.name === 'string' && item.name) return item.name;
    return undefined;
}

function validateLocalCapabilityIds(pkg, appName) {
    if (isTemplateScaffoldPackageName(appName)) return [];

    const errors = [];
    const groups = [
        ['types', 'type'],
        ['interactions', 'interaction'],
        ['processes', 'process'],
        ['dashboards', 'dashboard'],
        ['templates', 'template'],
    ];

    for (const [key, label] of groups) {
        const items = Array.isArray(pkg[key]) ? pkg[key] : [];
        items.forEach((item, index) => {
            const id = itemId(item);
            if (!id) return;
            if (id.startsWith('app:')) {
                errors.push(
                    `${label} ${id} must use a package-local id; runtime refs become app:<app-name>:${id.slice(4)}`,
                );
            }
            if (id === 'examples' || id.startsWith('examples:') || id.startsWith('examples/')) {
                errors.push(`${label} #${index + 1} is still using template example id "${id}"`);
            }
        });
    }

    return errors;
}

function packageInteractionSelectors(pkg, appName) {
    const selectors = new Set(SYSTEM_INTERACTION_SELECTORS);
    const interactions = Array.isArray(pkg.interactions) ? pkg.interactions : [];
    for (const selector of getProcessInteractionValidationSelectors(interactions)) {
        selectors.add(selector);
    }

    for (const interaction of interactions) {
        const localIds = [interaction?.id, interaction?.name].filter((value) => typeof value === 'string' && value);
        for (const localId of localIds) {
            selectors.add(localId);
            if (appName && !localId.startsWith('app:') && !localId.startsWith('sys:')) {
                selectors.add(`app:${appName}:${localId}`);
            }
        }
    }
    return selectors;
}

function packageCapabilityIds(pkg) {
    const ids = new Set();
    const groups = ['types', 'interactions', 'processes', 'dashboards', 'templates'];
    for (const key of groups) {
        const items = Array.isArray(pkg[key]) ? pkg[key] : [];
        for (const item of items) {
            const id = itemId(item);
            if (id) ids.add(id);
        }
    }
    return ids;
}

async function validateSourceAppRefs(pkg, appName) {
    if (!appName || isTemplateScaffoldPackageName(appName)) return [];
    const knownIds = packageCapabilityIds(pkg);
    if (knownIds.size === 0) return [];

    const files = (await walk(path.join(cwd, 'src'))).filter(isSourceFile);
    const errors = [];
    const refPattern = new RegExp(`app:${appName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:([A-Za-z0-9._:-]+)`, 'g');

    for (const file of files) {
        const text = await readFile(file, 'utf8');
        for (const match of text.matchAll(refPattern)) {
            const localRef = match[1];
            if (!knownIds.has(localRef)) {
                errors.push(
                    `${rel(file)} references app:${appName}:${localRef}, but no package capability exposes local id "${localRef}". Known ids: ${[...knownIds].sort().join(', ')}`,
                );
            }
        }
    }

    return errors;
}

async function validatePackageProcesses(pkg, appName) {
    const processes = Array.isArray(pkg.processes) ? pkg.processes : [];
    const errors = validateLocalCapabilityIds(pkg, appName);
    const seenIds = new Set();
    const seenNames = new Set();
    const knownInteractions = packageInteractionSelectors(pkg, appName);

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

        const result = getProcessDefinitionValidationResult(process.definition, { knownInteractions });
        for (const error of result.errors) {
            errors.push(`process ${label}: ${error}`);
        }
    });

    errors.push(...(await validateSourceAppRefs(pkg, appName)));

    if (errors.length > 0) {
        throw new Error(`App package validation failed:\n- ${errors.join('\n- ')}`);
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
        if (key === 'source_artifacts') continue;
        if (Array.isArray(value)) {
            console.log(`  ${key}: ${value.length}${value.length > 0 ? ` (${value.join(', ')})` : ''}`);
        } else {
            console.log(`  ${key}: ${value ? 'yes' : 'no'}`);
        }
    }
    if (summary.source_artifacts && typeof summary.source_artifacts === 'object') {
        console.log('App source artifacts:');
        for (const [key, value] of Object.entries(summary.source_artifacts)) {
            const list = Array.isArray(value) ? value : [];
            console.log(
                `  ${key}: ${list.length}${list.length > 0 ? ` (${list.slice(0, 20).join(', ')}${list.length > 20 ? ', ...' : ''})` : ''}`,
            );
        }
    }
}

await mkdir('dist', { recursive: true });

const pkg = await readAppPackage();
const packageJson = await readJsonIfExists('package.json');
await validatePackageProcesses(pkg, packageJsonName(packageJson));
const summary = summarizeAppPackage(pkg);
const qualityReport = await readJsonIfExists('dist/app-quality-report.json');
if (qualityReport?.artifacts && typeof qualityReport.artifacts === 'object') {
    summary.source_artifacts = qualityReport.artifacts;
}

await writeFile('dist/app-package.json', `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile('dist/app-package-summary.json', `${JSON.stringify(summary, null, 2)}\n`);
printSummary(summary);
