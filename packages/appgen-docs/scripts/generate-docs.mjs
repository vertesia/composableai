#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(SCRIPT_DIR, '..');
const REPO_ROOT = join(PACKAGE_ROOT, '..', '..');
// Keep generated docs beside the package entrypoint so Turbo's existing lib/** output captures
// them on cache writes and restores. Consumers resolve this directory through appgenDocsRoot.
const DOCS_ROOT = join(PACKAGE_ROOT, 'lib', 'docs');
const TOOL_SERVER_RESOURCE_REFERENCE_PATH = join(
    REPO_ROOT,
    'templates',
    'plugin-template',
    '.agents',
    'skills',
    'vertesia-tool-server-resource',
    'REFERENCE.md',
);

// Turbo builds these workspace dependencies before this package. Generating from their local
// outputs keeps one composableai snapshot internally consistent and avoids requiring an earlier
// npm publication before the documentation package can be built.
const UI_TYPES_ROOT = join(REPO_ROOT, 'packages', 'ui', 'lib');
const CLIENT_TYPES_ROOT = join(REPO_ROOT, 'packages', 'client', 'lib');
const COMMON_TYPES_ROOT = join(REPO_ROOT, 'packages', 'common', 'lib');

const PACKAGE_MANIFESTS = {
    '@vertesia/ui': join(REPO_ROOT, 'packages', 'ui', 'package.json'),
    '@vertesia/client': join(REPO_ROOT, 'packages', 'client', 'package.json'),
    '@vertesia/common': join(REPO_ROOT, 'packages', 'common', 'package.json'),
};

const TYPE_FILES = [
    'core/components/index.d.ts',
    'core/components/shadcn/index.d.ts',
    'core/components/shadcn/input.d.ts',
    'core/components/shadcn/button.d.ts',
    'core/components/shadcn/badge.d.ts',
    'core/components/shadcn/modal/dialog.d.ts',
    'core/components/shadcn/modal/ConfirmModal.d.ts',
    'core/components/shadcn/modal/DeleteModal.d.ts',
    'core/components/shadcn/selectBox.d.ts',
    'core/components/shadcn/textarea.d.ts',
    'core/components/shadcn/tabs.d.ts',
    'core/components/table/index.d.ts',
    'core/components/FormItem.d.ts',
    'core/components/SelectList.d.ts',
    'core/components/ComboBox.d.ts',
    'core/components/TagsInput.d.ts',
    'core/components/NumberInput.d.ts',
    'core/components/InputList.d.ts',
    'core/components/SidePanel.d.ts',
    'core/hooks/index.d.ts',
    'layout/index.d.ts',
    'layout/FullHeightLayout.d.ts',
    'layout/Sidebar.d.ts',
    'router/index.d.ts',
    'router/RouterProvider.d.ts',
    'router/NestedRouterProvider.d.ts',
    'router/Nav.d.ts',
    'session/index.d.ts',
    'session/UserSession.d.ts',
    'features/index.d.ts',
    'features/layout/GenericPageNavHeader.d.ts',
    'features/agent/chat/ModernAgentConversation.d.ts',
    'features/store/objects/index.d.ts',
    'features/store/objects/search/index.d.ts',
    'features/store/objects/components/index.d.ts',
    'features/store/collections/index.d.ts',
    'widgets/index.d.ts',
];

const CLIENT_TYPE_FILES = [
    ['client', 'index.d.ts'],
    ['client', 'client.d.ts'],
    ['client', 'AppsApi.d.ts'],
    ['client', 'InteractionsApi.d.ts'],
    ['client', 'PromptsApi.d.ts'],
    ['client', 'SkillsApi.d.ts'],
    ['client', 'RunsApi.d.ts'],
    ['client', 'store/client.d.ts'],
    ['client', 'store/ObjectsApi.d.ts'],
    ['client', 'store/CollectionsApi.d.ts'],
    ['client', 'store/AgentsApi.d.ts'],
    ['client', 'store/TypesApi.d.ts'],
    ['client', 'store/FilesApi.d.ts'],
    ['client', 'store/DataApi.d.ts'],
    ['client', 'store/QueryApi.d.ts'],
    ['client', 'store/ProcessApi.d.ts'],
    ['client', 'store/ToolsApi.d.ts'],
    ['common', 'store/store.d.ts'],
    ['common', 'store/agent-run.d.ts'],
    ['common', 'store/object-types.d.ts'],
    ['common', 'store/collections.d.ts'],
    ['common', 'store/process.d.ts'],
    ['common', 'store/workflow.d.ts'],
    ['common', 'apps.d.ts'],
    ['common', 'interaction.d.ts'],
    ['common', 'prompt.d.ts'],
    ['common', 'skill.d.ts'],
    ['common', 'runs.d.ts'],
    ['common', 'data-platform.d.ts'],
];

const COMMON_REFERENCE_TYPE_FILES = [
    'index.d.ts',
    'apps.d.ts',
    'data-platform.d.ts',
    'interaction.d.ts',
    'prompt.d.ts',
    'project.d.ts',
    'runs.d.ts',
    'skill.d.ts',
    'store/store.d.ts',
    'store/object-types.d.ts',
    'store/collections.d.ts',
    'store/process.d.ts',
    'store/process-schema.d.ts',
    'store/workflow.d.ts',
    'tool-execution.d.ts',
];

async function readText(path) {
    return readFile(path, 'utf8');
}

async function readOptional(path) {
    try {
        return await readText(path);
    } catch {
        return undefined;
    }
}

function cleanDeclarationContent(content) {
    return content
        .split('\n')
        .filter((line) => !line.startsWith('//# sourceMappingURL='))
        .join('\n')
        .trim();
}

function sha256(content) {
    return createHash('sha256').update(content).digest('hex');
}

function declarationSignature(content, start, declarationKind) {
    let braces = 0;
    let brackets = 0;
    let parentheses = 0;
    let sawBlock = false;
    let quote;
    let escaped = false;
    for (let index = start; index < content.length; index++) {
        const char = content[index];
        if (quote) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === quote) quote = undefined;
            continue;
        }
        if (char === '"' || char === "'" || char === '`') {
            quote = char;
            continue;
        }
        if (char === '{') {
            braces++;
            sawBlock = true;
        } else if (char === '}') {
            braces--;
            if (
                sawBlock &&
                ['interface', 'class', 'enum'].includes(declarationKind) &&
                braces === 0 &&
                brackets === 0 &&
                parentheses === 0
            ) {
                return content.slice(start, index + 1);
            }
        } else if (char === '[') brackets++;
        else if (char === ']') brackets--;
        else if (char === '(') parentheses++;
        else if (char === ')') parentheses--;
        else if (char === ';' && braces === 0 && brackets === 0 && parentheses === 0) {
            return content.slice(start, index + 1);
        }
    }
    return content.slice(start);
}

