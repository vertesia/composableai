import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractTailwindUtilitiesLayer } from "./parse-css.js";

export function exportPluginCss({
    cssVar = 'css',
} = {}) {
    const CSS_VAR = cssVar || 'css';
    return {
        name: 'export-plugin-css',
        async writeBundle(options: any, bundle: any) {
            // Look for the generated CSS file in the output directory
            const keys = Object.keys(bundle).filter(k => k.endsWith('.css'));
            for (const cssKey of keys) {
                const jsKey = cssKey.replace('.css', '.js');
                const asset = bundle[jsKey];
                if (asset) {
                    const cssContent = readFileSync(join(options.dir, cssKey), 'utf8')
                    if (cssContent) {
                        const exportedContent = extractTailwindUtilitiesLayer(cssContent);
                        if (exportedContent) {
                            const jsFile = join(options.dir, jsKey);
                            const jsContent = readFileSync(jsFile, 'utf8');
                            writeFileSync(jsFile, `${jsContent}\nexport const ${CSS_VAR} = \`\n${exportedContent}\n\`;\n`);
                        }
                    }
                }
            }
        },
    }
}
