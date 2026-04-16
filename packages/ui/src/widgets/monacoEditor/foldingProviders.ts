import type * as monaco from 'monaco-editor';

const foldingProvidersRegistered = new Set<string>();

export function registerCustomFoldingProviders(monacoInstance: typeof import('monaco-editor')): void {
    // Markdown: fold by heading hierarchy (## sections)
    if (!foldingProvidersRegistered.has('markdown')) {
        foldingProvidersRegistered.add('markdown');
        monacoInstance.languages.registerFoldingRangeProvider('markdown', {
            provideFoldingRanges(model) {
                const ranges: monaco.languages.FoldingRange[] = [];
                const lines = model.getLinesContent();
                const headingPattern = /^(#{1,6})\s/;
                const stack: Array<{ level: number; line: number }> = [];

                for (let i = 0; i < lines.length; i++) {
                    const lineNumber = i + 1;
                    const match = headingPattern.exec(lines[i]);
                    if (match) {
                        const level = match[1].length;
                        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                            const top = stack.pop()!;
                            if (lineNumber - 1 > top.line) {
                                ranges.push({ start: top.line, end: lineNumber - 1 });
                            }
                        }
                        stack.push({ level, line: lineNumber });
                    }
                }
                const lastLine = lines.length;
                while (stack.length > 0) {
                    const top = stack.pop()!;
                    if (lastLine > top.line) {
                        ranges.push({ start: top.line, end: lastLine });
                    }
                }
                return ranges;
            },
        });
    }

    // JS/TS: brace folding (if/else, functions) takes priority, followed by
    // markdown heading folding inside template literals. Brace ranges are
    // returned first so Monaco resolves conflicts in their favour.
    // Using registerFoldingRangeProvider (not createFoldingRangeFromSelection)
    // so both live in the same range set and Monaco's overlap resolution is
    // consistent — headings are always bounded by their template literal close.
    for (const lang of ['javascript', 'typescript'] as const) {
        if (!foldingProvidersRegistered.has(lang)) {
            foldingProvidersRegistered.add(lang);
            monacoInstance.languages.registerFoldingRangeProvider(lang, {
                provideFoldingRanges(model) {
                    const lines = model.getLinesContent();
                    const headingPattern = /^(#{1,6})\s/;

                    const braceRanges: monaco.languages.FoldingRange[] = [];
                    const headingRanges: monaco.languages.FoldingRange[] = [];

                    const braceStack: number[] = [];
                    const headingStack: Array<{ level: number; line: number }> = [];

                    let inTemplate = false;
                    let inString = false;
                    let stringChar = '';

                    for (let i = 0; i < lines.length; i++) {
                        const lineNumber = i + 1;
                        const line = lines[i];
                        const lineStartedInTemplate = inTemplate;

                        for (let j = 0; j < line.length; j++) {
                            const ch = line[j];
                            if (ch === '\\') { j++; continue; }
                            if (inString) { if (ch === stringChar) inString = false; continue; }
                            if (inTemplate) { if (ch === '`') inTemplate = false; continue; }
                            if (ch === '`') { inTemplate = true; continue; }
                            if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
                            // Brace folding — only outside strings/templates
                            if (ch === '{') { braceStack.push(lineNumber); }
                            if (ch === '}' && braceStack.length > 0) {
                                const start = braceStack.pop()!;
                                // If there is non-whitespace content after `}` on this line
                                // (e.g. "} else {"), end the fold at the previous line so
                                // the continuation is not hidden inside the fold.
                                const restOfLine = line.slice(j + 1).trimStart();
                                const endLine = restOfLine.length > 0 ? lineNumber - 1 : lineNumber;
                                if (endLine > start) braceRanges.push({ start, end: endLine });
                            }
                        }

                        // Markdown heading folding — only inside template literals
                        if (lineStartedInTemplate) {
                            const match = headingPattern.exec(line);
                            if (match) {
                                const level = match[1].length;
                                while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
                                    const top = headingStack.pop()!;
                                    if (lineNumber - 1 > top.line) {
                                        headingRanges.push({ start: top.line, end: lineNumber - 1 });
                                    }
                                }
                                headingStack.push({ level, line: lineNumber });
                            }
                            // Template just closed — seal all open heading sections here
                            if (!inTemplate) {
                                while (headingStack.length > 0) {
                                    const top = headingStack.pop()!;
                                    if (lineNumber > top.line) {
                                        headingRanges.push({ start: top.line, end: lineNumber });
                                    }
                                }
                            }
                        }
                    }

                    // Brace ranges first → Monaco resolves conflicts in their favour
                    return [...braceRanges, ...headingRanges];
                },
            });
        }
    }
}
