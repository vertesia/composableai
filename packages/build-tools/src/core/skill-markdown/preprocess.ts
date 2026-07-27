/**
 * Semantic preprocessor for skill Markdown.
 *
 * Markdown gives syntax but no semantics: in "Use `execute_parallel_work_streams` with
 * `customer_orders`", nothing distinguishes the tool from the sample data. Rather than guess,
 * this preprocessor recognises exactly three explicit constructs and leaves every other byte of
 * prose untouched:
 *
 *   - `{@tool search_documents}`   → renders as `` `search_documents` ``
 *   - `{@skill workstreams}`       → renders as `` `learn_workstreams` ``
 *   - ```` ```json tool=batch_execute ```` → validated against that tool, tag stripped on render
 *
 * What that buys is *fail-closed validation and consistent rendering*, not centralised naming —
 * the name is still spelled out at each site, so a rename still touches every reference. The
 * `{@skill}` form earns the most: it takes the `learn_` prefix convention out of the author's
 * hands, and that convention is exactly what drifts.
 *
 * Deliberately pure. It reads no files, imports no registry, and never inspects Git; it is a
 * function of (markdown, catalog) alone, so a build, a test, and CI cannot disagree — and a
 * tarball or shallow checkout builds identically. Schema knowledge stays with the caller via
 * `validateExample`, which keeps AJV and the dispatch model out of build-tools entirely.
 */

/** The runtime convention: a skill named `x` is offered to the model as the tool `learn_x`. */
export const DEFAULT_SKILL_TOOL_PREFIX = 'learn_';

export type SkillReferenceKind = 'tool' | 'skill';

export interface SkillReference {
    kind: SkillReferenceKind;
    /** Name exactly as written in the source. */
    name: string;
    /** Text substituted into the rendered Markdown. */
    rendered: string;
    /** 1-based line of the construct, for error messages. */
    line: number;
    resolved: boolean;
}

export interface SkillExample {
    /** Tool named by the fence's `tool=` tag. */
    tool: string;
    /** Fence language, e.g. `json`. */
    lang: string;
    /** Raw fence body. */
    source: string;
    /** Parsed body. Absent when the body is not strict JSON. */
    value?: unknown;
    /** 1-based line of the opening fence. */
    line: number;
    /** Problems from JSON parsing and from `validateExample`. */
    errors: string[];
}

export interface PreprocessSkillMarkdownOptions {
    /** Tool names the consuming build can resolve. */
    tools: ReadonlySet<string>;
    /** Skill names the consuming build can resolve. */
    skills: ReadonlySet<string>;
    /**
     * Names owned by more than one provider. An unqualified reference to one of these is an
     * error: a flat name set would silently collapse the two definitions and resolve the
     * reference to whichever the consumer happened to keep. Collisions must be resolved at the
     * source, or the syntax grows provider qualification — not be papered over here.
     */
    ambiguousTools?: ReadonlySet<string>;
    ambiguousSkills?: ReadonlySet<string>;
    /**
     * Tools that exist but whose schema this build cannot see, so a tagged example for them
     * would get an existence check and nothing more.
     *
     * Tagging one is rejected rather than silently half-checked: a `tool=` fence is a claim that
     * the payload is verified, and a fence that only *looks* gated is worse than an untagged one.
     */
    unvalidatableTools?: ReadonlySet<string>;
    /**
     * Consumer-supplied validation for a tagged example: schema checks, dispatcher resolution,
     * anything else that needs the registry. Returns human-readable problems; empty means valid.
     * Exceptions it throws are captured as errors, never propagated.
     *
     * `createSchemaExampleValidator` in this package is the usual implementation.
     */
    validateExample?: (example: { tool: string; value: unknown }) => string[];
    /** Override the `learn_` prefix if the runtime convention ever changes. */
    skillToolPrefix?: string;
    /**
     * Fence languages a `tool=` tag may appear on. A tag on a `bash` or `python` fence is a
     * mistake: the body is not a tool payload, so nothing would ever validate it.
     */
    exampleLanguages?: ReadonlySet<string>;
}

export interface PreprocessSkillMarkdownResult {
    /** Markdown with constructs rendered and validation tags stripped. */
    markdown: string;
    references: SkillReference[];
    examples: SkillExample[];
    /**
     * Every problem found, already prefixed with a line number. The caller decides whether to
     * throw — this function never does, so it stays usable from a linter as well as from a build.
     */
    errors: string[];
}

/** Snake_case, with hyphens tolerated because some remote skill names use them. */
const NAME = /^[a-z][a-z0-9_-]*$/;

