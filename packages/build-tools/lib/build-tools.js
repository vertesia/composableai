import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { rollup } from 'rollup';
import { z } from 'zod';
import matter from 'gray-matter';
import path$1 from 'path';

/**
 * Utilities for copying asset files during build
 */
/**
 * Ensure a directory exists, creating it recursively if needed
 */
function ensureDirectory(dirPath) {
    try {
        mkdirSync(dirPath, { recursive: true });
    }
    catch (error) {
        // Ignore if directory already exists
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}
/**
 * Copy an asset file to its destination
 *
 * @param asset - Asset file information
 * @param assetsRoot - Root directory for assets
 */
function copyAssetFile(asset, assetsRoot) {
    const destPath = path.join(assetsRoot, asset.destPath);
    const destDir = path.dirname(destPath);
    // Ensure destination directory exists
    ensureDirectory(destDir);
    // Copy file
    try {
        copyFileSync(asset.sourcePath, destPath);
    }
    catch (error) {
        throw new Error(`Failed to copy asset from ${asset.sourcePath} to ${destPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Copy multiple asset files
 *
 * @param assets - Array of asset files to copy
 * @param assetsRoot - Root directory for assets
 * @returns Number of files copied
 */
function copyAssets(assets, assetsRoot) {
    let copied = 0;
    for (const asset of assets) {
        copyAssetFile(asset, assetsRoot);
        copied++;
    }
    return copied;
}

/**
 * Widget compilation utility using Rollup
 */
/**
 * Default external dependencies for widgets
 */
const DEFAULT_EXTERNALS = [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'react-dom/client'
];
/**
 * Compile widgets using Rollup
 *
 * @param widgets - Array of widget metadata to compile
 * @param outputDir - Directory to write compiled widgets
 * @param config - Widget compilation configuration
 * @returns Number of widgets compiled
 */
async function compileWidgets(widgets, outputDir, config = {}) {
    if (widgets.length === 0) {
        return 0;
    }
    const { external = DEFAULT_EXTERNALS, tsconfig = './tsconfig.json', typescript: typescriptOptions = {}, minify = false } = config;
    // Build each widget separately to get individual bundles
    const buildPromises = widgets.map(async (widget) => {
        // Dynamically import plugins - use any to bypass TypeScript module resolution issues
        const typescript = (await import('@rollup/plugin-typescript')).default;
        const nodeResolve = (await import('@rollup/plugin-node-resolve')).default;
        const commonjs = (await import('@rollup/plugin-commonjs')).default;
        const plugins = [
            typescript({
                tsconfig,
                declaration: false,
                sourceMap: true,
                ...typescriptOptions
            }),
            nodeResolve({
                browser: true,
                preferBuiltins: false,
                extensions: ['.tsx', '.ts', '.jsx', '.js']
            }),
            commonjs()
        ];
        // Add minification if requested
        if (minify) {
            const { terser } = await import('rollup-plugin-terser');
            plugins.push(terser({
                compress: {
                    drop_console: false
                }
            }));
        }
        const rollupConfig = {
            input: widget.path,
            output: {
                file: path.join(outputDir, `${widget.name}.js`),
                format: 'es',
                sourcemap: true,
                inlineDynamicImports: true
            },
            external,
            plugins
        };
        const bundle = await rollup(rollupConfig);
        await bundle.write(rollupConfig.output);
        await bundle.close();
    });
    await Promise.all(buildPromises);
    return widgets.length;
}

/**
 * Core Rollup plugin implementation for transforming imports
 */
/**
 * Creates a Rollup plugin that transforms imports based on configured rules
 */
function vertesiaImportPlugin(config) {
    const { transformers, assetsDir = './dist', widgetConfig } = config;
    if (!transformers || transformers.length === 0) {
        throw new Error('vertesiaImportPlugin: At least one transformer must be configured');
    }
    // Track assets to copy and widgets to compile
    const assetsToProcess = [];
    const widgetsToCompile = [];
    const shouldCopyAssets = assetsDir !== false;
    const shouldCompileWidgets = widgetConfig !== undefined && assetsDir !== false;
    return {
        name: 'vertesia-import-plugin',
        /**
         * Resolve import IDs to handle pattern-based imports
         */
        resolveId(source, importer) {
            // Check if any transformer pattern matches
            for (const transformer of transformers) {
                if (transformer.pattern.test(source)) {
                    // Handle relative imports
                    if (source.startsWith('.') && importer) {
                        const cleanSource = source.replace(transformer.pattern, '');
                        // Strip query parameters from importer to get the file path
                        const cleanImporter = importer.indexOf('?') >= 0
                            ? importer.substring(0, importer.indexOf('?'))
                            : importer;
                        // Always use dirname to get the directory containing the importer
                        const baseDir = path.dirname(cleanImporter);
                        const resolved = path.resolve(baseDir, cleanSource);
                        // Return with the pattern suffix to identify it in load
                        const suffix = source.match(transformer.pattern)?.[0] || '';
                        return resolved + suffix;
                    }
                    return source;
                }
            }
            return null; // Let other plugins handle it
        },
        /**
         * Load and transform the file content
         */
        async load(id) {
            // Find matching transformer
            let matchedTransformer;
            let cleanId = id;
            for (const transformer of transformers) {
                if (transformer.pattern.test(id)) {
                    matchedTransformer = transformer;
                    // Remove query parameters to get actual file path
                    // For example: '/path/file.md?skill' -> '/path/file.md'
                    //              '/path/file.html?raw' -> '/path/file.html'
                    const queryIndex = id.indexOf('?');
                    cleanId = queryIndex >= 0 ? id.substring(0, queryIndex) : id;
                    break;
                }
            }
            if (!matchedTransformer) {
                return null; // Not for us
            }
            try {
                // Read file content (skip for virtual transforms)
                const content = matchedTransformer.virtual
                    ? ''
                    : readFileSync(cleanId, 'utf-8');
                // Transform the content
                const result = await matchedTransformer.transform(content, cleanId);
                // Collect assets if any
                if (result.assets && shouldCopyAssets) {
                    assetsToProcess.push(...result.assets);
                }
                // Collect widgets if any
                if (result.widgets && shouldCompileWidgets) {
                    widgetsToCompile.push(...result.widgets);
                }
                // Validate if schema provided
                if (matchedTransformer.schema) {
                    const validation = matchedTransformer.schema.safeParse(result.data);
                    if (!validation.success) {
                        const errors = validation.error.errors
                            .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
                            .join('\n');
                        throw new Error(`Validation failed for ${id}:\n${errors}`);
                    }
                }
                // Generate code
                const imports = result.imports ? result.imports.join('\n') + '\n\n' : '';
                if (result.code) {
                    // Custom code provided - prepend imports
                    return imports + result.code;
                }
                else {
                    // Default: export data (escape if string, otherwise stringify as JSON)
                    const dataJson = JSON.stringify(result.data, null, 2);
                    return `${imports}export default ${dataJson};`;
                }
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.error(`Failed to transform ${id}: ${message}`);
            }
        },
        /**
         * Copy assets and compile widgets after all modules are loaded
         */
        async buildEnd() {
            // Copy script assets
            if (shouldCopyAssets && assetsToProcess.length > 0) {
                try {
                    const copied = copyAssets(assetsToProcess, assetsDir);
                    console.log(`Copied ${copied} asset file(s) to ${assetsDir}`);
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    this.warn(`Failed to copy assets: ${message}`);
                }
            }
            // Compile widgets
            if (shouldCompileWidgets && widgetsToCompile.length > 0) {
                try {
                    const widgetsDir = config.widgetsDir || 'widgets';
                    const outputDir = path.join(assetsDir, widgetsDir);
                    console.log(`Compiling ${widgetsToCompile.length} widget(s)...`);
                    const compiled = await compileWidgets(widgetsToCompile, outputDir, widgetConfig);
                    console.log(`Compiled ${compiled} widget(s) to ${outputDir}`);
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    this.error(`Failed to compile widgets: ${message}`);
                }
            }
        }
    };
}

/**
 * Frontmatter parser utility using gray-matter
 */
/**
 * Parse YAML frontmatter from markdown content
 *
 * @param content - Raw markdown content with optional frontmatter
 * @returns Parsed frontmatter and content
 */
function parseFrontmatter(content) {
    const result = matter(content);
    return {
        frontmatter: result.data,
        content: result.content,
        original: content
    };
}

/**
 * Utilities for discovering asset files (scripts, widgets) in skill directories
 */
/**
 * Check if a file exists and is a regular file
 */
function isFile(filePath) {
    try {
        return statSync(filePath).isFile();
    }
    catch {
        return false;
    }
}
/**
 * Get all files in a directory (non-recursive)
 */
function getFilesInDirectory(dirPath) {
    try {
        return readdirSync(dirPath).filter(file => {
            const fullPath = path.join(dirPath, file);
            return isFile(fullPath);
        });
    }
    catch {
        return [];
    }
}
/**
 * Check if a file is a script file (.js or .py)
 */
function isScriptFile(fileName) {
    return /\.(js|py)$/.test(fileName);
}
/**
 * Check if a file is a widget file (.tsx)
 */
function isWidgetFile(fileName) {
    return /\.tsx$/.test(fileName);
}
/**
 * Extract widget name from .tsx file (remove extension)
 */
function getWidgetName(fileName) {
    return fileName.replace(/\.tsx$/, '');
}
/**
 * Discover assets (scripts and widgets) in a skill directory
 *
 * @param skillFilePath - Absolute path to the skill.md file
 * @param options - Asset discovery options
 * @returns Discovered assets and metadata
 */
function discoverSkillAssets(skillFilePath, options = {}) {
    const skillDir = path.dirname(skillFilePath);
    const files = getFilesInDirectory(skillDir);
    const scripts = [];
    const widgets = [];
    const widgetMetadata = [];
    const assetFiles = [];
    const scriptsDir = options.scriptsDir || 'scripts';
    for (const file of files) {
        const fullPath = path.join(skillDir, file);
        if (isScriptFile(file)) {
            // Script file (.js or .py)
            scripts.push(file);
            assetFiles.push({
                sourcePath: fullPath,
                destPath: path.join(scriptsDir, file),
                type: 'script'
            });
        }
        else if (isWidgetFile(file)) {
            // Widget file (.tsx)
            const widgetName = getWidgetName(file);
            widgets.push(widgetName);
            widgetMetadata.push({
                name: widgetName,
                path: fullPath
            });
            // Note: We don't add widget .tsx files to assetFiles
            // Widgets are compiled by the plugin if widgetConfig is provided
        }
    }
    return {
        scripts,
        widgets,
        widgetMetadata,
        assetFiles
    };
}

/**
 * Skill transformer preset for markdown files with frontmatter
 */
/**
 * Context triggers for auto-injection of skills (for frontmatter validation)
 */
const SkillContextTriggersFrontmatterSchema = z.object({
    keywords: z.array(z.string()).optional(),
    tool_names: z.array(z.string()).optional(),
    data_patterns: z.array(z.string()).optional()
}).strict();
/**
 * Context triggers for auto-injection of skills (for output validation)
 */
const SkillContextTriggersSchema = z.object({
    keywords: z.array(z.string()).optional(),
    tool_names: z.array(z.string()).optional(),
    data_patterns: z.array(z.string()).optional()
}).optional();
/**
 * Execution configuration for skills that need code execution (for frontmatter validation)
 */
const SkillExecutionFrontmatterSchema = z.object({
    language: z.string(),
    packages: z.array(z.string()).optional(),
    system_packages: z.array(z.string()).optional(),
    template: z.string().optional()
}).strict();
/**
 * Execution configuration for skills that need code execution (for output validation)
 */
const SkillExecutionSchema = z.object({
    language: z.string(),
    packages: z.array(z.string()).optional(),
    system_packages: z.array(z.string()).optional(),
    template: z.string().optional()
}).optional();
/**
 * Zod schema for skill frontmatter validation
 * This validates the YAML frontmatter before transformation
 * Supports both flat and nested structures
 */
const SkillFrontmatterSchema = z.object({
    // Required fields
    name: z.string().min(1, 'Skill name is required'),
    description: z.string().min(1, 'Skill description is required'),
    // Optional fields
    title: z.string().optional(),
    content_type: z.enum(['md', 'jst']).optional(),
    // Flat structure fields (legacy)
    keywords: z.array(z.string()).optional(),
    tools: z.array(z.string()).optional(),
    data_patterns: z.array(z.string()).optional(),
    language: z.string().optional(),
    packages: z.array(z.string()).optional(),
    system_packages: z.array(z.string()).optional(),
    // Nested structure fields
    context_triggers: SkillContextTriggersFrontmatterSchema.optional(),
    execution: SkillExecutionFrontmatterSchema.optional(),
    related_tools: z.array(z.string()).optional(),
    input_schema: z.object({
        type: z.literal('object'),
        properties: z.record(z.any()).optional(),
        required: z.array(z.string()).optional()
    }).optional(),
    // Asset fields (auto-discovered but can be overridden)
    scripts: z.array(z.string()).optional(),
    widgets: z.array(z.string()).optional()
}).strict();
/**
 * MUST be kept in sync with @vertesia/tools-sdk SkillDefinition
 * Zod schema for skill definition
 * This validates the structure of skill objects generated from markdown
 * Matches the SkillDefinition interface from @vertesia/tools-sdk
 */
const SkillDefinitionSchema = z.object({
    name: z.string().min(1, 'Skill name is required'),
    title: z.string().optional(),
    description: z.string().min(1, 'Skill description is required'),
    instructions: z.string(),
    content_type: z.enum(['md', 'jst']),
    input_schema: z.object({
        type: z.literal('object'),
        properties: z.record(z.any()).optional(),
        required: z.array(z.string()).optional()
    }).optional(),
    context_triggers: SkillContextTriggersSchema,
    execution: SkillExecutionSchema,
    related_tools: z.array(z.string()).optional(),
    scripts: z.array(z.string()).optional(),
    widgets: z.array(z.string()).optional()
});
/**
 * Build a SkillDefinition from frontmatter and markdown content.
 * This mirrors the logic in @vertesia/tools-sdk parseSkillFile function.
 *
 * Supports two frontmatter structures:
 *
 * 1. Flat structure (matches parseSkillFile in tools-sdk):
 *    keywords: [...]
 *    tools: [...]
 *    language: python
 *    packages: [...]
 *
 * 2. Nested structure (for more explicit YAML):
 *    context_triggers:
 *      keywords: [...]
 *      tool_names: [...]
 *    execution:
 *      language: python
 *      packages: [...]
 *    related_tools: [...]
 *
 * @param frontmatter - Parsed frontmatter object
 * @param instructions - Markdown content (body of the file)
 * @param contentType - Content type ('md' or 'jst')
 * @param widgets - Discovered widget names
 * @param scripts - Discovered script names
 * @returns Skill definition object
 */
function buildSkillDefinition(frontmatter, instructions, contentType, widgets, scripts) {
    const skill = {
        name: frontmatter.name,
        title: frontmatter.title,
        description: frontmatter.description,
        instructions,
        content_type: contentType,
        widgets: widgets.length > 0 ? widgets : undefined,
        scripts: scripts.length > 0 ? scripts : undefined,
    };
    // Build context triggers - support both flat and nested structure
    // Nested: context_triggers: { keywords: [...], tool_names: [...] }
    // Flat: keywords: [...], tools: [...]
    const contextTriggers = frontmatter.context_triggers;
    const hasNestedTriggers = contextTriggers && typeof contextTriggers === 'object';
    const hasFlatTriggers = frontmatter.keywords || frontmatter.tools || frontmatter.data_patterns;
    if (hasNestedTriggers || hasFlatTriggers) {
        skill.context_triggers = {
            keywords: hasNestedTriggers ? contextTriggers.keywords : frontmatter.keywords,
            tool_names: hasNestedTriggers ? contextTriggers.tool_names : frontmatter.tools,
            data_patterns: hasNestedTriggers ? contextTriggers.data_patterns : frontmatter.data_patterns,
        };
    }
    // Build execution config - support both flat and nested structure
    const execution = frontmatter.execution;
    const hasNestedExecution = execution && typeof execution === 'object';
    const hasFlatExecution = frontmatter.language;
    if (hasNestedExecution || hasFlatExecution) {
        skill.execution = {
            language: hasNestedExecution ? execution.language : frontmatter.language,
            packages: hasNestedExecution ? execution.packages : frontmatter.packages,
            system_packages: hasNestedExecution ? execution.system_packages : frontmatter.system_packages,
        };
        // Extract code template from instructions if present
        const codeBlockMatch = instructions.match(/```(?:python|javascript|typescript|js|ts|py)\n([\s\S]*?)```/);
        if (codeBlockMatch) {
            skill.execution.template = codeBlockMatch[1].trim();
        }
    }
    // Related tools - support both direct field and from tools field
    if (frontmatter.related_tools) {
        skill.related_tools = frontmatter.related_tools;
    }
    else if (frontmatter.tools && !hasNestedTriggers) {
        // If tools is not part of context_triggers, use it as related_tools
        skill.related_tools = frontmatter.tools;
    }
    // Input schema from frontmatter
    if (frontmatter.input_schema) {
        skill.input_schema = frontmatter.input_schema;
    }
    return skill;
}
/**
 * Skill transformer preset
 * Transforms markdown files with ?skill suffix OR SKILL.md files into skill definition objects
 *
 * Matches:
 * - Files with ?skill suffix: ./my-skill.md?skill
 * - SKILL.md files: ./my-skill/SKILL.md
 *
 * @example
 * ```typescript
 * import skill1 from './my-skill.md?skill';
 * import skill2 from './my-skill/SKILL.md';
 * // Both are SkillDefinition objects
 * ```
 */
const skillTransformer = {
    pattern: /(\.md\?skill$|\/SKILL\.md$)/,
    schema: SkillDefinitionSchema,
    transform: (content, filePath) => {
        const { frontmatter, content: markdown } = parseFrontmatter(content);
        // Validate frontmatter first to catch unknown properties
        const frontmatterValidation = SkillFrontmatterSchema.safeParse(frontmatter);
        if (!frontmatterValidation.success) {
            const errors = frontmatterValidation.error.errors
                .map((err) => {
                const path = err.path.length > 0 ? err.path.join('.') : 'frontmatter';
                return `  - ${path}: ${err.message}`;
            })
                .join('\n');
            throw new Error(`Invalid frontmatter in ${filePath}:\n${errors}`);
        }
        // Determine content type from frontmatter or file extension
        const content_type = frontmatter.content_type || 'md';
        // Discover assets (scripts and widgets) in the skill directory
        const assets = discoverSkillAssets(filePath);
        // Build skill definition using the same logic as parseSkillFile in tools-sdk
        const skillData = buildSkillDefinition(frontmatter, markdown, content_type, assets.widgets, assets.scripts);
        return {
            data: skillData,
            assets: assets.assetFiles,
            widgets: assets.widgetMetadata
        };
    }
};

/**
 * Skill collection transformer for directory-based skill imports
 * Scans a directory for subdirectories containing SKILL.md files
 */
/**
 * Skill collection transformer preset
 * Transforms directory imports with ?skills suffix into an array of skill imports
 *
 * Matches:
 * - ./all?skills (recommended - generates all.js in the directory)
 * - ./_skills?skills (generates _skills.js in the directory)
 * - Any path ending with a filename and ?skills
 *
 * NOTE: A filename before ?skills is REQUIRED to avoid naming conflicts.
 * The filename becomes the output module name.
 *
 * @example
 * ```typescript
 * import skills from './all?skills';
 * // Scans current directory for subdirectories with SKILL.md
 * // Generates all.js containing array of all skills
 * ```
 */
const skillCollectionTransformer = {
    pattern: /\/[^/?]+\?skills$/,
    virtual: true, // Indicates this doesn't transform a real file
    transform: (_content, filePath) => {
        // Remove ?skills suffix and the filename to get directory path
        // Example: /path/code/all?skills -> /path/code/all -> /path/code/
        const pathWithoutQuery = filePath.replace(/\?skills$/, '');
        const dirPath = path.dirname(pathWithoutQuery);
        if (!existsSync(dirPath)) {
            throw new Error(`Directory not found: ${dirPath}`);
        }
        if (!statSync(dirPath).isDirectory()) {
            throw new Error(`Not a directory: ${dirPath}`);
        }
        // Scan for subdirectories containing SKILL.md
        const entries = readdirSync(dirPath);
        const imports = [];
        const names = [];
        for (const entry of entries) {
            const entryPath = path.join(dirPath, entry);
            try {
                if (statSync(entryPath).isDirectory()) {
                    const skillFile = path.join(entryPath, 'SKILL.md');
                    if (existsSync(skillFile)) {
                        // Generate unique identifier from directory name
                        const identifier = `Skill_${entry.replace(/[^a-zA-Z0-9_]/g, '_')}`;
                        imports.push(`import ${identifier} from './${entry}/SKILL.md';`);
                        names.push(identifier);
                    }
                }
            }
            catch (err) {
                // Skip entries that can't be read
                continue;
            }
        }
        if (names.length === 0) {
            console.warn(`No SKILL.md files found in subdirectories of ${dirPath}`);
        }
        // Generate code that imports all skills and exports as array
        const code = [
            ...imports,
            '',
            `export default [${names.join(', ')}];`
        ].join('\n');
        return {
            data: null, // Not used when custom code is provided
            code
        };
    }
};

/**
 * Raw transformer preset for importing file content as strings
 */
/**
 * Raw transformer preset
 * Transforms any file with ?raw suffix into a string export
 *
 * @example
 * ```typescript
 * import template from './template.html?raw';
 * // template is a string containing the file content
 * ```
 */
const rawTransformer = {
    pattern: /\?raw$/,
    transform: (content) => {
        return {
            data: content
        };
    }
};

/**
 * @module access-control
 * @description
 * Access control interfaces
 */
var Permission;
(function (Permission) {
    Permission["int_read"] = "interaction:read";
    Permission["int_write"] = "interaction:write";
    Permission["int_delete"] = "interaction:delete";
    Permission["int_execute"] = "interaction:execute";
    Permission["run_read"] = "run:read";
    Permission["run_write"] = "run:write";
    Permission["env_admin"] = "environment:admin";
    Permission["project_admin"] = "project:admin";
    Permission["project_integration_read"] = "project:integration_read";
    Permission["project_settings_write"] = "project:settings_write";
    Permission["api_key_create"] = "api_key:create";
    Permission["api_key_read"] = "api_key:read";
    Permission["api_key_update"] = "api_key:update";
    Permission["api_key_delete"] = "api_key:delete";
    Permission["account_read"] = "account:read";
    Permission["account_write"] = "account:write";
    Permission["account_admin"] = "account:admin";
    Permission["manage_billing"] = "account:billing";
    Permission["account_member"] = "account:member";
    Permission["content_read"] = "content:read";
    Permission["content_write"] = "content:write";
    Permission["content_delete"] = "content:delete";
    Permission["content_admin"] = "content:admin";
    Permission["content_superadmin"] = "content:superadmin";
    Permission["workflow_run"] = "workflow:run";
    Permission["workflow_admin"] = "workflow:admin";
    Permission["workflow_superadmin"] = "workflow:superadmin";
    Permission["iam_impersonate"] = "iam:impersonate";
    /** whether the user has access to Sutdio App. */
    Permission["studio_access"] = "studio:access";
})(Permission || (Permission = {}));
var AccessControlResourceType;
(function (AccessControlResourceType) {
    AccessControlResourceType["project"] = "project";
    AccessControlResourceType["environment"] = "environment";
    AccessControlResourceType["account"] = "account";
    AccessControlResourceType["interaction"] = "interaction";
    AccessControlResourceType["app"] = "application";
})(AccessControlResourceType || (AccessControlResourceType = {}));
var AccessControlPrincipalType;
(function (AccessControlPrincipalType) {
    AccessControlPrincipalType["user"] = "user";
    AccessControlPrincipalType["group"] = "group";
    AccessControlPrincipalType["apikey"] = "apikey";
})(AccessControlPrincipalType || (AccessControlPrincipalType = {}));

var ApiKeyTypes;
(function (ApiKeyTypes) {
    ApiKeyTypes["secret"] = "sk";
})(ApiKeyTypes || (ApiKeyTypes = {}));
var PrincipalType;
(function (PrincipalType) {
    PrincipalType["User"] = "user";
    PrincipalType["Group"] = "group";
    PrincipalType["ApiKey"] = "apikey";
    PrincipalType["ServiceAccount"] = "service_account";
    PrincipalType["Agent"] = "agent";
})(PrincipalType || (PrincipalType = {}));

var InteractionStatus;
(function (InteractionStatus) {
    InteractionStatus["draft"] = "draft";
    InteractionStatus["published"] = "published";
    InteractionStatus["archived"] = "archived";
})(InteractionStatus || (InteractionStatus = {}));
var ExecutionRunStatus;
(function (ExecutionRunStatus) {
    ExecutionRunStatus["created"] = "created";
    ExecutionRunStatus["processing"] = "processing";
    ExecutionRunStatus["completed"] = "completed";
    ExecutionRunStatus["failed"] = "failed";
})(ExecutionRunStatus || (ExecutionRunStatus = {}));
var RunDataStorageLevel;
(function (RunDataStorageLevel) {
    RunDataStorageLevel["STANDARD"] = "STANDARD";
    RunDataStorageLevel["RESTRICTED"] = "RESTRICTED";
    RunDataStorageLevel["DEBUG"] = "DEBUG";
})(RunDataStorageLevel || (RunDataStorageLevel = {}));
var RunDataStorageDescription;
(function (RunDataStorageDescription) {
    RunDataStorageDescription["STANDARD"] = "Run data is stored for both the model inputs and output.";
    RunDataStorageDescription["RESTRICTED"] = "No run data is stored for the model inputs \u2014 only the model output.";
    RunDataStorageDescription["DEBUG"] = "Run data is stored for the model inputs and output, schema, and final prompt.";
})(RunDataStorageDescription || (RunDataStorageDescription = {}));
({
    [RunDataStorageLevel.STANDARD]: RunDataStorageDescription.STANDARD,
    [RunDataStorageLevel.RESTRICTED]: RunDataStorageDescription.RESTRICTED,
    [RunDataStorageLevel.DEBUG]: RunDataStorageDescription.DEBUG,
});
/**
 * Defines the scope for agent search operations.
 */
var AgentSearchScope;
(function (AgentSearchScope) {
    /**
     * Search is scoped to a specific collection.
     */
    AgentSearchScope["Collection"] = "collection";
})(AgentSearchScope || (AgentSearchScope = {}));
// ================= end async execution payloads ====================
var RunSourceTypes;
(function (RunSourceTypes) {
    RunSourceTypes["api"] = "api";
    RunSourceTypes["cli"] = "cli";
    RunSourceTypes["ui"] = "ui";
    RunSourceTypes["webhook"] = "webhook";
    RunSourceTypes["test"] = "test-data";
    RunSourceTypes["system"] = "system";
})(RunSourceTypes || (RunSourceTypes = {}));
var ConfigModes;
(function (ConfigModes) {
    ConfigModes["RUN_AND_INTERACTION_CONFIG"] = "RUN_AND_INTERACTION_CONFIG";
    ConfigModes["RUN_CONFIG_ONLY"] = "RUN_CONFIG_ONLY";
    ConfigModes["INTERACTION_CONFIG_ONLY"] = "INTERACTION_CONFIG_ONLY";
})(ConfigModes || (ConfigModes = {}));
var ConfigModesDescription;
(function (ConfigModesDescription) {
    ConfigModesDescription["RUN_AND_INTERACTION_CONFIG"] = "This run configuration is used. Undefined options are filled with interaction configuration.";
    ConfigModesDescription["RUN_CONFIG_ONLY"] = "Only this run configuration is used. Undefined options remain undefined.";
    ConfigModesDescription["INTERACTION_CONFIG_ONLY"] = "Only interaction configuration is used.";
})(ConfigModesDescription || (ConfigModesDescription = {}));
({
    [ConfigModes.RUN_AND_INTERACTION_CONFIG]: ConfigModesDescription.RUN_AND_INTERACTION_CONFIG,
    [ConfigModes.RUN_CONFIG_ONLY]: ConfigModesDescription.RUN_CONFIG_ONLY,
    [ConfigModes.INTERACTION_CONFIG_ONLY]: ConfigModesDescription.INTERACTION_CONFIG_ONLY,
});
/**
 * Source of the resolved model configuration
 */
var ModelSource;
(function (ModelSource) {
    /** Model was explicitly provided in the execution config */
    ModelSource["config"] = "config";
    /** Model comes from the interaction definition */
    ModelSource["interaction"] = "interaction";
    /** Model comes from environment's default_model */
    ModelSource["environmentDefault"] = "environmentDefault";
    /** Model comes from project system interaction defaults */
    ModelSource["projectSystemDefault"] = "projectSystemDefault";
    /** Model comes from project base defaults */
    ModelSource["projectBaseDefault"] = "projectBaseDefault";
    /** Model comes from project modality-specific defaults */
    ModelSource["projectModalityDefault"] = "projectModalityDefault";
    /** Model comes from legacy project defaults */
    ModelSource["projectLegacyDefault"] = "projectLegacyDefault";
})(ModelSource || (ModelSource = {}));

/**
 * Data Platform Types
 *
 * Types for managing versioned analytical data stores with DuckDB + GCS storage.
 * Supports AI-manageable schemas and multi-table atomic operations.
 */
// ============================================================================
// Column Types
// ============================================================================
/**
 * Supported column data types for DuckDB tables.
 */
var DataColumnType;
(function (DataColumnType) {
    DataColumnType["STRING"] = "STRING";
    DataColumnType["INTEGER"] = "INTEGER";
    DataColumnType["BIGINT"] = "BIGINT";
    DataColumnType["FLOAT"] = "FLOAT";
    DataColumnType["DOUBLE"] = "DOUBLE";
    DataColumnType["DECIMAL"] = "DECIMAL";
    DataColumnType["BOOLEAN"] = "BOOLEAN";
    DataColumnType["DATE"] = "DATE";
    DataColumnType["TIMESTAMP"] = "TIMESTAMP";
    DataColumnType["JSON"] = "JSON";
})(DataColumnType || (DataColumnType = {}));
/**
 * Semantic types that provide AI agents with context about column meaning.
 */
var SemanticColumnType;
(function (SemanticColumnType) {
    SemanticColumnType["EMAIL"] = "email";
    SemanticColumnType["PHONE"] = "phone";
    SemanticColumnType["URL"] = "url";
    SemanticColumnType["CURRENCY"] = "currency";
    SemanticColumnType["PERCENTAGE"] = "percentage";
    SemanticColumnType["PERSON_NAME"] = "person_name";
    SemanticColumnType["ADDRESS"] = "address";
    SemanticColumnType["COUNTRY"] = "country";
    SemanticColumnType["DATE_ISO"] = "date_iso";
    SemanticColumnType["IDENTIFIER"] = "identifier";
})(SemanticColumnType || (SemanticColumnType = {}));
/**
 * Mapping from DataColumnType to DuckDB SQL types.
 */
({
    [DataColumnType.STRING]: 'VARCHAR',
    [DataColumnType.INTEGER]: 'INTEGER',
    [DataColumnType.BIGINT]: 'BIGINT',
    [DataColumnType.FLOAT]: 'FLOAT',
    [DataColumnType.DOUBLE]: 'DOUBLE',
    [DataColumnType.DECIMAL]: 'DECIMAL(18,4)',
    [DataColumnType.BOOLEAN]: 'BOOLEAN',
    [DataColumnType.DATE]: 'DATE',
    [DataColumnType.TIMESTAMP]: 'TIMESTAMP',
    [DataColumnType.JSON]: 'JSON',
});
// ============================================================================
// Data Store Types
// ============================================================================
/**
 * Data store lifecycle status.
 */
var DataStoreStatus;
(function (DataStoreStatus) {
    /** Store is being created */
    DataStoreStatus["CREATING"] = "creating";
    /** Store is active and usable */
    DataStoreStatus["ACTIVE"] = "active";
    /** Store encountered an error */
    DataStoreStatus["ERROR"] = "error";
    /** Store has been archived (soft deleted) */
    DataStoreStatus["ARCHIVED"] = "archived";
})(DataStoreStatus || (DataStoreStatus = {}));
// ============================================================================
// Import Types
// ============================================================================
/**
 * Import job status.
 */
var ImportStatus;
(function (ImportStatus) {
    /** Job is queued */
    ImportStatus["PENDING"] = "pending";
    /** Job is running */
    ImportStatus["PROCESSING"] = "processing";
    /** Job completed successfully */
    ImportStatus["COMPLETED"] = "completed";
    /** Job failed */
    ImportStatus["FAILED"] = "failed";
    /** Job was rolled back */
    ImportStatus["ROLLED_BACK"] = "rolled_back";
})(ImportStatus || (ImportStatus = {}));
// ============================================================================
// Dashboard Types
// ============================================================================
/**
 * Dashboard lifecycle status.
 */
var DashboardStatus;
(function (DashboardStatus) {
    /** Dashboard is active and usable */
    DashboardStatus["ACTIVE"] = "active";
    /** Dashboard has been archived (soft deleted) */
    DashboardStatus["ARCHIVED"] = "archived";
})(DashboardStatus || (DashboardStatus = {}));

// ============== Provider details ===============
var Providers;
(function (Providers) {
    Providers["openai"] = "openai";
    Providers["openai_compatible"] = "openai_compatible";
    Providers["azure_openai"] = "azure_openai";
    Providers["azure_foundry"] = "azure_foundry";
    Providers["huggingface_ie"] = "huggingface_ie";
    Providers["replicate"] = "replicate";
    Providers["bedrock"] = "bedrock";
    Providers["vertexai"] = "vertexai";
    Providers["togetherai"] = "togetherai";
    Providers["mistralai"] = "mistralai";
    Providers["groq"] = "groq";
    Providers["watsonx"] = "watsonx";
    Providers["xai"] = "xai";
})(Providers || (Providers = {}));
({
    openai: {
        id: Providers.openai},
    azure_openai: {
        id: Providers.azure_openai},
    azure_foundry: {
        id: Providers.azure_foundry},
    huggingface_ie: {
        id: Providers.huggingface_ie},
    replicate: {
        id: Providers.replicate},
    bedrock: {
        id: Providers.bedrock},
    vertexai: {
        id: Providers.vertexai},
    togetherai: {
        id: Providers.togetherai},
    mistralai: {
        id: Providers.mistralai},
    groq: {
        id: Providers.groq},
    watsonx: {
        id: Providers.watsonx},
    xai: {
        id: Providers.xai},
    openai_compatible: {
        id: Providers.openai_compatible},
});
//Common names to share between different models
var SharedOptions;
(function (SharedOptions) {
    //Text
    SharedOptions["max_tokens"] = "max_tokens";
    SharedOptions["temperature"] = "temperature";
    SharedOptions["top_p"] = "top_p";
    SharedOptions["top_k"] = "top_k";
    SharedOptions["presence_penalty"] = "presence_penalty";
    SharedOptions["frequency_penalty"] = "frequency_penalty";
    SharedOptions["stop_sequence"] = "stop_sequence";
    //Image
    SharedOptions["seed"] = "seed";
    SharedOptions["number_of_images"] = "number_of_images";
})(SharedOptions || (SharedOptions = {}));
var OptionType;
(function (OptionType) {
    OptionType["numeric"] = "numeric";
    OptionType["enum"] = "enum";
    OptionType["boolean"] = "boolean";
    OptionType["string_list"] = "string_list";
})(OptionType || (OptionType = {}));
// ============== Prompts ===============
var PromptRole;
(function (PromptRole) {
    PromptRole["safety"] = "safety";
    PromptRole["system"] = "system";
    PromptRole["user"] = "user";
    PromptRole["assistant"] = "assistant";
    PromptRole["negative"] = "negative";
    PromptRole["mask"] = "mask";
    /**
     * Used to send the response of a tool
     */
    PromptRole["tool"] = "tool";
})(PromptRole || (PromptRole = {}));
/**
 * @deprecated This is deprecated. Use CompletionResult.type information instead.
 */
var Modalities;
(function (Modalities) {
    Modalities["text"] = "text";
    Modalities["image"] = "image";
})(Modalities || (Modalities = {}));
var AIModelStatus;
(function (AIModelStatus) {
    AIModelStatus["Available"] = "available";
    AIModelStatus["Pending"] = "pending";
    AIModelStatus["Stopped"] = "stopped";
    AIModelStatus["Unavailable"] = "unavailable";
    AIModelStatus["Unknown"] = "unknown";
    AIModelStatus["Legacy"] = "legacy";
})(AIModelStatus || (AIModelStatus = {}));
var ModelType;
(function (ModelType) {
    ModelType["Classifier"] = "classifier";
    ModelType["Regressor"] = "regressor";
    ModelType["Clustering"] = "clustering";
    ModelType["AnomalyDetection"] = "anomaly-detection";
    ModelType["TimeSeries"] = "time-series";
    ModelType["Text"] = "text";
    ModelType["Image"] = "image";
    ModelType["Audio"] = "audio";
    ModelType["Video"] = "video";
    ModelType["Embedding"] = "embedding";
    ModelType["Chat"] = "chat";
    ModelType["Code"] = "code";
    ModelType["NLP"] = "nlp";
    ModelType["MultiModal"] = "multi-modal";
    ModelType["Test"] = "test";
    ModelType["Other"] = "other";
    ModelType["Unknown"] = "unknown";
})(ModelType || (ModelType = {}));
var TrainingJobStatus;
(function (TrainingJobStatus) {
    TrainingJobStatus["running"] = "running";
    TrainingJobStatus["succeeded"] = "succeeded";
    TrainingJobStatus["failed"] = "failed";
    TrainingJobStatus["cancelled"] = "cancelled";
})(TrainingJobStatus || (TrainingJobStatus = {}));

({
    options: [
        {
            name: SharedOptions.max_tokens, type: OptionType.numeric, min: 1,
            integer: true, step: 200, description: "The maximum number of tokens to generate"
        },
        {
            name: SharedOptions.temperature, type: OptionType.numeric, min: 0.0, default: 0.7,
            integer: false, step: 0.1, description: "A higher temperature biases toward less likely tokens, making the model more creative"
        },
        {
            name: SharedOptions.top_p, type: OptionType.numeric, min: 0, max: 1,
            integer: false, step: 0.1, description: "Limits token sampling to the cumulative probability of the top p tokens"
        },
        {
            name: SharedOptions.top_k, type: OptionType.numeric, min: 1,
            integer: true, step: 1, description: "Limits token sampling to the top k tokens"
        },
        {
            name: SharedOptions.presence_penalty, type: OptionType.numeric, min: -2, max: 2.0,
            integer: false, step: 0.1, description: "Penalise tokens if they appear at least once in the text"
        },
        {
            name: SharedOptions.frequency_penalty, type: OptionType.numeric, min: -2, max: 2.0,
            integer: false, step: 0.1, description: "Penalise tokens based on their frequency in the text"
        },
        { name: SharedOptions.stop_sequence, type: OptionType.string_list, value: [], description: "The generation will halt if one of the stop sequences is output" },
    ]
});

var ImagenTaskType;
(function (ImagenTaskType) {
    ImagenTaskType["TEXT_IMAGE"] = "TEXT_IMAGE";
    ImagenTaskType["EDIT_MODE_INPAINT_REMOVAL"] = "EDIT_MODE_INPAINT_REMOVAL";
    ImagenTaskType["EDIT_MODE_INPAINT_INSERTION"] = "EDIT_MODE_INPAINT_INSERTION";
    ImagenTaskType["EDIT_MODE_BGSWAP"] = "EDIT_MODE_BGSWAP";
    ImagenTaskType["EDIT_MODE_OUTPAINT"] = "EDIT_MODE_OUTPAINT";
    ImagenTaskType["CUSTOMIZATION_SUBJECT"] = "CUSTOMIZATION_SUBJECT";
    ImagenTaskType["CUSTOMIZATION_STYLE"] = "CUSTOMIZATION_STYLE";
    ImagenTaskType["CUSTOMIZATION_CONTROLLED"] = "CUSTOMIZATION_CONTROLLED";
    ImagenTaskType["CUSTOMIZATION_INSTRUCT"] = "CUSTOMIZATION_INSTRUCT";
})(ImagenTaskType || (ImagenTaskType = {}));
var ImagenMaskMode;
(function (ImagenMaskMode) {
    ImagenMaskMode["MASK_MODE_USER_PROVIDED"] = "MASK_MODE_USER_PROVIDED";
    ImagenMaskMode["MASK_MODE_BACKGROUND"] = "MASK_MODE_BACKGROUND";
    ImagenMaskMode["MASK_MODE_FOREGROUND"] = "MASK_MODE_FOREGROUND";
    ImagenMaskMode["MASK_MODE_SEMANTIC"] = "MASK_MODE_SEMANTIC";
})(ImagenMaskMode || (ImagenMaskMode = {}));
var ThinkingLevel;
(function (ThinkingLevel) {
    ThinkingLevel["HIGH"] = "HIGH";
    ThinkingLevel["LOW"] = "LOW";
    ThinkingLevel["THINKING_LEVEL_UNSPECIFIED"] = "THINKING_LEVEL_UNSPECIFIED";
})(ThinkingLevel || (ThinkingLevel = {}));

// Virtual providers from studio
var CustomProviders;
(function (CustomProviders) {
    CustomProviders["virtual_lb"] = "virtual_lb";
    CustomProviders["virtual_mediator"] = "virtual_mediator";
    CustomProviders["test"] = "test";
})(CustomProviders || (CustomProviders = {}));
({
    ...Providers,
    ...CustomProviders
});
({
    virtual_lb: {
        id: CustomProviders.virtual_lb},
    virtual_mediator: {
        id: CustomProviders.virtual_mediator},
    test: {
        id: CustomProviders.test},
});

var SupportedIntegrations;
(function (SupportedIntegrations) {
    SupportedIntegrations["gladia"] = "gladia";
    SupportedIntegrations["github"] = "github";
    SupportedIntegrations["aws"] = "aws";
    SupportedIntegrations["magic_pdf"] = "magic_pdf";
    SupportedIntegrations["serper"] = "serper";
    SupportedIntegrations["resend"] = "resend";
    SupportedIntegrations["ask_user_webhook"] = "ask_user_webhook";
})(SupportedIntegrations || (SupportedIntegrations = {}));

var MeterNames;
(function (MeterNames) {
    MeterNames["analyzed_pages"] = "analyzed_pages";
    MeterNames["extracted_tables"] = "extracted_tables";
    MeterNames["analyzed_images"] = "analyzed_images";
    MeterNames["input_token_used"] = "input_token_used";
    MeterNames["output_token_used"] = "output_token_used";
    MeterNames["task_run"] = "task_run";
})(MeterNames || (MeterNames = {}));

var ProjectRoles;
(function (ProjectRoles) {
    ProjectRoles["owner"] = "owner";
    ProjectRoles["admin"] = "admin";
    ProjectRoles["manager"] = "manager";
    ProjectRoles["developer"] = "developer";
    ProjectRoles["application"] = "application";
    ProjectRoles["consumer"] = "consumer";
    ProjectRoles["executor"] = "executor";
    ProjectRoles["reader"] = "reader";
    ProjectRoles["billing"] = "billing";
    ProjectRoles["member"] = "member";
    ProjectRoles["app_member"] = "app_member";
    ProjectRoles["content_superadmin"] = "content_superadmin";
})(ProjectRoles || (ProjectRoles = {}));
var ResourceVisibility;
(function (ResourceVisibility) {
    ResourceVisibility["public"] = "public";
    ResourceVisibility["account"] = "account";
    ResourceVisibility["project"] = "project";
})(ResourceVisibility || (ResourceVisibility = {}));
/**
 * System interaction category enum.
 * Categories group one or more system interactions for default model assignment.
 */
var SystemInteractionCategory;
(function (SystemInteractionCategory) {
    SystemInteractionCategory["content_type"] = "content_type";
    SystemInteractionCategory["intake"] = "intake";
    SystemInteractionCategory["analysis"] = "analysis";
    SystemInteractionCategory["non_applicable"] = "non_applicable";
})(SystemInteractionCategory || (SystemInteractionCategory = {}));
/**
 * Map system interaction endpoints to categories.
 */
({
    "ExtractInformation": SystemInteractionCategory.intake,
    "SelectDocumentType": SystemInteractionCategory.intake,
    "GenerateMetadataModel": SystemInteractionCategory.content_type,
    "ChunkDocument": SystemInteractionCategory.intake,
    "IdentifyTextSections": SystemInteractionCategory.intake,
    "AnalyzeDocument": SystemInteractionCategory.analysis,
    "ReduceTextSections": SystemInteractionCategory.analysis,
    "GenericAgent": SystemInteractionCategory.non_applicable,
    "AdhocTaskAgent": SystemInteractionCategory.non_applicable,
    "Mediator": SystemInteractionCategory.non_applicable,
    "AnalyzeConversation": SystemInteractionCategory.analysis,
    "GetAgentConversationTopic": SystemInteractionCategory.analysis,
});
// export interface ProjectConfigurationEmbeddings {
//     environment: string;
//     max_tokens: number;
//     dimensions: number;
//     model?: string;
// }
var SupportedEmbeddingTypes;
(function (SupportedEmbeddingTypes) {
    SupportedEmbeddingTypes["text"] = "text";
    SupportedEmbeddingTypes["image"] = "image";
    SupportedEmbeddingTypes["properties"] = "properties";
})(SupportedEmbeddingTypes || (SupportedEmbeddingTypes = {}));
var FullTextType;
(function (FullTextType) {
    FullTextType["full_text"] = "full_text";
})(FullTextType || (FullTextType = {}));
({
    ...SupportedEmbeddingTypes,
    ...FullTextType
});

var PromptStatus;
(function (PromptStatus) {
    PromptStatus["draft"] = "draft";
    PromptStatus["published"] = "published";
    PromptStatus["archived"] = "archived";
})(PromptStatus || (PromptStatus = {}));
var PromptSegmentDefType;
(function (PromptSegmentDefType) {
    PromptSegmentDefType["chat"] = "chat";
    PromptSegmentDefType["template"] = "template";
})(PromptSegmentDefType || (PromptSegmentDefType = {}));
var TemplateType;
(function (TemplateType) {
    TemplateType["jst"] = "jst";
    TemplateType["handlebars"] = "handlebars";
    TemplateType["text"] = "text";
})(TemplateType || (TemplateType = {}));

var ResolvableRefType;
(function (ResolvableRefType) {
    ResolvableRefType["project"] = "Project";
    ResolvableRefType["projects"] = "Projects";
    ResolvableRefType["environment"] = "Environment";
    ResolvableRefType["user"] = "User";
    ResolvableRefType["account"] = "Account";
    ResolvableRefType["interaction"] = "Interaction";
    ResolvableRefType["userGroup"] = "UserGroup";
})(ResolvableRefType || (ResolvableRefType = {}));

var CollectionStatus;
(function (CollectionStatus) {
    CollectionStatus["active"] = "active";
    CollectionStatus["archived"] = "archived";
})(CollectionStatus || (CollectionStatus = {}));

var ContentObjectApiHeaders;
(function (ContentObjectApiHeaders) {
    ContentObjectApiHeaders["COLLECTION_ID"] = "x-collection-id";
    ContentObjectApiHeaders["PROCESSING_PRIORITY"] = "x-processing-priority";
    ContentObjectApiHeaders["CREATE_REVISION"] = "x-create-revision";
    ContentObjectApiHeaders["REVISION_LABEL"] = "x-revision-label";
    /** When set to 'true', prevents this update from triggering workflow rules */
    ContentObjectApiHeaders["SUPPRESS_WORKFLOWS"] = "x-suppress-workflows";
})(ContentObjectApiHeaders || (ContentObjectApiHeaders = {}));
/**
 * Headers for Data Store API calls.
 * Used for Cloud Run session affinity to route requests to the same instance.
 */
var DataStoreApiHeaders;
(function (DataStoreApiHeaders) {
    /** Data store ID for session affinity - routes requests for same store to same instance */
    DataStoreApiHeaders["DATA_STORE_ID"] = "x-data-store-id";
})(DataStoreApiHeaders || (DataStoreApiHeaders = {}));
var ContentObjectStatus;
(function (ContentObjectStatus) {
    ContentObjectStatus["created"] = "created";
    ContentObjectStatus["processing"] = "processing";
    ContentObjectStatus["ready"] = "ready";
    ContentObjectStatus["completed"] = "completed";
    ContentObjectStatus["failed"] = "failed";
    ContentObjectStatus["archived"] = "archived";
})(ContentObjectStatus || (ContentObjectStatus = {}));
var ContentNature;
(function (ContentNature) {
    ContentNature["Video"] = "video";
    ContentNature["Image"] = "image";
    ContentNature["Audio"] = "audio";
    ContentNature["Document"] = "document";
    ContentNature["Code"] = "code";
    ContentNature["Other"] = "other";
})(ContentNature || (ContentNature = {}));
var WorkflowRuleInputType;
(function (WorkflowRuleInputType) {
    WorkflowRuleInputType["single"] = "single";
    WorkflowRuleInputType["multiple"] = "multiple";
    WorkflowRuleInputType["none"] = "none";
})(WorkflowRuleInputType || (WorkflowRuleInputType = {}));
var ImageRenditionFormat;
(function (ImageRenditionFormat) {
    ImageRenditionFormat["jpeg"] = "jpeg";
    ImageRenditionFormat["png"] = "png";
    ImageRenditionFormat["webp"] = "webp";
})(ImageRenditionFormat || (ImageRenditionFormat = {}));
var MarkdownRenditionFormat;
(function (MarkdownRenditionFormat) {
    MarkdownRenditionFormat["docx"] = "docx";
    MarkdownRenditionFormat["pdf"] = "pdf";
})(MarkdownRenditionFormat || (MarkdownRenditionFormat = {}));
/**
 * Matrix of supported content type → format conversions.
 * This is the authoritative source of truth for what renditions can be generated.
 *
 * Key patterns:
 * - Exact MIME types (e.g., 'application/pdf')
 * - Wildcard patterns (e.g., 'image/*', 'video/*')
 */
({
    // Image formats can generate: jpeg, png, webp
    'image/*': [ImageRenditionFormat.jpeg, ImageRenditionFormat.png, ImageRenditionFormat.webp],
    // Video formats can generate: jpeg, png (thumbnails)
    'video/*': [ImageRenditionFormat.jpeg, ImageRenditionFormat.png],
    // PDF can generate: jpeg, png, webp (page images)
    'application/pdf': [ImageRenditionFormat.jpeg, ImageRenditionFormat.png, ImageRenditionFormat.webp],
    // Markdown can generate: pdf, docx (NOT jpeg/png)
    'text/markdown': [MarkdownRenditionFormat.pdf, MarkdownRenditionFormat.docx],
    // Plain text can generate: docx
    'text/plain': [MarkdownRenditionFormat.docx],
    // Office documents can generate: pdf
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [MarkdownRenditionFormat.pdf],
    'application/msword': [MarkdownRenditionFormat.pdf],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': [MarkdownRenditionFormat.pdf],
    'application/vnd.ms-powerpoint': [MarkdownRenditionFormat.pdf],
});
var ContentObjectProcessingPriority;
(function (ContentObjectProcessingPriority) {
    ContentObjectProcessingPriority["normal"] = "normal";
    ContentObjectProcessingPriority["low"] = "low";
})(ContentObjectProcessingPriority || (ContentObjectProcessingPriority = {}));

var ContentEventName;
(function (ContentEventName) {
    ContentEventName["create"] = "create";
    ContentEventName["change_type"] = "change_type";
    ContentEventName["update"] = "update";
    ContentEventName["revision_created"] = "revision_created";
    ContentEventName["delete"] = "delete";
    ContentEventName["workflow_finished"] = "workflow_finished";
    ContentEventName["workflow_execution_request"] = "workflow_execution_request";
    ContentEventName["api_request"] = "api_request";
})(ContentEventName || (ContentEventName = {}));
// Task status enum for processed history
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["SCHEDULED"] = "scheduled";
    TaskStatus["RUNNING"] = "running";
    TaskStatus["COMPLETED"] = "completed";
    TaskStatus["FAILED"] = "failed";
    TaskStatus["CANCELED"] = "canceled";
    TaskStatus["TIMED_OUT"] = "timed_out";
    TaskStatus["TERMINATED"] = "terminated";
    TaskStatus["SENT"] = "sent";
    TaskStatus["RECEIVED"] = "received";
})(TaskStatus || (TaskStatus = {}));
// Task type enum
var TaskType;
(function (TaskType) {
    TaskType["ACTIVITY"] = "activity";
    TaskType["CHILD_WORKFLOW"] = "childWorkflow";
    TaskType["SIGNAL"] = "signal";
})(TaskType || (TaskType = {}));
var WorkflowExecutionStatus;
(function (WorkflowExecutionStatus) {
    WorkflowExecutionStatus[WorkflowExecutionStatus["UNKNOWN"] = 0] = "UNKNOWN";
    WorkflowExecutionStatus[WorkflowExecutionStatus["RUNNING"] = 1] = "RUNNING";
    WorkflowExecutionStatus[WorkflowExecutionStatus["COMPLETED"] = 2] = "COMPLETED";
    WorkflowExecutionStatus[WorkflowExecutionStatus["FAILED"] = 3] = "FAILED";
    WorkflowExecutionStatus[WorkflowExecutionStatus["CANCELED"] = 4] = "CANCELED";
    WorkflowExecutionStatus[WorkflowExecutionStatus["TERMINATED"] = 5] = "TERMINATED";
    WorkflowExecutionStatus[WorkflowExecutionStatus["CONTINUED_AS_NEW"] = 6] = "CONTINUED_AS_NEW";
    WorkflowExecutionStatus[WorkflowExecutionStatus["TIMED_OUT"] = 7] = "TIMED_OUT";
})(WorkflowExecutionStatus || (WorkflowExecutionStatus = {}));
var AgentMessageType;
(function (AgentMessageType) {
    AgentMessageType[AgentMessageType["SYSTEM"] = 0] = "SYSTEM";
    AgentMessageType[AgentMessageType["THOUGHT"] = 1] = "THOUGHT";
    AgentMessageType[AgentMessageType["PLAN"] = 2] = "PLAN";
    AgentMessageType[AgentMessageType["UPDATE"] = 3] = "UPDATE";
    AgentMessageType[AgentMessageType["COMPLETE"] = 4] = "COMPLETE";
    AgentMessageType[AgentMessageType["WARNING"] = 5] = "WARNING";
    AgentMessageType[AgentMessageType["ERROR"] = 6] = "ERROR";
    AgentMessageType[AgentMessageType["ANSWER"] = 7] = "ANSWER";
    AgentMessageType[AgentMessageType["QUESTION"] = 8] = "QUESTION";
    AgentMessageType[AgentMessageType["REQUEST_INPUT"] = 9] = "REQUEST_INPUT";
    AgentMessageType[AgentMessageType["IDLE"] = 10] = "IDLE";
    AgentMessageType[AgentMessageType["TERMINATED"] = 11] = "TERMINATED";
    AgentMessageType[AgentMessageType["STREAMING_CHUNK"] = 12] = "STREAMING_CHUNK";
    AgentMessageType[AgentMessageType["BATCH_PROGRESS"] = 13] = "BATCH_PROGRESS";
})(AgentMessageType || (AgentMessageType = {}));
// ============================================
// CONVERTERS
// ============================================
/**
 * Map old string enum values to AgentMessageType
 */
({
    'system': AgentMessageType.SYSTEM,
    'thought': AgentMessageType.THOUGHT,
    'plan': AgentMessageType.PLAN,
    'update': AgentMessageType.UPDATE,
    'complete': AgentMessageType.COMPLETE,
    'warning': AgentMessageType.WARNING,
    'error': AgentMessageType.ERROR,
    'answer': AgentMessageType.ANSWER,
    'question': AgentMessageType.QUESTION,
    'request_input': AgentMessageType.REQUEST_INPUT,
    'idle': AgentMessageType.IDLE,
    'terminated': AgentMessageType.TERMINATED,
    'streaming_chunk': AgentMessageType.STREAMING_CHUNK,
    'batch_progress': AgentMessageType.BATCH_PROGRESS,
});
/**
 * Map integer values to AgentMessageType (primary format)
 */
({
    0: AgentMessageType.SYSTEM,
    1: AgentMessageType.THOUGHT,
    2: AgentMessageType.PLAN,
    3: AgentMessageType.UPDATE,
    4: AgentMessageType.COMPLETE,
    5: AgentMessageType.WARNING,
    6: AgentMessageType.ERROR,
    7: AgentMessageType.ANSWER,
    8: AgentMessageType.QUESTION,
    9: AgentMessageType.REQUEST_INPUT,
    10: AgentMessageType.IDLE,
    11: AgentMessageType.TERMINATED,
    12: AgentMessageType.STREAMING_CHUNK,
    13: AgentMessageType.BATCH_PROGRESS,
});
/**
 * Status of a file being processed for conversation use.
 */
var FileProcessingStatus;
(function (FileProcessingStatus) {
    /** File is being uploaded to artifact storage */
    FileProcessingStatus["UPLOADING"] = "uploading";
    /** File uploaded, text extraction in progress */
    FileProcessingStatus["PROCESSING"] = "processing";
    /** File is ready for use in conversation */
    FileProcessingStatus["READY"] = "ready";
    /** File processing failed */
    FileProcessingStatus["ERROR"] = "error";
})(FileProcessingStatus || (FileProcessingStatus = {}));

var TrainingSessionStatus;
(function (TrainingSessionStatus) {
    TrainingSessionStatus["created"] = "created";
    TrainingSessionStatus["building"] = "building";
    TrainingSessionStatus["prepared"] = "prepared";
    TrainingSessionStatus["processing"] = "processing";
    TrainingSessionStatus["completed"] = "completed";
    TrainingSessionStatus["cancelled"] = "cancelled";
    TrainingSessionStatus["failed"] = "failed";
})(TrainingSessionStatus || (TrainingSessionStatus = {}));

var TransientTokenType;
(function (TransientTokenType) {
    TransientTokenType["userInvite"] = "user-invite";
    TransientTokenType["migration"] = "migration";
})(TransientTokenType || (TransientTokenType = {}));

var Datacenters;
(function (Datacenters) {
    Datacenters["aws"] = "aws";
    Datacenters["gcp"] = "gcp";
    Datacenters["azure"] = "azure";
})(Datacenters || (Datacenters = {}));
var BillingMethod;
(function (BillingMethod) {
    BillingMethod["stripe"] = "stripe";
    BillingMethod["invoice"] = "invoice";
})(BillingMethod || (BillingMethod = {}));
var AccountType;
(function (AccountType) {
    AccountType["vertesia"] = "vertesia";
    AccountType["partner"] = "partner";
    AccountType["free"] = "free";
    AccountType["customer"] = "customer";
    AccountType["unknown"] = "unknown";
})(AccountType || (AccountType = {}));

var ApiVersions;
(function (ApiVersions) {
    ApiVersions[ApiVersions["COMPLETION_RESULT_V1"] = 20250925] = "COMPLETION_RESULT_V1";
})(ApiVersions || (ApiVersions = {}));

/**
 * Agent Observability Telemetry Types
 *
 * These types define the event-based model for agent observability.
 */
// ============================================================================
// Enums
// ============================================================================
/**
 * Types of telemetry events
 */
var AgentEventType;
(function (AgentEventType) {
    AgentEventType["AgentRunStarted"] = "agent_run_started";
    AgentEventType["AgentRunCompleted"] = "agent_run_completed";
    AgentEventType["LlmCall"] = "llm_call";
    AgentEventType["ToolCall"] = "tool_call";
})(AgentEventType || (AgentEventType = {}));
/**
 * Types of LLM calls in a conversation
 */
var LlmCallType;
(function (LlmCallType) {
    /** Initial conversation start */
    LlmCallType["Start"] = "start";
    /** Resuming with tool results */
    LlmCallType["ResumeTools"] = "resume_tools";
    /** Resuming with user message */
    LlmCallType["ResumeUser"] = "resume_user";
    /** Checkpoint resume (after conversation summarization) */
    LlmCallType["Checkpoint"] = "checkpoint";
    /** Nested interaction call from within tools */
    LlmCallType["NestedInteraction"] = "nested_interaction";
})(LlmCallType || (LlmCallType = {}));
/**
 * Types of tools that can be called
 */
var TelemetryToolType;
(function (TelemetryToolType) {
    /** Built-in tools (e.g., plan, search) */
    TelemetryToolType["Builtin"] = "builtin";
    /** Interaction-based tools */
    TelemetryToolType["Interaction"] = "interaction";
    /** Remote/MCP tools */
    TelemetryToolType["Remote"] = "remote";
    /** Skill tools */
    TelemetryToolType["Skill"] = "skill";
})(TelemetryToolType || (TelemetryToolType = {}));

/**
 * Prompt transformer preset for template files with frontmatter
 * Supports .jst, .hbs, and plain text files
 */
/**
 * Zod schema for prompt frontmatter validation
 */
const PromptFrontmatterSchema = z.object({
    // Required fields
    role: z.nativeEnum(PromptRole, {
        errorMap: () => ({ message: 'Role must be one of: safety, system, user, assistant, negative' })
    }),
    // Optional fields
    content_type: z.nativeEnum(TemplateType).optional(),
    schema: z.string().optional(),
    name: z.string().optional(),
    externalId: z.string().optional(),
}).strict();
/**
 * MUST be kept in sync with @vertesia/common InCodePrompt
 * Zod schema for prompt definition
 */
const PromptDefinitionSchema = z.object({
    role: z.nativeEnum(PromptRole),
    content: z.string(),
    content_type: z.nativeEnum(TemplateType),
    schema: z.any().optional(),
    name: z.string().optional(),
    externalId: z.string().optional(),
});
/**
 * Normalize schema path for import
 * - Adds './' prefix if not a relative path
 * - Replaces .ts with .js
 * - Adds .js if no extension
 *
 * @param schemaPath - Original schema path from frontmatter
 * @returns Normalized path for ES module import
 */
function normalizeSchemaPath(schemaPath) {
    let normalized = schemaPath.trim();
    // Add './' prefix if not already a relative path
    if (!normalized.startsWith('.')) {
        normalized = './' + normalized;
    }
    // Get the extension
    const ext = path$1.extname(normalized);
    if (ext === '.ts') {
        // Replace .ts with .js
        normalized = normalized.slice(0, -3) + '.js';
    }
    else if (!ext) {
        // No extension, add .js
        normalized = normalized + '.js';
    }
    // If extension is already .js or something else, leave as is
    return normalized;
}
/**
 * Infer content type from file extension
 *
 * @param filePath - Path to the prompt file
 * @returns Inferred content type
 */
function inferContentType(filePath) {
    const ext = path$1.extname(filePath).toLowerCase();
    switch (ext) {
        case '.jst':
            return TemplateType.jst;
        case '.hbs':
            return TemplateType.handlebars;
        default:
            return TemplateType.text;
    }
}
/**
 * Build a PromptDefinition from frontmatter and content
 *
 * @param frontmatter - Parsed frontmatter object
 * @param content - Prompt content (body of the file)
 * @param filePath - Path to the prompt file (for content type inference)
 * @returns Prompt definition object and optional imports
 */
function buildPromptDefinition(frontmatter, content, filePath) {
    // Determine content type from frontmatter or file extension
    const content_type = frontmatter.content_type || inferContentType(filePath);
    const prompt = {
        role: frontmatter.role,
        content,
        content_type,
    };
    // Add optional fields
    if (frontmatter.name) {
        prompt.name = frontmatter.name;
    }
    if (frontmatter.externalId) {
        prompt.externalId = frontmatter.externalId;
    }
    // Handle schema import if specified
    let imports;
    let schemaImportName;
    if (frontmatter.schema) {
        const normalizedPath = normalizeSchemaPath(frontmatter.schema);
        schemaImportName = '__promptSchema';
        imports = [`import ${schemaImportName} from '${normalizedPath}';`];
    }
    return { prompt, imports, schemaImportName };
}
/**
 * Prompt transformer preset
 * Transforms template files with ?prompt suffix into prompt definition objects
 *
 * Supported file types:
 * - .jst (JavaScript template literals) → content_type: 'jst'
 * - .hbs (Handlebars templates) → content_type: 'handlebars'
 * - .txt or other → content_type: 'text'
 *
 * @example
 * ```typescript
 * import PROMPT from './prompt.hbs?prompt';
 * // PROMPT is an InCodePrompt object
 * ```
 */
const promptTransformer = {
    pattern: /\?prompt$/,
    schema: PromptDefinitionSchema,
    transform: (content, filePath) => {
        const { frontmatter, content: promptContent } = parseFrontmatter(content);
        // Validate frontmatter
        const frontmatterValidation = PromptFrontmatterSchema.safeParse(frontmatter);
        if (!frontmatterValidation.success) {
            const errors = frontmatterValidation.error.errors
                .map((err) => {
                const path = err.path.length > 0 ? err.path.join('.') : 'frontmatter';
                return `  - ${path}: ${err.message}`;
            })
                .join('\n');
            throw new Error(`Invalid frontmatter in ${filePath}:\n${errors}`);
        }
        // Build prompt definition
        const { prompt, imports, schemaImportName } = buildPromptDefinition(frontmatter, promptContent, filePath);
        // If schema is specified, generate custom code with schema reference
        if (schemaImportName) {
            // Build the code manually to avoid JSON.stringify issues with schema reference
            const lines = [
                'export default {',
                `  role: "${prompt.role}",`,
                `  content: ${JSON.stringify(prompt.content)},`,
                `  content_type: "${prompt.content_type}",`,
                `  schema: ${schemaImportName}`,
            ];
            if (prompt.name) {
                lines.splice(4, 0, `  name: ${JSON.stringify(prompt.name)},`);
            }
            if (prompt.externalId) {
                lines.splice(4, 0, `  externalId: ${JSON.stringify(prompt.externalId)},`);
            }
            lines.push('};');
            const code = lines.join('\n');
            return {
                data: prompt,
                imports,
                code,
            };
        }
        // Standard case without schema
        return {
            data: prompt,
        };
    }
};

export { PromptDefinitionSchema, PromptRole, SkillDefinitionSchema, TemplateType, parseFrontmatter, promptTransformer, rawTransformer, skillCollectionTransformer, skillTransformer, vertesiaImportPlugin };
//# sourceMappingURL=build-tools.js.map