function localDeclarations(content, sourcePath) {
    const declarations = new Map();
    const matcher =
        /^(export\s+)?(?:declare\s+)?(interface|type|class|function|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
    for (const match of content.matchAll(matcher)) {
        const symbol = match[3];
        const kind = ['const', 'let', 'var'].includes(match[2]) ? 'variable' : match[2];
        const signature = declarationSignature(content, match.index, match[2]).trim();
        const existing = declarations.get(symbol);
        const card = {
            symbol,
            kind,
            import_kind: kind === 'interface' || kind === 'type' ? 'type' : 'value',
            signature: existing ? `${existing.signature}\n${signature}` : signature,
            source_path: sourcePath,
            source_sha256: sha256(content),
            directly_exported: Boolean(match[1]),
        };
        declarations.set(symbol, card);
    }
    return declarations;
}

async function resolveDeclarationModule(currentPath, specifier) {
    if (!specifier.startsWith('.')) return undefined;
    const raw = join(dirname(currentPath), specifier);
    const withoutRuntimeExtension = raw.replace(/\.(?:js|mjs|cjs)$/, '');
    for (const candidate of [`${withoutRuntimeExtension}.d.ts`, join(withoutRuntimeExtension, 'index.d.ts'), raw]) {
        if (await readOptional(candidate)) return candidate;
    }
    return undefined;
}

function parseNamedExports(raw) {
    return raw
        .split(',')
        .map((entry) => entry.trim().replace(/^type\s+/, ''))
        .filter(Boolean)
        .map((entry) => {
            const [source, alias] = entry.split(/\s+as\s+/);
            return { source: source.trim(), alias: (alias ?? source).trim() };
        });
}

async function moduleExports(path, root, memo = new Map(), visiting = new Set()) {
    if (memo.has(path)) return memo.get(path);
    if (visiting.has(path)) return new Map();
    visiting.add(path);
    const content = await readOptional(path);
    if (!content) {
        visiting.delete(path);
        return new Map();
    }
    const sourcePath = relative(root, path).replaceAll('\\', '/');
    const locals = localDeclarations(content, sourcePath);
    const exports = new Map(
        [...locals].filter(([, card]) => card.directly_exported).map(([name, card]) => [name, { ...card }]),
    );

    for (const match of content.matchAll(/^export\s+(?:type\s+)?\*\s+from\s+['"]([^'"]+)['"];?/gm)) {
        const target = await resolveDeclarationModule(path, match[1]);
        if (!target) continue;
        for (const [name, card] of await moduleExports(target, root, memo, visiting)) {
            if (!exports.has(name)) exports.set(name, card);
        }
    }
    for (const match of content.matchAll(/^export\s*\{([^}]+)\}(?:\s+from\s+['"]([^'"]+)['"])?;?/gm)) {
        const target = match[2] ? await resolveDeclarationModule(path, match[2]) : undefined;
        const targetExports = target ? await moduleExports(target, root, memo, visiting) : locals;
        for (const { source, alias } of parseNamedExports(match[1])) {
            const card = targetExports.get(source);
            if (card) exports.set(alias, { ...card, symbol: alias });
        }
    }
    visiting.delete(path);
    memo.set(path, exports);
    return exports;
}

async function moduleExportCards({ packageName, packageVersion, root, entryFile, importFrom }) {
    const exports = await moduleExports(join(root, entryFile), root);
    return [...exports.values()].map(({ directly_exported: _directlyExported, ...card }) => ({
        ...card,
        import_from: importFrom,
        import_example: `import${card.import_kind === 'type' ? ' type' : ''} { ${card.symbol} } from '${importFrom}';`,
        package: packageName,
        package_version: packageVersion,
    }));
}

async function generateSymbolIndex() {
    const packageVersions = Object.fromEntries(
        await Promise.all(
            Object.entries(PACKAGE_MANIFESTS).map(async ([name, path]) => {
                const manifest = JSON.parse(await readText(path));
                return [name, manifest.version];
            }),
        ),
    );
    const cards = [
        ...(
            await Promise.all(
                ['core', 'features', 'layout', 'router', 'session', 'widgets'].map((area) =>
                    moduleExportCards({
                        packageName: '@vertesia/ui',
                        packageVersion: packageVersions['@vertesia/ui'],
                        root: UI_TYPES_ROOT,
                        entryFile: `${area}/index.d.ts`,
                        importFrom: `@vertesia/ui/${area}`,
                    }),
                ),
            )
        ).flat(),
        ...(await moduleExportCards({
            packageName: '@vertesia/client',
            packageVersion: packageVersions['@vertesia/client'],
            root: CLIENT_TYPES_ROOT,
            entryFile: 'index.d.ts',
            importFrom: '@vertesia/client',
        })),
        ...(await moduleExportCards({
            packageName: '@vertesia/common',
            packageVersion: packageVersions['@vertesia/common'],
            root: COMMON_TYPES_ROOT,
            entryFile: 'index.d.ts',
            importFrom: '@vertesia/common',
        })),
    ];
    const deduplicated = new Map();
    for (const card of cards) {
        const key = `${card.import_from}\0${card.symbol}\0${card.kind}`;
        const existing = deduplicated.get(key);
        if (!existing || card.signature.length > existing.signature.length) deduplicated.set(key, card);
    }
    const symbols = [...deduplicated.values()].sort(
        (left, right) => left.symbol.localeCompare(right.symbol) || left.import_from.localeCompare(right.import_from),
    );
    const source = { format_version: 1, packages: packageVersions, symbols };
    return {
        ...source,
        index_version: sha256(JSON.stringify(source)),
    };
}

