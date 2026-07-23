import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { extractPluginCss } from './parse-css.js';

interface VertesiaPluginBuilderOptions {
    /**
     * @deprecated Ignored. The build always emits both payloads: the full stylesheet file
     * (linked by shadow-isolation hosts) and the inlined css export (injected by
     * css-isolation hosts). The host picks by the isolation mode it renders in.
     */
    inlineCss?: boolean;
    /**
     * Name of the inlined css export. Defaults to `css`, which is the name Vertesia hosts
     * read - keep the default unless your host expects something else. The `cssMeta`
     * capability export is emitted under that exact name, unless the module already
     * exports its own cssMeta.
     */
    cssVar?: string;
    // the input file. defaults to src/index.css
    input?: string;
    // the output file name. Defaults to plugin.css
    output?: string;
}
export function vertesiaPluginBuilder({ cssVar, input, output }: VertesiaPluginBuilderOptions = {}) {
    const CSS_VAR = cssVar || 'css';
    if (!input) input = 'src/index.css';
    if (!output) output = 'plugin.css';
    const inputRelative = input.startsWith('./') ? input : `./${input}`;
    const jsOutput = output.replace('.css', '.js');
    // set per build in generateBundle when the module hand-writes a cssMeta export
    let userCssMetaExport = false;
    return {
        name: 'vertesia-plugin-builder',
        apply: 'build' as const,
        enforce: 'post',
        resolveId(id) {
            // Create a virtual CSS entry module
            if (id === 'virtual:vertesia-plugin-css-entry') {
                return id;
            }
            return null;
        },
        load(id) {
            if (id === 'virtual:vertesia-plugin-css-entry') {
                // This creates a virtual JS file that imports your actual CSS
                return `import "${inputRelative}";`;
            }
            return null;
        },
        buildStart(this) {
            // This emits the file into the build pipeline
            this.emitFile({
                type: 'chunk',
                fileName: 'virtual-vertesia-plugin-css-entry.js',
                id: 'virtual:vertesia-plugin-css-entry',
            });
        },
        generateBundle(_options, bundle) {
            const virtualChunkFileName = 'virtual-vertesia-plugin-css-entry.js';
            delete bundle[virtualChunkFileName];
            // Remove references to the virtual chunk from Rollup metadata first.
            for (const chunk of Object.values(bundle)) {
                if (chunk.type === 'chunk' && chunk.code) {
                    chunk.imports = chunk.imports.filter((entry) => !entry.endsWith(virtualChunkFileName));
                    chunk.dynamicImports = chunk.dynamicImports.filter(
                        (entry) => !entry.endsWith(virtualChunkFileName),
                    );
                }
            }
            // the chunk's export list is authoritative regardless of how the bundler
            // rewrote the source (aliasing, const-to-var lowering, minification)
            const jsChunk = bundle[jsOutput];
            userCssMetaExport = jsChunk?.type === 'chunk' && jsChunk.exports.includes('cssMeta');
        },
        writeBundle(this, options, bundle) {
            // Look for the generated CSS file in the output directory
            const keys = Object.keys(bundle).filter((k) => k === output);
            if (keys.length === 1) {
                const asset = bundle[jsOutput];
                if (asset) {
                    // biome-ignore lint/style/noNonNullAssertion: intentional non-null assertion; TS can't prove narrowing here
                    const cssContent = readFileSync(join(options.dir!, output), 'utf8');
                    if (cssContent) {
                        const exportedContent = extractPluginCss(cssContent);
                        if (exportedContent) {
                            // biome-ignore lint/style/noNonNullAssertion: intentional non-null assertion; TS can't prove narrowing here
                            const jsFile = join(options.dir!, jsOutput);
                            const jsContent = readFileSync(jsFile, 'utf8');
                            // never append a second cssMeta export next to a hand-written one:
                            // a duplicate export name would make the module fail to parse
                            if (userCssMetaExport) {
                                this.warn(
                                    "the plugin module exports its own cssMeta: keeping it as is. Declare supports: ['css'] in it for the host to trust the inline css.",
                                );
                            }
                            writeFileSync(
                                jsFile,
                                jsContent + buildCssExports(CSS_VAR, exportedContent, !userCssMetaExport),
                            );
                        }
                    }
                }
            }
        },
    } satisfies Plugin;
}

/**
 * Build the statements appended to the plugin module for the inlined css.
 * JSON.stringify emits a valid JS string literal: a template literal would swallow the
 * backslashes in Tailwind's escaped selectors. The cssMeta export lists the isolation
 * modes the build's payloads support — the manifest picks the mode, the artifact
 * advertises what it can honor; its shape is AppCssMeta in @vertesia/common. The meta
 * export is omitted when the module already carries its own.
 */
export function buildCssExports(cssVar: string, css: string, includeMeta = true): string {
    const meta = includeMeta ? `\nexport const cssMeta = { supports: ['shadow', 'css'] };` : '';
    return `\nexport const ${cssVar} = ${JSON.stringify(css)};${meta}\n`;
}
