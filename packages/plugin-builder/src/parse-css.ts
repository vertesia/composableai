
import { CssStylesheetAST, parse, stringify } from '@adobe/css-tools';

export function extractTailwindUtilitiesLayer(content: string) {
    const obj = parse(content, {});
    let result = '';
    for (const rule of obj.stylesheet.rules) {
        if (rule.type === 'layer' && rule.layer === 'utilities') {
            if (rule.rules) {
                const output = {
                    type: 'stylesheet',
                    stylesheet: {
                        rules: rule.rules
                    }
                } as CssStylesheetAST;
                result = stringify(output, {});
            }
        }
    }
    return result;
}