function generateFrontendImports() {
    return `# App Frontend Imports

This file is generated by \`@vertesia/appgen-docs\`.
Do not edit it by hand. Update the package generator or the UI package docs instead.

Use this reference before adding imports or package dependencies in generated Vertesia apps.

## Rules

- Prefer the existing template dependencies and the CDN/import-map packages below.
- Do not manually run \`npm install\` or \`pnpm install\` in the app workspace. \`app_dev_server_start\` owns install and typecheck.
- Do not add \`react-router-dom\`; Vertesia apps use \`@vertesia/ui/router\`.
- Do not import from bare \`@vertesia/ui\`; it has no package root export. Use subpath imports.
- Use public subpath imports only. Never import from generated declaration/source paths such as
  \`@vertesia/ui/core/shadcn/*\`, \`@vertesia/ui/core/toast\`, or any path shown in
  \`appgen/ui-interfaces.d.ts\` section comments.
- Do not add another UI framework to make guessed component code compile. If an API is uncertain, use \`ui/llms.txt\` and \`appgen/ui-interfaces.d.ts\`, or use plain JSX with Tailwind classes.
- CDN availability only means a library can be imported/bundled. It does not mean it is the right default for generated apps.
- If a component export is not confirmed, use plain HTML elements with Tailwind classes instead of guessing a shadcn/Radix import.
- For generated app-level chrome, prefer plain JSX (\`<aside>\`, \`<main>\`, \`<header>\`, \`<nav>\`) with Tailwind classes over \`@vertesia/ui/layout\` shell components unless you have checked exact props in \`appgen/ui-interfaces.d.ts\`.

## Vertesia Imports

Use these subpaths:

\`\`\`ts
import { useUserSession } from '@vertesia/ui/session';
import { RouterProvider, NavLink, useNavigate, useLocation, useParams } from '@vertesia/ui/router';
import { Button, Badge, Input, Textarea, Spinner, Modal, ModalTitle, ModalBody, ModalFooter } from '@vertesia/ui/core';
import { Table, THead, TBody, TR, SelectBox, SelectList, useFetch, useToast } from '@vertesia/ui/core';
import { GenericPageNavHeader, ModernAgentConversation } from '@vertesia/ui/features';
import { MarkdownRenderer } from '@vertesia/ui/widgets';
\`\`\`

Common pitfalls:

- Toasts: \`const toast = useToast(); toast({ title: 'Saved' });\`. Do not import \`toast\`.
- Textarea: \`import { Textarea } from '@vertesia/ui/core'\`. Do not import from \`core/shadcn/textarea\`.
- Selects: use \`SelectBox\` or \`SelectList\`; there is no \`SelectTrigger\`/\`SelectItem\` export.
- Tables: use \`Table\`, \`THead\`, \`TBody\`, \`TR\`; there are no \`TableHeader\`/\`TableRow\`/\`TableCell\` exports.
- Store search: \`client.objects.search(...)\` returns \`ObjectSearchResponse\` with \`results\`.
  Use \`ContentObjectItem\`, \`ContentObject\`, and \`ObjectSearchResponse\` from \`@vertesia/common\`;
  do not import \`SearchResult\`, \`DocumentSearchResult\`, or \`ContentObjectType\` from \`@vertesia/client\`.
  Generated app UI should use \`client.objects.search({ query: { type, match }, limit })\` for Store reads;
  reserve \`objects.find()\` and \`objects.list()\` for platform/debug code, not normal customer app data loading.
- Vertesia SDK methods must stay attached to their client topic. Do not assign/destructure methods like
  \`const search = client.objects.search; await search(...)\`; call \`await client.objects.search(...)\` instead
  so the SDK keeps its request context.
- Charts: use Vega-based charting (\`react-vega\`, \`vega-lite\`, \`vega-embed\`) for core analytics,
  dashboard pages, and data-exploration views because Vega specs can be wired cleanly to rows from
  Store search, object aggregation, and Data Store queries. Recharts is acceptable only for simple
  non-core visual summaries when the app explicitly includes it as a dependency.
  For React-rendered Vega-Lite charts, use \`import { VegaEmbed } from 'react-vega'\`; do not import
  \`Vega\`, \`VegaLite\`, or \`VegaLiteChart\` from \`react-vega\`.
  Render with \`<VegaEmbed spec={spec} options={{ actions: false }} />\`; do not pass
  \`actions={false}\` directly because React forwards that unknown prop to the DOM and the design
  renderer treats the resulting console warning as a render failure.

## Recommended App Defaults

Start with:

- \`react\`, \`react-dom\`
- \`@vertesia/ui\`, \`@vertesia/client\`, \`@vertesia/common\`
- \`@vertesia/tools-sdk\` and \`hono\` for service-target apps with package capabilities
- \`lucide-react\` for icons
- \`react-vega\`, \`vega\`, \`vega-lite\`, and \`vega-embed\` for analytics/dashboard charts backed by Store search or Data Store query rows
- \`react-markdown\`, \`remark-gfm\`, and \`rehype-katex\` for markdown/document rendering
- \`papaparse\`, \`xlsx\`, or \`docx\` only when the requested workflow needs file parsing or export

## Runtime CDN Imports

The documentation synchronizer replaces this section with the import specifiers exposed by the
actual Vertesia UI deployment used by the app agent. If no catalog appears below, CDN discovery
failed and package availability must be verified before adding a dependency.
`;
}

function generateUiComponentsRecipe() {
    return `# UI Components Recipe

This recipe is generated with the installed \`@vertesia/ui\` version. Use it for common app screens instead of
searching dependency source. For an API not covered here, search \`appgen/ui-interfaces.d.ts\` once by exact symbol.

For a current-project interaction catalog built with the table, button, and fetch APIs below, this recipe is complete.
After reading it, do not search generated declarations or dependency source for \`Table\`, \`TBody\`, \`useFetch\`, or
the interaction catalog merely to reconfirm these signatures. Implement the screen and let the first workspace typecheck
identify any real version drift; only then search once for the exact symbol named by that diagnostic.

## Imports

\`\`\`tsx
import {
    Button,
    Table,
    TableHeaderCell,
    TBody,
    THead,
    TR,
    useFetch,
} from '@vertesia/ui/core';
\`\`\`

These are runtime React values, not types. Import \`Table\`, \`TBody\`, \`THead\`, \`TR\`, \`TableHeaderCell\`, \`Button\`,
and \`useFetch\` with a normal \`import\`; using \`import type\` makes JSX fail with TS1361.

## Loading table with refresh

\`TBody.columns\` is required. It is the number of rendered columns and drives the loading skeleton.
Use \`TableHeaderCell\` instead of raw \`<th>\` so column scope is accessible by default.

\`\`\`tsx
const { data = [], error, isLoading, refetch } = useFetch(loadRows, { deps: [projectId], defaultValue: [] });

<Button type="button" onClick={() => void refetch()} isLoading={isLoading}>
    Refresh
</Button>

{error ? <p role="alert">{error.message}</p> : null}
<Table>
    <THead>
        <TR>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
        </TR>
    </THead>
    <TBody columns={2} isLoading={isLoading}>
        {data.map((row) => (
            <TR key={row.id}>
                <td>{row.name}</td>
                <td>{row.status}</td>
            </TR>
        ))}
    </TBody>
</Table>
{!isLoading && !error && data.length === 0 ? <p>No results found.</p> : null}
\`\`\`

## Stable signatures

- \`useFetch<T>(fetcher, { deps, defaultValue, onSuccess, onError })\` returns
  \`{ data, isLoading, error, setData, refetch }\`.
- \`TBody\` accepts \`{ columns: number; isLoading?: boolean; rows?: number; children: ReactNode }\`.
- \`Button\` accepts normal button props plus \`isLoading\`, \`isDisabled\`, \`variant\`, and \`size\`.
- Icon-only buttons need \`aria-label\`. Text buttons should keep their visible text in the accessible name.
- Use a native \`<section aria-label="…">\` for a labeled table/overflow region. Do not put \`role="region"\` on a
  \`<div>\`; Biome's \`lint/a11y/useSemanticElements\` requires the semantic element.
- Prefer semantic theme classes and plain HTML for layout. Do not guess private \`@vertesia/ui\` paths.

## Generated app tests

- The standard generated app runs Vitest in a Node environment and intentionally does not install jsdom,
  happy-dom, or Testing Library. Do not search dependency trees or add a DOM-test dependency for a UI-only change.
- Put loading/error/empty/populated/refresh decisions in a separate production \`*.state.ts\` or \`*.model.ts\` module
  imported and used by the component. Cover that state matrix by importing the pure module directly from the focused unit
  test. Do not export the helper only from the component's TSX module: importing that file also loads the real
  \`@vertesia/ui\` runtime, which the standard Node-only Vitest environment cannot execute. Do not copy the helper into
  the test or walk rendered React element internals; the tested module must remain on the production import path.
- Source Playwright specs import \`type { Page }\` from \`@playwright/test\` and \`{ expect, test }\` from
  \`./vertesia\`. Type shared helpers as \`page: Page\`; never hand-write a structural Page or Route type because
  Playwright's overloaded callbacks will reject narrower substitutes. Use \`page.route\` to mock only the real API
  path involved in the primary flow (interaction listing uses a path containing \`/interactions\`), then exercise the
  page through accessible roles. Use the declared \`test:e2e\` script and its \`PLAYWRIGHT_BASE_URL\`; do not invent a
  second browser harness.
- Scope repeated text to its semantic container and request an exact accessible name. For example, use
  \`table.getByRole('cell', { name: interactionName, exact: true })\` when the same name can also occur in tags or
  descriptions; an unscoped text or name locator can match several elements and waste a browser retry.
- For a responsive table, prove document-level overflow is absent and intentional overflow stays on one labeled table
  region. Assert positive horizontal overflow only at the narrow viewport—a desktop table may fit—and scroll that region
  before using \`toBeInViewport()\` on the final required column. DOM presence or \`toBeVisible()\` alone does not prove an
  off-screen mobile column is reachable.
`;
}

