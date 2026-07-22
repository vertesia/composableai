import { existsSync } from 'node:fs';
import path from 'node:path';

export function isTemplateScaffoldPackageName(name) {
    return name === 'plugin-template' || /^(integration|smoke)-test-plugin(-npm)?-\d+$/.test(name ?? '');
}

export function hasSelectedExamplesModule(root = process.cwd()) {
    return existsSync(path.join(root, 'src/modules/examples'));
}

export function shouldRejectTemplateExampleIds(packageName, root = process.cwd()) {
    return !isTemplateScaffoldPackageName(packageName) && !hasSelectedExamplesModule(root);
}

export function isTemplateExampleId(id) {
    return id === 'examples' || id.startsWith('examples:') || id.startsWith('examples/');
}