/** `{@word …}`. The keyword is matched loosely so `{@tolo x}` is a reported typo, not prose. */
const CONSTRUCT = /\{@([A-Za-z][A-Za-z0-9_]*)([^}]*)\}/g;

/** A code fence line: up to 3 spaces of indent, a run of markers, then the info string. */
const FENCE = /^([ \t]{0,3})(`{3,}|~{3,})[ \t]*(.*)$/;

/** Inline code spans, masked so `` `{@tool x}` `` can document the syntax without invoking it. */
const INLINE_CODE = /(`+)(?:[^`]|(?!\1)`)*\1/g;

/** NUL cannot occur in these sources, so masking round-trips even through numeric prose. */
const MASK_OPEN = '\u0000';
const MASK_CLOSE = '\u0001';

const TAG_PREFIX = 'tool=';

const DEFAULT_EXAMPLE_LANGUAGES: ReadonlySet<string> = new Set(['json']);

/** Substitute constructs on a single line, leaving inline code spans verbatim. */
function renderLine(
    source: string,
    line: number,
    options: PreprocessSkillMarkdownOptions,
    references: SkillReference[],
    errors: string[],
): string {
    if (!source.includes('{@')) {
        return source;
    }
    const prefix = options.skillToolPrefix ?? DEFAULT_SKILL_TOOL_PREFIX;

    const masked: string[] = [];
    const text = source.replace(INLINE_CODE, (span) => {
        masked.push(span);
        return `${MASK_OPEN}${masked.length - 1}${MASK_CLOSE}`;
    });

    // Every `{@` must be consumed by a well-formed construct. An unterminated one would
    // otherwise sail through as prose and reach the model as raw template syntax.
    const consumed = new Set<number>();

    const rendered = text.replace(CONSTRUCT, (whole, keyword: string, rest: string, offset: number) => {
        consumed.add(offset);
        const args = rest.trim().split(/\s+/).filter(Boolean);

        if (keyword !== 'tool' && keyword !== 'skill') {
            errors.push(`line ${line}: unknown construct '{@${keyword} …}' (expected {@tool …} or {@skill …})`);
            return whole;
        }
        if (args.length !== 1 || !NAME.test(args[0])) {
            errors.push(`line ${line}: '${whole}' must name exactly one ${keyword}`);
            return whole;
        }

        const name = args[0];
        const kind: SkillReferenceKind = keyword;
        const known = kind === 'tool' ? options.tools : options.skills;
        const ambiguous = (kind === 'tool' ? options.ambiguousTools : options.ambiguousSkills)?.has(name) ?? false;
        const resolved = known.has(name) && !ambiguous;
        const target = kind === 'skill' ? `${prefix}${name}` : name;

        if (ambiguous) {
            errors.push(
                `line ${line}: '${whole}' is ambiguous — more than one provider defines the ${kind} ` +
                    `'${name}'. Resolve the collision at the source before referencing it.`,
            );
        } else if (!known.has(name)) {
            errors.push(`line ${line}: '${whole}' refers to a ${kind} no provider registers`);
        }
        references.push({ kind, name, rendered: `\`${target}\``, line, resolved });
        return `\`${target}\``;
    });

    for (const opener of text.matchAll(/\{@/g)) {
        if (!consumed.has(opener.index)) {
            errors.push(`line ${line}: malformed construct at '${text.slice(opener.index, opener.index + 24)}…'`);
        }
    }

    return rendered.replace(
        new RegExp(`${MASK_OPEN}(\\d+)${MASK_CLOSE}`, 'g'),
        (_, index: string) => masked[Number(index)],
    );
}

function isClosingFence(line: string, marker: string): boolean {
    const match = FENCE.exec(line);
    return !!match && match[2][0] === marker[0] && match[2].length >= marker.length && match[3].trim() === '';
}

/**
 * Render explicit constructs and validate tagged examples.
 *
 * Never throws and never reads the environment: a caller wanting a hard failure inspects
 * `errors`, or uses `assertSkillMarkdown`.
 */
export function preprocessSkillMarkdown(
    markdown: string,
    options: PreprocessSkillMarkdownOptions,
): PreprocessSkillMarkdownResult {
    const lines = markdown.split('\n');
    const out: string[] = [];
    const references: SkillReference[] = [];
    const examples: SkillExample[] = [];
    const errors: string[] = [];

    for (let i = 0; i < lines.length; ) {
        const fence = FENCE.exec(lines[i]);
        if (!fence) {
            out.push(renderLine(lines[i], i + 1, options, references, errors));
            i++;
            continue;
        }

        // Fenced block: emitted verbatim apart from the `tool=` tag, which is build metadata.
        const [, indent, marker, info] = fence;
        const openLine = i + 1;
        const parts = info.trim().split(/\s+/).filter(Boolean);
        const lang = parts[0] ?? '';
        const tagIndexes = parts.flatMap((p, index) => (index > 0 && p.startsWith(TAG_PREFIX) ? [index] : []));
        const tagIndex = tagIndexes[0] ?? -1;
        const tag = tagIndex === -1 ? undefined : parts[tagIndex].slice(TAG_PREFIX.length);

        if (tagIndexes.length > 1) {
            // Silently honouring the first would validate against a tool the author did not mean.
            errors.push(
                `line ${openLine}: fence carries ${tagIndexes.length} ${TAG_PREFIX} tags ` +
                    `(${tagIndexes.map((index) => parts[index]).join(', ')}); exactly one is allowed`,
            );
        }

        const body: string[] = [];
        let j = i + 1;
        for (; j < lines.length && !isClosingFence(lines[j], marker); j++) {
            body.push(lines[j]);
        }
        const closed = j < lines.length;

        if (!closed && tag !== undefined) {
            // An unterminated tagged fence swallows the rest of the document into its "payload",
            // so the tag validates nonsense and the prose below it is never rendered.
            errors.push(`line ${openLine}: fence tagged '${TAG_PREFIX}${tag}' is never closed`);
        }

        // Rewrite the opening line only when there is a tag to remove, so untagged fences keep
        // their exact spelling — a preprocessor that reformats untouched prose is a liability.
        const open =
            tagIndex === -1
                ? lines[i]
                : `${indent}${marker}${parts.filter((_, index) => index !== tagIndex).join(' ')}`;
        out.push(open, ...body);
        if (closed) {
            out.push(lines[j]);
        }
        i = closed ? j + 1 : j;

        if (tag !== undefined) {
            examples.push(validateFenceExample(tag, lang, body.join('\n'), openLine, options, errors));
        }
    }

    return { markdown: out.join('\n'), references, examples, errors };
}

function validateFenceExample(
    tag: string,
    lang: string,
    body: string,
    line: number,
    options: PreprocessSkillMarkdownOptions,
    errors: string[],
): SkillExample {
    const example: SkillExample = { tool: tag, lang, source: body, line, errors: [] };
    const languages = options.exampleLanguages ?? DEFAULT_EXAMPLE_LANGUAGES;

    if (!NAME.test(tag)) {
        example.errors.push(`'${TAG_PREFIX}${tag}' is not a valid tool name`);
    } else if (!languages.has(lang)) {
        // A tag on a shell or Python fence can never be validated, so it is a false assurance:
        // the fence looks gated in review while nothing checks it.
        example.errors.push(
            `is tagged '${TAG_PREFIX}${tag}' on a '${lang || '(none)'}' fence; only ` +
                `${[...languages].join(', ')} fences can be validated`,
        );
    } else if (!options.tools.has(tag)) {
        example.errors.push(`is tagged for '${tag}', which no provider registers`);
    } else if (options.ambiguousTools?.has(tag)) {
        example.errors.push(`is tagged for '${tag}', which more than one provider defines`);
    } else if (options.unvalidatableTools?.has(tag)) {
        example.errors.push(
            `is tagged for '${tag}', whose schema this build cannot see, so the payload cannot be ` +
                'verified. Remove the tag, or make the schema available to the catalog.',
        );
    } else {
        try {
            example.value = JSON.parse(body);
        } catch (err) {
            example.errors.push(`is tagged for validation but is not strict JSON: ${(err as Error).message}`);
        }
        if (example.value !== undefined && options.validateExample) {
            try {
                example.errors.push(...options.validateExample({ tool: tag, value: example.value }));
            } catch (err) {
                // The no-throw contract is the caller's guarantee; a broken validator must be
                // reported as a finding, not turned into an exception from an unrelated frame.
                example.errors.push(`could not be validated: ${(err as Error).message}`);
            }
        }
    }

    errors.push(...example.errors.map((message) => `line ${line}: example ${message}`));
    return example;
}

/** Convenience for build callers: preprocess, or throw once with every problem listed. */
export function assertSkillMarkdown(
    markdown: string,
    options: PreprocessSkillMarkdownOptions,
    source: string,
): PreprocessSkillMarkdownResult {
    const result = preprocessSkillMarkdown(markdown, options);
    if (result.errors.length > 0) {
        throw new Error(`Skill markdown errors in ${source}:\n${result.errors.map((e) => `  - ${e}`).join('\n')}`);
    }
    return result;
}