function generateClientInteractionsRecipe() {
    return `# Current-project Interactions Recipe

This recipe is generated with the installed \`@vertesia/client\` and \`@vertesia/common\` versions. Use it instead
of searching dependency source for the browser client signature.

## List interactions from React

\`\`\`tsx
import type { InteractionRef } from '@vertesia/common';
import { useFetch } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';

export function InteractionCatalog() {
    const { client } = useUserSession();
    const { data = [] } = useFetch<InteractionRef[]>(() => client.interactions.list(), {
        deps: [client],
        defaultValue: [],
    });

    return <ul>{data.map((interaction) => <li key={interaction.id}>{interaction.name}</li>)}</ul>;
}
\`\`\`

## Stable signatures

- \`client.interactions.list(payload?: InteractionSearchPayload): Promise<InteractionRef[]>\`.
- Empty input is valid. Use \`client.interactions.list()\` unless the task requires a server-side filter.
- The useful \`InteractionRef\` fields are \`id\`, \`name\`, \`endpoint\`, \`description?\`, \`status\`, \`version\`,
  \`tags\`, and \`updated_at\`.
- \`InteractionRef\` deliberately has no \`type\` field. When a current-project catalog must display type, call
  \`client.interactions.catalog.listStoredInteractions()\`, which returns \`Promise<CatalogInteractionRef[]>\`; do not
  search generated declarations for \`InteractionRef.type\` or infer it from another field.
- \`listStoredInteractions()\` sends \`GET /api/v1/interactions/catalog/stored\` (plus optional \`status\` or \`tag\`
  query parameters). Its JSON response is the bare \`CatalogInteractionRef[]\` array, never an \`{ items: [...] }\`
  wrapper. A focused Playwright mock can route \`**/api/v1/interactions/catalog/stored**\` and fulfill that bare array.
- The useful \`CatalogInteractionRef\` fields are \`type\` (\`'stored'\` for this endpoint), \`id\`, \`name\`, \`title\`,
  \`description?\`, \`version?\`, and \`tags\`. Use \`client.interactions.catalog.list()\` only when the task explicitly
  asks for the combined system, app, and stored catalog rather than the current project's stored interactions.
- This recipe fully specifies the method, return type, endpoint, and response shape. Do not probe the live API, inspect
  \`node_modules\`, or call \`app_docs_grep\`/\`app_docs_read\` to reconfirm them. Treat a concrete workspace typecheck or
  Playwright failure as the only reason to inspect one exact symbol afterward.
- Keep SDK methods attached to their topic: call \`client.interactions.list()\`; do not destructure \`list\`.
- The session client is already scoped to the signed-in user's current project. Do not construct another client in
  browser code and do not hardcode a project id.
- For schemas, use \`client.interactions.export({})\`; for the normal catalog, use \`list()\`.
`;
}

function generateHandlebarsPrompts() {
    return `# Handlebars Prompts

Use this when creating app-owned prompts and interactions in a Vertesia app package.

## Rule

New app-owned prompts should be Handlebars prompt files. Prefer \`.hbs?prompt\` files with YAML frontmatter for prompt metadata, then import those prompt definitions into the app's interaction collection.

Do not create new JST prompts, plain-text prompt segments, or large inline TypeScript prompt strings unless a tiny dynamic wrapper is unavoidable.

Every app-owned agent/system prompt should include current execution time near the top:

\`\`\`handlebars
Today's date is {{_now}}.
\`\`\`

## Helpers

Registered Handlebars helpers:

| Name | Description | Example |
| --- | --- | --- |
| \`_now\` | Current ISO timestamp at render time. | \`Report generated at {{_now}}\` |
| \`stringify\` | Converts a value to JSON. Null/undefined become an empty string; strings are returned unchanged. | \`Input: {{stringify data}}\` |

Standard Handlebars block helpers are available:

| Name | Description | Example |
| --- | --- | --- |
| \`if\` / \`unless\` | Conditional rendering. | \`{{#if flag}}Enabled{{else}}Disabled{{/if}}\` |
| \`each\` | Iterate arrays or objects. | \`{{#each items}}- {{this.name}}{{/each}}\` |
| \`with\` | Change the current evaluation context. | \`{{#with user}}{{name}}{{/with}}\` |

Execution variables:

| Name | Description | Example |
| --- | --- | --- |
| \`_model\` | Model id when injected by the execution runner. It may be absent in preview/render contexts unless supplied as input. | \`Model: {{_model}}\` |

No custom \`default\` helper is registered. Use an \`if\`/\`else\` block:

\`\`\`handlebars
Priority: {{#if priority}}{{priority}}{{else}}standard{{/if}}
\`\`\`

## Prompt File Pattern

\`\`\`handlebars
---
name: supplier-capa-risk-review
title: Supplier CAPA Risk Review
role: user
content_type: handlebars
schema:
  type: object
  properties:
    capa_record:
      type: object
    focus:
      type: string
  required: [capa_record]
---
Review this supplier CAPA record.

Today's date is {{_now}}.

Record:
{{stringify capa_record}}

{{#if focus}}
Focus: {{focus}}
{{/if}}
\`\`\`

Import the prompt definition in TypeScript and include it in the interaction collection:

\`\`\`ts
import reviewPrompt from './prompts/supplier-capa-risk-review.hbs?prompt';

export const interactions = new InteractionCollection({
    name: 'supplier-capa',
    interactions: [
        {
            name: 'risk-review',
            title: 'Supplier CAPA Risk Review',
            prompts: [reviewPrompt],
            agent_runner_options: { is_agent: false },
        },
    ],
});
\`\`\`

For system prompts, keep the \`{{_now}}\` line in the system prompt itself. User prompts can include it when date-sensitive inputs matter, but system prompts are the default place.
`;
}

function generateAppPackagePatterns() {
    return `# App Package Patterns

Generated Vertesia apps expose portable capabilities from their service package. The build script writes:

- \`dist/app-package.json\`: full package payload from the built server
- \`dist/app-package-summary.json\`: compact runtime package inventory
- \`dist/app-quality-report.json\`: source-level quality and artifact inventory

Before publish, run the full service build:

\`\`\`sh
pnpm run service:build
\`\`\`

For package-only checks during authoring, run:

\`\`\`sh
pnpm run service:build:server
\`\`\`

The output must list the package artifacts. If an expected type, interaction, prompt, process, view, dashboard, template, widget, activity, hook, subscription, tool, or seed script is missing from the summary, fix the exports before publishing.

## ServerConfig Checklist

\`src/modules/app/resources/<kind>/index.ts\` should export every user-owned collection or definition array. The generated \`src/tool-server/app-server-modules.ts\` aggregates active modules, and \`src/tool-server/config.ts\` consumes that generated wiring:

\`\`\`ts
import type { ToolServerConfig } from '@vertesia/tools-sdk';
import {
  activities,
  dashboards,
  hooks,
  interactions,
  mcpProviders,
  processes,
  skills,
  subscriptions,
  templates,
  tools,
  types,
  views,
} from './app-server-modules.js';

export const ServerConfig = {
  prefix: '/api',
  tools,
  activities,
  interactions,
  types,
  skills,
  templates,
  dashboards,
  processes,
  views,
  hooks,
  subscriptions,
  mcpProviders,
} satisfies ToolServerConfig;
\`\`\`

The app module must provide a typed empty default for every supported contribution kind, even when the app does not
currently register one. When adding a new contribution kind to the template, export its default from
\`src/modules/app/resources\`, add it to the codegen \`SERVER_RESOURCES\` list, and let codegen regenerate
\`src/tool-server/app-server-modules.ts\`. Do not put app-owned registries directly under \`src/tool-server\`.

If a capability is authored in source but absent from the package summary, check that:

1. the capability collection exports from its own \`index.ts\`
2. \`src/modules/app/resources/<kind>/index.ts\` includes that collection or definition
3. \`src/modules/app/resources/index.ts\` re-exports the capability kind
4. \`pnpm run service:build:server\` passes

Prefer app-owned package artifacts over tenant-local Studio/Zeno DB configuration for product behavior. Runtime/test data belongs in Store objects that use app-owned type refs such as \`app:my-app:case\`.
`;
}

