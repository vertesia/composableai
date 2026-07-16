#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const cwd = process.cwd();
const allowAdminShell = process.env.APPGEN_ALLOW_INTERNAL_APP_SHELL === 'true';
const blockedAdminShellTokens = [
    String.fromCharCode(65, 100, 109, 105, 110, 65, 112, 112),
    ['@ver', 'tesia/', 'tools-', 'admin-', 'ui'].join(''),
];
const report = {
    ok: true,
    scanned_files: 0,
    artifacts: {},
    errors: [],
    warnings: [],
};

function rel(file) {
    return path.relative(cwd, file).replaceAll(path.sep, '/');
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

function add(kind, rule, message, file) {
    const item = { rule, message, file: file ? rel(file) : undefined };
    report[kind].push(item);
}

function includesAny(text, values) {
    return values.some((value) => text.includes(value));
}

function stringLiterals(text) {
    return [...text.matchAll(/(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map((match) => match[2]);
}

function jsxTextNodes(text) {
    return [...text.matchAll(/>([^<>{}\n]*(?:seed|Seed)[^<>{}\n]*)</g)]
        .map((match) => match[1].replace(/\s+/g, ' ').trim())
        .filter(Boolean);
}

function firstEndUserSeedControl(text) {
    const pattern = /\bseed\s*(?:\/\s*sync|\s+(?:data|records?|objects?|store|samples?|demo|continuity)|\s*marker)\b/i;
    return [...stringLiterals(text), ...jsxTextNodes(text)].find((literal) => pattern.test(literal));
}

function nestedRouterProviderTags(text) {
    return [...text.matchAll(/<NestedRouterProvider\b[^>]*>/g)].map((match) => match[0]);
}

function nestedRouterProviderUsesFixLinks(tag) {
    if (/\bfixLinks\s*=\s*(?:\{\s*false\s*\}|["']false["'])/.test(tag)) return false;
    return /\bfixLinks(?:\s*=\s*(?:\{\s*true\s*\}|["']true["']))?(?=[\s/>])/.test(tag);
}

function hasAppNavigation(text) {
    return /<NavLink\b|<SidebarItem\b|<aside\b|<nav\b|useNavigate\s*\(/.test(text);
}

function directFiles(files, baseDir, extensions) {
    return files
        .map((file) => rel(file))
        .filter((file) => file.startsWith(baseDir))
        .filter((file) => extensions.some((extension) => file.endsWith(extension)))
        .sort();
}

function resourcePathPattern(resourceName) {
    return new RegExp(`^(?:src/tool-server/${resourceName}|src/modules/[^/]+/resources/${resourceName})/(.+)$`);
}

function namesFromResourceFiles(files, resourceName) {
    const pattern = resourcePathPattern(resourceName);
    return [
        ...new Set(
            files
                .map((file) => rel(file))
                .map((file) => file.match(pattern)?.[1])
                .filter(Boolean)
                .map((path) => path.split('/')[0])
                .filter((name) => name && name !== 'index.ts' && name !== 'index.tsx'),
        ),
    ].sort();
}

function directResourceFiles(files, resourceName, extensions) {
    const pattern = resourcePathPattern(resourceName);
    return files
        .map((file) => rel(file))
        .filter((file) => pattern.test(file))
        .filter((file) => extensions.some((extension) => file.endsWith(extension)))
        .sort();
}

function isSourceFile(file) {
    return /\.(ts|tsx|js|jsx|mjs|cjs|hbs|md|yaml|yml)$/.test(file);
}

function isCodeFile(file) {
    return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file);
}

function isTemplateShellEntry(file) {
    return rel(file) === 'src/ui/shell/AppEntry.tsx';
}

function isExampleModuleFile(file) {
    return rel(file).startsWith('src/modules/examples/');
}

function hasDetachedVertesiaClientMethod(text) {
    const apiTopics = '(objects|agents|interactions|files|types|apps|store|data|prompts|skills|collections|runs)';
    const detachedAssignment = new RegExp(`\\bconst\\s+\\w+\\s*=\\s*client\\.${apiTopics}\\??\\.\\w+\\s*;`);
    const destructuredTopic = new RegExp(`\\bconst\\s*\\{[^}]+\\}\\s*=\\s*client\\.${apiTopics}\\b`);
    return detachedAssignment.test(text) || destructuredTopic.test(text);
}

const sourceFiles = (await walk(path.join(cwd, 'src'))).filter(isSourceFile);
const scriptFiles = (await walk(path.join(cwd, 'scripts'))).filter(isSourceFile);
const allFiles = [...sourceFiles, ...scriptFiles];
report.scanned_files = allFiles.length;

const shellUiFiles = allFiles.filter((file) => rel(file).startsWith('src/ui/'));
const moduleUiFiles = allFiles.filter((file) => /^src\/modules\/[^/]+\/ui\//.test(rel(file)));
const uiFiles = [...shellUiFiles, ...moduleUiFiles];
const appUiFiles = moduleUiFiles;
const toolServerFiles = allFiles.filter((file) => rel(file).startsWith('src/tool-server/'));
const moduleResourceFiles = allFiles.filter((file) => /^src\/modules\/[^/]+\/resources\//.test(rel(file)));
const serverResourceFiles = [...toolServerFiles, ...moduleResourceFiles];
const packageWriterFiles = scriptFiles.filter(
    (file) => rel(file) === 'src/modules/app-gateway/scripts/write-app-package.mjs',
);
const interactionFiles = serverResourceFiles.filter((file) => rel(file).includes('/interactions/'));
const processFiles = serverResourceFiles.filter((file) => rel(file).includes('/processes/'));
const packageJsonPath = path.join(cwd, 'package.json');

report.artifacts = {
    types: namesFromResourceFiles(serverResourceFiles, 'types'),
    interactions: namesFromResourceFiles(serverResourceFiles, 'interactions'),
    prompts: directResourceFiles(serverResourceFiles, 'interactions', ['.hbs']),
    processes: directResourceFiles(serverResourceFiles, 'processes', ['.yaml', '.yml', '.ts']),
    dashboards: directResourceFiles(serverResourceFiles, 'dashboards', ['.ts', '.tsx']),
    templates: namesFromResourceFiles(serverResourceFiles, 'templates'),
    tools: namesFromResourceFiles(serverResourceFiles, 'tools'),
    skills: namesFromResourceFiles(serverResourceFiles, 'skills'),
    activities: namesFromResourceFiles(serverResourceFiles, 'activities'),
    widgets: [
        ...directFiles(sourceFiles, 'src/widgets/', ['.ts', '.tsx']),
        ...directResourceFiles(serverResourceFiles, 'skills', ['.tsx']),
    ],
    ui_routes: moduleUiFiles
        .map((file) => rel(file))
        .filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'))
        .sort(),
    seed_scripts: scriptFiles
        .map((file) => rel(file))
        .filter((file) => file.startsWith('scripts/') && /seed/i.test(file))
        .sort(),
};

async function readPackageJson() {
    try {
        return JSON.parse(await readFile(packageJsonPath, 'utf8'));
    } catch {
        return undefined;
    }
}

const packageJson = await readPackageJson();
const packageName = typeof packageJson?.name === 'string' ? packageJson.name : undefined;
const isPluginTemplatePackage = packageName === 'plugin-template';
// The smoke/integration tests bootstrap this exact template under throwaway
// package names — both package managers (with an optional `-npm` infix) across
// the smoke and integration scripts. The `--module dev` leg ships examples on
// purpose, so recognize every test-bootstrap name and keep the examples there
// instead of failing the example-artifact gate.
const isPluginTemplateSmokePackage = /^(integration|smoke)-test-plugin(-npm)?-\d+$/.test(packageName ?? '');
const isTemplateScaffoldPackage = isPluginTemplatePackage || isPluginTemplateSmokePackage;

function hasDependency(name) {
    if (!packageJson || typeof packageJson !== 'object') return false;
    const sections = ['dependencies', 'devDependencies'];
    return sections.some((section) => {
        const deps = packageJson[section];
        return deps && typeof deps === 'object' && typeof deps[name] === 'string';
    });
}

function requireDependency(name, reason) {
    if (hasDependency(name)) return;
    add('errors', 'missing-template-dependency', `${name} must stay in package.json. ${reason}`, packageJsonPath);
}

if (uiFiles.length > 0) {
    requireDependency('@vertesia/ui', 'Generated app UI uses Vertesia shell/session/components by default.');
    requireDependency(
        '@vertesia/client',
        'Generated app UI should call Vertesia APIs through useUserSession().client.',
    );
    requireDependency('@vertesia/common', 'Generated app UI and client calls use shared Vertesia wire types.');
}

if (toolServerFiles.length > 0) {
    requireDependency('@vertesia/tools-sdk', 'Service-target apps use it to create the package/tool server.');
    requireDependency(
        '@vertesia/common',
        'Service-target apps use shared package, process, type, and interaction definitions.',
    );
    requireDependency('hono', 'Service-target apps expose a Hono runtime imported by app-runtime.');
}

if (!isTemplateScaffoldPackage) {
    const templateExamples = [
        ...report.artifacts.tools.filter((name) => name === 'calculator' || name === 'examples'),
        ...report.artifacts.skills.filter((name) => name === 'learn_user-select' || name === 'examples'),
        ...report.artifacts.templates.filter((name) => name === 'examples'),
        ...report.artifacts.activities.filter((name) => name === 'examples'),
        ...report.artifacts.widgets.filter((name) => /user-select/i.test(name)),
    ];
    if (templateExamples.length > 0) {
        add(
            'errors',
            'no-template-example-artifacts',
            `Generated business apps must remove template example artifacts: ${[...new Set(templateExamples)].join(', ')}.`,
            path.join(cwd, 'src/modules'),
        );
    }
}

for (const file of allFiles.filter(isCodeFile)) {
    const text = await readFile(file, 'utf8');

    if (hasDetachedVertesiaClientMethod(text)) {
        add(
            'errors',
            'no-detached-vertesia-client-method',
            'Do not assign or destructure Vertesia SDK methods from client topics. Call through the client object, e.g. client.objects.search(...), so the SDK keeps its request context.',
            file,
        );
    }
}

for (const file of uiFiles) {
    const text = await readFile(file, 'utf8');

    // TODO(appgen): Once appgen-specific package scripts live in the appgen/app-gateway
    // module, run this check only against generated app UI. The template shell intentionally
    // keeps AdminApp as the Studio fallback while module UI is mounted under /app.
    if (!allowAdminShell && !isTemplateShellEntry(file) && includesAny(text, blockedAdminShellTokens)) {
        add(
            'errors',
            'no-admin-shell-leakage',
            'Normal app UI must render module UI, not an internal vendor admin shell.',
            file,
        );
    }

    if (/from\s+["']react-router-dom["']|import\s*\(\s*["']react-router-dom["']/.test(text)) {
        add('errors', 'no-react-router-dom', 'Use @vertesia/ui/router instead of react-router-dom.', file);
    }

    if (/@tanstack\/react-query/.test(text)) {
        add('errors', 'no-react-query', 'Use the Vertesia UI/session data patterns instead of react-query.', file);
    }

    if (/fetch\s*\(\s*["'`]\/api(?:\/v1|\/interactions|\/tools|\/package|\/processes|\/)?/.test(text)) {
        add(
            'errors',
            'no-same-origin-api-fetch',
            'Normal app screens must use useUserSession().client instead of same-origin /api fetches.',
            file,
        );
    }

    if (/https:\/\/api(?:[.-][a-z0-9-]+)*\.vertesia\.io\/api\/v1/i.test(text)) {
        add(
            'errors',
            'no-hardcoded-vertesia-api-base',
            'Normal app screens must use useUserSession().client so the host supplies the correct API base and auth token.',
            file,
        );
    }
}

for (const file of appUiFiles) {
    const text = await readFile(file, 'utf8');

    if (/\b[0-9a-f]{24}\b/i.test(text)) {
        add(
            'errors',
            'no-hardcoded-object-ids',
            'Do not hardcode project-local Mongo ObjectIds in app UI; resolve app-owned refs or query data.',
            file,
        );
    }

    if (/\(client\s+as\s+any\)|as\s+any\)\.objects|as\s+any\)\.agents|as\s+any\)\.interactions/.test(text)) {
        add(
            'errors',
            'no-client-any',
            'Do not use broad client as any/introspection shortcuts in final UI code.',
            file,
        );
    }

    if (/\bconsole\.(log|debug)\s*\(/.test(text)) {
        add('errors', 'no-debug-console', 'Remove console.log/console.debug from final UI code.', file);
    }

    const seedControl = firstEndUserSeedControl(text);
    if (seedControl) {
        add(
            'errors',
            'no-end-user-seed-controls',
            `Do not expose seed/setup controls in normal end-user UI. Seed data must be created during the build/test loop, not by a visible "${seedControl}" control.`,
            file,
        );
    }

    if (/window\.location\.href\s*=/.test(text)) {
        add(
            'errors',
            'mount-safe-navigation',
            'Avoid window.location.href redirects; use app router/navigation that stays under the /app/ mount.',
            file,
        );
    }

    const nestedRouterTags = nestedRouterProviderTags(text);
    for (const tag of nestedRouterTags) {
        if (!nestedRouterProviderUsesFixLinks(tag)) {
            add(
                'errors',
                'nested-router-fixlinks',
                'NestedRouterProvider must set fixLinks so app-internal hrefs stay under the current /app/ mount.',
                file,
            );
            break;
        }
    }

    if (nestedRouterTags.some((tag) => tag.endsWith('/>')) && hasAppNavigation(text)) {
        add(
            'errors',
            'nested-router-wraps-navigation',
            'Do not render sidebars/nav as siblings or parents of a self-closing NestedRouterProvider; wrap the full app layout inside <NestedRouterProvider ... fixLinks> or use NestedNavigationContext for external navigation.',
            file,
        );
    }
}

for (const file of packageWriterFiles) {
    const text = await readFile(file, 'utf8');

    if (/buildAppPackage/.test(text)) {
        add(
            'errors',
            'package-writer-use-package-route',
            "Package writer must call the built server's /api/package route, not import buildAppPackage from @vertesia/tools-sdk.",
            file,
        );
    }
}

for (const file of interactionFiles) {
    const text = await readFile(file, 'utf8');

    // TODO(appgen): Once this script validates generated app output instead of the template
    // source tree, remove this examples-module exemption. Example interactions are maintained
    // as teaching fixtures and are not app-owned production prompts.
    const isExampleInteraction = isExampleModuleFile(file);

    if (!isExampleInteraction && /TemplateType\.(jst|text)|content_type\s*:\s*["'](?:jst|text)["']/.test(text)) {
        add(
            'errors',
            'hbs-prompts-required',
            'App-owned interactions/prompts must use Handlebars content_type, not JST or plain text.',
            file,
        );
    }

    if (!isExampleInteraction && /prompts\s*:\s*\[/.test(text) && !/\.hbs\?prompt/.test(text)) {
        add(
            'warnings',
            'prefer-hbs-prompt-files',
            'Prefer .hbs?prompt files with YAML frontmatter over inline TypeScript prompt arrays.',
            file,
        );
    }

    if (
        !isExampleInteraction &&
        /PromptRole\.system|role\s*:\s*["']system["']/.test(text) &&
        !text.includes('{{_now}}')
    ) {
        add('warnings', 'system-prompt-now', "Agent/system prompts should include Today's date is {{_now}}.", file);
    }
}

for (const file of serverResourceFiles.filter((item) => item.endsWith('.hbs'))) {
    const text = await readFile(file, 'utf8');
    const looksLikeSystemPrompt = /role:\s*system|PromptRole\.system|You are\b/i.test(text);
    if (looksLikeSystemPrompt && !text.includes('{{_now}}')) {
        add(
            'warnings',
            'system-prompt-now',
            "Agent/system prompt files should include Today's date is {{_now}}.",
            file,
        );
    }
}

const hasProcessYaml = processFiles.some((file) => /\.(ya?ml)$/.test(file));
const hasProcessTs = processFiles.some((file) => /\.(ts|tsx)$/.test(file));
if (hasProcessTs && !hasProcessYaml) {
    add(
        'warnings',
        'prefer-process-yaml',
        'Prefer YAML/YML source definitions for non-trivial app-owned processes and register the parsed definition.',
        path.join(cwd, 'src/modules'),
    );
}

report.ok = report.errors.length === 0;

await mkdir(path.join(cwd, 'dist'), { recursive: true });
await writeFile(path.join(cwd, 'dist', 'app-quality-report.json'), `${JSON.stringify(report, null, 2)}\n`);

for (const item of report.errors) {
    console.error(`[app-quality:error] ${item.rule}${item.file ? ` ${item.file}` : ''}: ${item.message}`);
}
for (const item of report.warnings) {
    console.warn(`[app-quality:warning] ${item.rule}${item.file ? ` ${item.file}` : ''}: ${item.message}`);
}

console.log('App source artifacts:');
for (const [key, value] of Object.entries(report.artifacts)) {
    const list = Array.isArray(value) ? value : [];
    console.log(
        `  ${key}: ${list.length}${list.length > 0 ? ` (${list.slice(0, 20).join(', ')}${list.length > 20 ? ', ...' : ''})` : ''}`,
    );
}

if (!report.ok) {
    console.error(
        `[app-quality] failed with ${report.errors.length} error(s) and ${report.warnings.length} warning(s). See dist/app-quality-report.json.`,
    );
    process.exit(1);
}

console.log(
    `[app-quality] passed (${report.scanned_files} files, ${report.warnings.length} warning(s)). Report: dist/app-quality-report.json`,
);
