export function renderTransformerModule(result) {
    const importsBlock = result.imports?.length ? `${result.imports.join('\n')}\n\n` : '';
    const body = result.code ?? `export default ${JSON.stringify(result.data, null, 2)};`;
    return importsBlock + body;
}

export function validateBuiltInteractionPrompts(config) {
    const issues = [];
    let interactionCount = 0;
    let promptCount = 0;

    for (const collection of config?.interactions ?? []) {
        for (const interaction of collection.interactions ?? []) {
            interactionCount += 1;
            const label = `${collection.name}:${interaction.name}`;
            if (!Array.isArray(interaction.prompts) || interaction.prompts.length === 0) {
                issues.push(`${label} has no prompts`);
                continue;
            }

            for (const [index, prompt] of interaction.prompts.entries()) {
                promptCount += 1;
                for (const field of ['role', 'content', 'content_type']) {
                    if (typeof prompt?.[field] !== 'string' || prompt[field].trim() === '') {
                        issues.push(`${label} prompt ${index} has no ${field}`);
                    }
                }
            }
        }
    }

    if (issues.length > 0) {
        throw new Error(
            `Built interaction prompt validation failed:\n${issues.map((issue) => `- ${issue}`).join('\n')}`,
        );
    }

    return { interactionCount, promptCount };
}