function generatePackageTypes() {
    return `# App-Owned Types

Use app-owned in-code type definitions for schema owned by the generated app. Do not create tenant-local stored content types for product-owned schema unless the user explicitly asks for project-local configuration.

## Type refs

Use stable app refs in runtime data and UI code:

\`\`\`ts
const APP_NAME = 'my-business-app'; // MUST equal package.json name === VITE_APP_NAME === manifest name
const CASE_TYPE = \`app:\${APP_NAME}:case\`;
const TASK_TYPE = \`app:\${APP_NAME}:task\`;
\`\`\`

> **App-owned types are in-code strings, not ObjectIds.** A Store object's \`type\` is EITHER a stored-type ObjectId OR an in-code-type string \`app:<app-name>:<local>\`. Portable apps MUST pass the in-code string directly to \`objects.create\`/\`objects.search\` — the platform resolves it from the app package (including during preview, for the app owner, before install). NEVER resolve an app-owned type to a project-local ObjectId (e.g. a \`types.list({ name })\`→id lookup or a \`useTypeIds\` hook): that bakes in one project's id and breaks the app the moment it is installed anywhere else. Derive every \`app:\` ref from the single \`APP_NAME\` constant; never paste the literal app name into a ref.

> **For TYPES, \`<local>\` is the declared type \`name\` — bare, no collection segment.** \`app:<name>:case\` is correct; \`app:<name>:cases:case\` is only a legacy alias. The \`ContentTypesCollection\` is code organization, not identity, so type names MUST be unique across collections (the package build fails on duplicates). This differs from interactions/activities, whose ids DO include the collection (\`app:<name>:<collection>:<interaction>\`).

When creating or searching Store objects, pass the app type code string:

\`\`\`ts
await client.objects.create({
  name: 'Supplier review',
  type: CASE_TYPE,
  properties: {
    title: 'Supplier review',
    status: 'open',
    seed_marker: \`appgen:\${APP_NAME}\`,
  },
});

const { results } = await client.objects.search({
  query: {
    type: CASE_TYPE,
    match: { 'properties.seed_marker': \`appgen:\${APP_NAME}\` },
  },
  limit: 50,
});
\`\`\`

## Package source

Define package types under \`src/modules/app/resources/types/<domain>/index.ts\` and export their collection from \`src/modules/app/resources/types/index.ts\`. Generated module wiring includes that array in \`ServerConfig.types\`.

\`\`\`ts
import type { InCodeTypeSpec } from '@vertesia/common';
import { ContentTypesCollection } from '@vertesia/tools-sdk';

const caseType = {
  name: 'case',
  title: 'Compliance Case',
  description: 'App-owned case record.',
  tags: ['compliance'],
  object_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      status: { type: 'string' },
      owner: { type: 'string' },
      seed_marker: { type: 'string' },
    },
    required: ['title', 'status'],
  },
} satisfies InCodeTypeSpec;

export const ComplianceTypes = new ContentTypesCollection({
  name: 'compliance',
  title: 'Compliance Types',
  types: [caseType],
});
\`\`\`

\`src/modules/app/resources/types/index.ts\`:

\`\`\`ts
import { ComplianceTypes } from './compliance/index.js';

export const types = [ComplianceTypes];
\`\`\`

Keep generated apps portable: schema and behavior live in the app package; seeded records live in the Store and use installed app type refs.
`;
}

function generateStoreObjects() {
    return `# Store Object Search And Seeding

Use the Vertesia client from \`useUserSession()\` in browser code and the injected token/client in app workspace scripts. Prefer \`client.objects.search\` over list/find guessing.

App-owned types are referenced by their **in-code string** \`app:<app-name>:<local>\`, never a resolved ObjectId — pass the string straight to \`search\`/\`create\` and derive it from a single \`APP_NAME\` constant (= package.json name = VITE_APP_NAME = manifest name) so the app stays portable. See \`package-types.md\` for the rule.

Every \`objects.create\` payload requires a top-level \`name\`. A title inside \`properties\` does not satisfy this Store contract. Use a stable human-readable value, normally the record title, and keep it in sync when the product renames the record.

## Search

\`\`\`ts
const APP_NAME = 'my-app'; // = package.json name = VITE_APP_NAME = manifest name
const CASE_TYPE = \`app:\${APP_NAME}:case\`;

const { results, count } = await client.objects.search({
  query: {
    type: CASE_TYPE,
    match: { 'properties.seed_marker': \`appgen:\${APP_NAME}\` },
  },
  limit: 100,
  offset: 0,
});
\`\`\`

For text search:

\`\`\`ts
const { results } = await client.objects.search({
  query: {
    type: CASE_TYPE,
    full_text: searchText,
    match: { 'properties.status': 'open' },
  },
  limit: 25,
});
\`\`\`

## Idempotent seed

Always mark generated records so they can be counted, updated, and cleaned up safely.

\`\`\`ts
import type { VertesiaClient } from '@vertesia/client';

const APP_NAME = 'my-app';
const SEED_MARKER = \`appgen:\${APP_NAME}\`;
const CASE_TYPE = \`app:\${APP_NAME}:case\`;

async function seedCase(client: VertesiaClient, record: { external_id: string; title: string }) {
  const existing = await client.objects.search({
    query: {
      type: CASE_TYPE,
      match: {
        'properties.seed_marker': SEED_MARKER,
        'properties.external_id': record.external_id,
      },
    },
    limit: 1,
  });

  if (existing.results?.[0]?.id) {
    return client.objects.update(existing.results[0].id, {
      properties: { ...record, seed_marker: SEED_MARKER },
    });
  }

  return client.objects.create({
    name: record.title,
    type: CASE_TYPE,
    properties: { ...record, seed_marker: SEED_MARKER },
  });
}
\`\`\`

## Markdown source content

For document, review, and intake apps, attach realistic source content to representative objects instead of only creating properties.

\`\`\`ts
await client.objects.create({
  name: 'Screening evidence',
  type: \`app:\${APP_NAME}:evidence\`,
  properties: {
    title: 'Screening evidence',
    seed_marker: SEED_MARKER,
  },
  text: [
    '# Screening Evidence',
    '',
    'Denied party screening completed for shipment GTC-1001.',
    '',
    '- Result: potential hit',
    '- Reviewer: trade compliance',
  ].join('\\n'),
});
\`\`\`

If the exact source attachment API differs in the installed SDK, write the intended create code first, then run \`app_workspace_typecheck\` and fix from compiler diagnostics. Do not spend more than five docs lookups rediscovering the object shape.
`;
}

