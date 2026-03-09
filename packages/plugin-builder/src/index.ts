import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Plugin } from "vite";
import { extractTailwindUtilitiesLayer } from "./parse-css.js";

interface VertesiaPluginBuilderOptions {
    inlineCss?: boolean,
    cssVar?: string;
    // the input file. defaults to src/index.css
    input?: string;
    // the output file name. Defaults to plugin.css
    output?: string;
}
export function vertesiaPluginBuilder({
    inlineCss,
    cssVar,
    input,
    output,
}: VertesiaPluginBuilderOptions = {}) {
    const CSS_VAR = cssVar || 'css';
    if (!input) input = 'src/index.css';
    if (!output) output = 'plugin.css';
    const inputRelative = input.startsWith('./') ? input : `./${input}`;
    const jsOutput = output.replace('.css', '.js');
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
            delete bundle['virtual-vertesia-plugin-css-entry.js'];
        },
        writeBundle(this, options, bundle) {
            if (!inlineCss) return;
            // Look for the generated CSS file in the output directory
            const keys = Object.keys(bundle).filter(k => k === output);
            if (keys.length === 1) {
                const asset = bundle[jsOutput];
                if (asset) {
                    const cssContent = readFileSync(join(options.dir!, output), 'utf8')
                    if (cssContent) {
                        const exportedContent = extractTailwindUtilitiesLayer(cssContent);
                        if (exportedContent) {
                            const jsFile = join(options.dir!, jsOutput);
                            const jsContent = readFileSync(jsFile, 'utf8');
                            writeFileSync(jsFile, `${jsContent}\nexport const ${CSS_VAR} = \`\n${exportedContent}\n\`;\n`);
                        }
                    }
                }
            }
        },
    } satisfies Plugin;
}