function generateInteractionRuntime() {
    return `# Installed Capability Runtime Execution

Use the root \`VertesiaClient\` for app-owned interaction execution. For an immutable candidate, call \`client.withAppVersion(versionId)\` once before any Studio or Store request.

## Interactions

\`executeByName\` accepts the portable app interaction ref and an \`InteractionExecutionPayload\`. Put prompt inputs under \`data\`; the returned result is already enhanced with typed accessors.

\`\`\`ts
interface StatusBriefingInput {
  project_id: string;
  tasks: Array<{ id: string; title: string; status: string }>;
}

interface StatusBriefingResult {
  summary: string;
  evidence: Array<{ id: string; title: string; status: string }>;
}

const execution = await client.interactions.executeByName<StatusBriefingResult, StatusBriefingInput>(
  \`app:\${APP_NAME}:main:project-status-briefing\`,
  { data: input },
);
const briefing = execution.result.object();
\`\`\`

Use \`execution.result.text()\` for text output and \`execution.result.objects()\` for multiple JSON results. Validate the parsed object against the exact durable input snapshot before displaying or persisting it. Do not reimplement \`/api/v1/execute\` with raw \`fetch\`.

## Processes and activities

Installed app activities are internal process nodes. The root SDK has no \`client.activities\` execution API, so exercise an activity through a packaged process that references it. Start processes through the Store agent API; \`client.processes\` manages definitions and has no \`executeByName\` method.

\`\`\`ts
const run = await client.agents.start({
  process_id: \`app:\${APP_NAME}:milestone-transition\`,
  run_type: 'programmatic',
  data: { milestone_id, target_status: 'complete' },
});
await client.agents.streamMessages(run.id);
const terminal = await client.agents.retrieveProcess(run.id);
const { context } = await client.agents.getContext(run.id);
if (terminal.status !== 'completed') {
  throw new Error(String(context.error ?? terminal.status));
}
\`\`\`

A package summary containing an activity proves registration only, not runtime execution. Unit-test the exact interaction and process call shapes with focused SDK mocks before constructing an immutable candidate. Never invent \`client.activities.executeByName\` or \`client.processes.executeByName\`.
`;
}

function generateUiQuickReference() {
    return `# @vertesia/ui Quick Reference

This bundled fallback exists so \`app_docs_grep\` with \`kind: "ui"\` always returns a bounded result even when the remote design docs are unavailable.

Use these imports in generated app UI:

\`\`\`ts
import { Button, Badge, Table, VTabs, useFetch, useToast } from '@vertesia/ui/core';
import { NavLink, NestedRouterProvider, type Route } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import { VertesiaShell } from '@vertesia/ui/shell';
\`\`\`

Rules:

- Use \`useUserSession().client\` for Vertesia API calls.
- Use \`NavLink href\`, not \`to\`.
- Use semantic Tailwind tokens such as \`bg-background\`, \`bg-card\`, \`border-border\`, \`text-muted\`, \`text-success\`, \`text-attention\`, and \`text-destructive\`.
- Default to a light, compact Studio-native operational UI.
- Do not import \`react-router-dom\` or \`@tanstack/react-query\` in generated apps.
`;
}

function generateAppPackageProcesses() {
    return `# App Package Processes

Use this when a Vertesia app needs to expose process definitions through its service package.

## Registering Processes

App package processes are exposed as \`InCodeProcessDefinition\` objects registered on the tool server config.

For non-trivial processes, prefer a YAML/YML file as the app-owned source of truth. The service can load/parse that YAML into the native JSON \`ProcessDefinitionBody\` that Studio validates and installs. If you must keep the definition in TypeScript, keep it small, explicit, and validate it before publish.

## Preferred YAML Source

\`\`\`yaml
format_version: 1
process: creative_ops_pipeline
description: Run the campaign creative operations workflow.
initial: brief_intake
context:
  schema:
    type: object
    properties:
      campaign_id:
        type: string
      asset_ids:
        type: array
        items:
          type: string
      approved:
        type: boolean
      notes:
        type: string
    additionalProperties: true
  initial:
    campaign_id: ""
    asset_ids: []
    approved: false
    notes: ""
nodes:
  brief_intake:
    type: human_task
    title: Brief intake
    task:
      title: Review campaign brief
      description: Confirm the campaign is ready for creative production.
      assignee: group:marketing-ops
      fields:
        - name: approved
          label: Approved
          type: boolean
          required: true
        - name: notes
          label: Review notes
          type: text
    writes:
      - approved
      - notes
    transitions:
      - to: done
        trigger: user
  done:
    type: final
    title: Intake complete
\`\`\`

Register the parsed definition in \`ServerConfig.processes\`:

\`\`\`ts
import type { InCodeProcessDefinition, ProcessDefinitionBody } from '@vertesia/common';
import type { ToolServerConfig } from '@vertesia/tools-sdk';

const creativeOpsPipelineDefinition: ProcessDefinitionBody = {
  format_version: 1,
  process: 'creative_ops_pipeline',
  description: 'Run the campaign creative operations workflow.',
  initial: 'brief_intake',
  context: {
    schema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string' },
        asset_ids: { type: 'array', items: { type: 'string' } },
        approved: { type: 'boolean' },
        notes: { type: 'string' },
      },
      additionalProperties: true,
    },
    initial: {
      campaign_id: '',
      asset_ids: [],
      approved: false,
      notes: '',
    },
  },
  nodes: {
    brief_intake: {
      type: 'human_task',
      title: 'Brief intake',
      task: {
        title: 'Review campaign brief',
        description: 'Confirm the campaign is ready for creative production.',
        assignee: 'group:marketing-ops',
        fields: [
          { name: 'approved', label: 'Approved', type: 'boolean', required: true },
          { name: 'notes', label: 'Review notes', type: 'text' },
        ],
      },
      writes: ['approved', 'notes'],
      transitions: [{ to: 'done', trigger: 'user' }],
    },
    done: {
      type: 'final',
      title: 'Intake complete',
    },
  },
};

export const processes = [
  {
    id: 'creative-ops-pipeline',
    name: 'creative_ops_pipeline',
    title: 'Creative Ops Pipeline',
    description: 'Campaign creative operations workflow.',
    tags: ['creative-ops'],
    definition: creativeOpsPipelineDefinition,
  },
] satisfies InCodeProcessDefinition[];

export const ServerConfig = {
  prefix: '/api',
  processes,
  // tools, interactions, types, dashboards, templates...
} satisfies ToolServerConfig;
\`\`\`

The app package endpoint serializes \`ServerConfig.processes\`:

- \`GET /api/package?scope=processes\` returns \`{ processes: [...] }\`.
- \`GET /api/processes\` lists registered processes.
- \`GET /api/processes/:name\` retrieves by \`id\`, \`name\`, or \`definition.process\`.

The standard \`pnpm run service:build:server\` package writer validates every packaged process before it writes \`dist/app-package.json\`. Always also run \`validate_process_definition\` on the parsed JSON definition while authoring so failures are found before publish. Treat validation failures as blocker app-code issues. The tool input is the native JSON definition, not the raw YAML string:

\`\`\`json
{
  "definition": {
    "format_version": 1,
    "process": "creative_ops_pipeline",
    "initial": "brief_intake",
    "context": {
      "schema": {
        "type": "object",
        "properties": {
          "campaign_id": { "type": "string" },
          "approved": { "type": "boolean" },
          "notes": { "type": "string" }
        },
        "additionalProperties": true
      },
      "initial": {
        "campaign_id": "",
        "approved": false,
        "notes": ""
      }
    },
    "nodes": {
      "brief_intake": {
        "type": "human_task",
        "task": {
          "title": "Review campaign brief",
          "fields": [
            { "name": "approved", "type": "boolean", "required": true },
            { "name": "notes", "type": "text" }
          ]
        },
        "writes": ["approved", "notes"],
        "transitions": [{ "to": "done", "trigger": "user" }]
      },
      "done": { "type": "final" }
    }
  }
}
\`\`\`

## Shape

\`InCodeProcessDefinition\`:

\`\`\`ts
interface InCodeProcessDefinition {
  id: string;
  name: string;
  title?: string;
  description?: string;
  tags?: string[];
  definition: ProcessDefinitionBody;
}
\`\`\`

\`ProcessDefinitionBody\` requires:

- \`format_version: 1\`
- \`process\`: stable process name
- \`initial\`: first node id
- \`context: { schema, initial }\`
- \`nodes\`: record of node ids to process nodes

Common node types are \`tool\`, \`interaction\`, \`agent\`, \`script\`, \`human_task\`, \`foreach\`, \`branch\`, \`condition\`, \`process\`, and \`final\`.

Transition rules:

- Use \`transitions: [{ to: "node_id" }]\`; do not use \`target\`.
- \`branch\` and \`condition\` nodes use \`branches: [{ to: "node_id" }]\`.
- A \`human_task\` node must include \`task.title\` and \`task.fields\`; fields support \`string\`, \`number\`, \`boolean\`, \`select\`, and \`text\`.
- A \`script\` node references an embedded bundle in top-level \`resources.scripts\`. Scripts read \`VERTESIA_PROCESS_INPUT\`, write JSON to \`VERTESIA_PROCESS_RESULT\`, and may place artifacts under \`VERTESIA_PROCESS_OUT_DIR\`. JavaScript and TypeScript sandboxes include \`@vertesia/client\`; import it without adding it to the resource's packages.

## App Manifest

When publishing a service app that exposes processes, ensure the app manifest/capabilities include \`processes\` and publish with \`target: "service"\`.

Studio normalizes app process ids to \`app:<app-name>:<id>\` when returning installed app processes.
`;
}

async function generateToolServerResourceReference() {
    const content = await readOptional(TOOL_SERVER_RESOURCE_REFERENCE_PATH);
    if (!content || content.trim().length === 0) {
        throw new Error(
            `generate-docs: tool-server resource reference not found or empty at ${TOOL_SERVER_RESOURCE_REFERENCE_PATH}. ` +
                'The plugin template reference is required to build @vertesia/appgen-docs.',
        );
    }
    return `<!-- Generated by @vertesia/appgen-docs from
templates/plugin-template/.agents/skills/vertesia-tool-server-resource/REFERENCE.md.
Do not edit the generated file. -->

${content.trim()}
`;
}

function generateAppPackageDashboards() {
    return `# App Package Dashboards

Use this when a Vertesia app contributes analytics dashboards through its service package.

This covers how an **app package** registers dashboards. For Vega-Lite spec authoring (mark types, encodings, vconcat/hconcat layout, cross-panel selections), read \`data-platform/dashboards.md\` — do not duplicate spec details here.

## Registering Dashboards

App dashboards are \`AppDashboardDefinition\` objects on \`ToolServerConfig.dashboards\`. Each is exposed by the host as \`app:<app-name>:<id>\` and is read-only until a user clones it into a stored dashboard. They render over live Store/Data-Platform data, so there are no per-project dashboard records to seed.

\`\`\`ts
import type { AppDashboardDefinition } from '@vertesia/common';
import type { ToolServerConfig } from '@vertesia/tools-sdk';

export const dashboards: AppDashboardDefinition[] = [
  {
    id: 'claims-by-status',
    title: 'Claims by status',
    description: 'Open vs. resolved claims over the last 30 days.',
    tags: ['claims'],
    // SQL shortcut for dashboards backed by a Data Platform data store.
    query: \`
      SELECT status, COUNT(*) AS count
      FROM claims
      WHERE created_at >= {{since}}
      GROUP BY status
    \`,
    queryParameters: { since: '2026-05-01' },
    queryLimit: 1000,
    // Vega-Lite spec. The query result is injected as the default data source
    // (data.values) — see data-platform/dashboards.md for spec authoring.
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      mark: 'bar',
      encoding: {
        x: { field: 'status', type: 'nominal' },
        y: { field: 'count', type: 'quantitative' },
      },
    },
  },
] satisfies AppDashboardDefinition[];

export const ServerConfig = {
  prefix: '/api',
  dashboards,
  // tools, interactions, types, processes, templates...
} satisfies ToolServerConfig;
\`\`\`

The app package endpoint serializes \`ServerConfig.dashboards\`:

- \`GET /api/package?scope=dashboards\` returns \`{ dashboards: [...] }\`.
- \`GET /api/dashboards\` lists registered dashboards.
- \`GET /api/dashboards/:id\` retrieves by \`id\`, \`name\`, or \`title\`.

## Data Sources

A dashboard gets its rows from exactly one source. Pick the path that matches the backend:

- **Data Platform SQL** — use the \`query\` shortcut (string) as above, or the explicit form \`dataSource: { kind: 'data_sql', query, queryLimit?, queryParameters? }\`. SQL is SELECT-only and supports \`{{param}}\` placeholders; defaults come from \`queryParameters\`.
- **Store Elasticsearch DSL** — \`dataSource: { kind: 'store_es_dsl', dsl, result? }\`. The DSL runs through the secured Store query API (project/security filtering stays server-side). \`result\` maps the response into Vega rows: \`{ type: 'hits' }\` (default) or \`{ type: 'aggregation_buckets', path, keyField?, countField? }\`.

\`\`\`ts
{
  id: 'docs-by-type',
  title: 'Documents by type',
  dataSource: {
    kind: 'store_es_dsl',
    dsl: { aggs: { by_type: { terms: { field: 'type' } } }, size: 0 },
    result: { type: 'aggregation_buckets', path: 'by_type', keyField: 'type', countField: 'count' },
  },
  spec: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    mark: 'arc',
    encoding: {
      theta: { field: 'count', type: 'quantitative' },
      color: { field: 'type', type: 'nominal' },
    },
  },
}
\`\`\`

## Shape

\`AppDashboardDefinition\`:

\`\`\`ts
interface AppDashboardDefinition {
  id: string;                 // local app dashboard id; exposed as app:<app-name>:<id>
  name?: string;              // defaults to id
  title?: string;             // defaults to name or id
  description?: string;
  tags?: string[];
  dataSource?: DashboardDataSource;       // DashboardSqlDataSource | DashboardStoreElasticsearchDataSource
  query?: string;             // SQL shortcut for data-store-backed dashboards
  queryLimit?: number;
  queryParameters?: Record<string, string>;
  spec?: Record<string, unknown>;          // complete Vega-Lite spec
  // Deprecated — do not use in new app packages:
  queries?: DashboardQuery[];              // use a single query/dataSource instead
  panels?: DashboardPanel[];               // use vconcat/hconcat in one spec
  layout?: DashboardLayout;                // layout lives in the spec
}
\`\`\`

Prefer the modern single-source path (\`query\`/\`dataSource\` + one Vega-Lite \`spec\`). The legacy \`queries\`/\`panels\`/\`layout\` fields are deprecated because multiple data sources prevent cross-panel interactivity — express multi-panel layouts with \`vconcat\`/\`hconcat\` in a single spec.

## App Manifest

When publishing a service app that exposes dashboards, ensure the app manifest/capabilities include \`dashboards\` and publish with \`target: "service"\`. Studio normalizes app dashboard ids to \`app:<app-name>:<id>\` when listing installed app dashboards.
`;
}

async function generateUiInterfaces() {
    const sections = [];
    for (const file of TYPE_FILES) {
        const path = join(UI_TYPES_ROOT, file);
        const content = await readOptional(path);
        if (!content) continue;
        sections.push(
            `// -----------------------------------------------------------------------------\n// ${file}\n// -----------------------------------------------------------------------------\n${cleanDeclarationContent(content)}\n`,
        );
    }
    if (sections.length === 0) {
        throw new Error(
            `generate-docs: no @vertesia/ui declarations found under ${UI_TYPES_ROOT}. ` +
                'Build the @vertesia/ui workspace package before @vertesia/appgen-docs.',
        );
    }
    return `// Generated by @vertesia/appgen-docs.
// Do not edit by hand. This concatenates selected @vertesia/ui declaration files
// so generated app agents can grep exact exported names and prop interfaces.
// Section file paths below are source declaration paths, not import specifiers.
// Import public UI APIs from '@vertesia/ui/core', '@vertesia/ui/session',
// '@vertesia/ui/router', '@vertesia/ui/layout', '@vertesia/ui/features',
// or '@vertesia/ui/widgets'. Do not import '@vertesia/ui/core/shadcn/*'.

${sections.join('\n')}
`;
}

async function generateClientInterfaces() {
    const sections = [];
    for (const [pkg, file] of CLIENT_TYPE_FILES) {
        const root = pkg === 'client' ? CLIENT_TYPES_ROOT : COMMON_TYPES_ROOT;
        const path = join(root, file);
        const content = await readOptional(path);
        if (!content) continue;
        sections.push(
            `// -----------------------------------------------------------------------------\n// @vertesia/${pkg}: ${file}\n// -----------------------------------------------------------------------------\n${cleanDeclarationContent(content)}\n`,
        );
    }
    if (sections.length === 0) {
        throw new Error(
            'generate-docs: no @vertesia/client or @vertesia/common declarations found in workspace outputs ' +
                `(client root ${CLIENT_TYPES_ROOT}). Build those packages before @vertesia/appgen-docs.`,
        );
    }
    return `// Generated by @vertesia/appgen-docs.
// Do not edit by hand. This concatenates selected @vertesia/client and
// @vertesia/common declaration files for generated app agents.
//
// Common lookups:
// - VertesiaClient aliases: client.objects, client.agents, client.types, client.data, client.apps.
// - ObjectsApi.search returns ObjectSearchResponse with results/facets/aggregations.
// - Store/common response types come from @vertesia/common, not @vertesia/client.
// - There is no generic SearchResult export. Prefer ContentObjectItem/ContentObject/ObjectSearchResponse.
// - AgentsApi.start takes CreateAgentRunPayload and returns AgentRun.

${sections.join('\n')}
`;
}

async function generateCommonInterfaces() {
    const sections = [];
    for (const file of COMMON_REFERENCE_TYPE_FILES) {
        const path = join(COMMON_TYPES_ROOT, file);
        const content = await readOptional(path);
        if (!content) continue;
        sections.push(
            `// -----------------------------------------------------------------------------\n// @vertesia/common: ${file}\n// -----------------------------------------------------------------------------\n${cleanDeclarationContent(content)}\n`,
        );
    }
    if (sections.length === 0) {
        throw new Error(
            `generate-docs: no @vertesia/common declarations found under ${COMMON_TYPES_ROOT}. ` +
                'Build @vertesia/common before @vertesia/appgen-docs.',
        );
    }
    return `// Generated by @vertesia/appgen-docs.
// Do not edit by hand. This concatenates selected @vertesia/common declaration files
// for generated app agents.
//
// Use this file before defining app package capabilities or data-backed screens:
// - AppPackage, app capabilities, app UI/runtime metadata
// - In-code types, processes, dashboards, and tool execution contracts
// - ContentObject, ContentObjectItem, ObjectSearchResponse, collections, and store process types

${sections.join('\n')}
`;
}

async function main() {
    await rm(DOCS_ROOT, { recursive: true, force: true });
    await mkdir(DOCS_ROOT, { recursive: true });

    await writeFile(join(DOCS_ROOT, 'frontend-imports.md'), generateFrontendImports(), 'utf8');
    await mkdir(join(DOCS_ROOT, 'recipes'), { recursive: true });
    await writeFile(join(DOCS_ROOT, 'recipes', 'ui-components.md'), generateUiComponentsRecipe(), 'utf8');
    await writeFile(join(DOCS_ROOT, 'recipes', 'client-interactions.md'), generateClientInteractionsRecipe(), 'utf8');
    await writeFile(join(DOCS_ROOT, 'handlebars-prompts.md'), generateHandlebarsPrompts(), 'utf8');
    await writeFile(join(DOCS_ROOT, 'app-package-patterns.md'), generateAppPackagePatterns(), 'utf8');
    await writeFile(join(DOCS_ROOT, 'package-types.md'), generatePackageTypes(), 'utf8');
    await writeFile(join(DOCS_ROOT, 'package-processes.md'), generateAppPackageProcesses(), 'utf8');
    await writeFile(join(DOCS_ROOT, 'package-dashboards.md'), generateAppPackageDashboards(), 'utf8');
    await writeFile(join(DOCS_ROOT, 'tool-server-resource.md'), await generateToolServerResourceReference(), 'utf8');
    await writeFile(join(DOCS_ROOT, 'store-objects.md'), generateStoreObjects(), 'utf8');
    await writeFile(join(DOCS_ROOT, 'interaction-runtime.md'), generateInteractionRuntime(), 'utf8');
    await mkdir(join(DOCS_ROOT, 'ui'), { recursive: true });
    await writeFile(join(DOCS_ROOT, 'ui', 'llms.txt'), generateUiQuickReference(), 'utf8');
    await writeFile(join(DOCS_ROOT, 'ui-interfaces.d.ts'), await generateUiInterfaces(), 'utf8');
    await writeFile(join(DOCS_ROOT, 'vertesia-client.d.ts'), await generateClientInterfaces(), 'utf8');
    await writeFile(join(DOCS_ROOT, 'vertesia-common.d.ts'), await generateCommonInterfaces(), 'utf8');
    await writeFile(
        join(DOCS_ROOT, 'symbol-index.json'),
        `${JSON.stringify(await generateSymbolIndex(), null, 2)}\n`,
        'utf8',
    );

    console.log(`Generated appgen docs in ${relative(REPO_ROOT, DOCS_ROOT)}`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
});
