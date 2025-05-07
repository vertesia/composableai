
export const SECTION_ID_PLACEHOLDER = '%id';

/**
 * An iterative generation workflow uses 2 memory packs one for input and the other for output.
 * The input memory packs must be available in the project blobs bucket at `${tenant_id/memories/${memory_name}/input.tar.gz`.
 * The output memory pack will be generated at `${tenant_id/memories/${memory_name}/output.tar.gz`.
 * Each iteration is overwriting the output memory pack with the new generated content.
 * The complete name of the input and output memory packs are: "${name}/input" and "${name}/output" where name is the base memory name.
 */
export interface IterativeGenerationPayload {
    // the main interaction to execute. If iterative_generation is defined
    // the main interaction will only be used to prepare the iteration (to generate the TOC)
    // otherwise it will be used for the iterative generation too.
    interaction: string;
    // if defined this will be used for the iterative interaction which will generate parts.
    // otherwise the main interaction will be used for iterative generation.
    iterative_interaction?: string;
    // the environment to use
    environment?: string;
    // the model to use
    model?: string;
    // A custom max tokens
    max_tokens?: number;
    // A custom temperature
    temperature?: number;
    // the memory pack group name
    memory: string;
    // the input memory pack mapping
    input_mapping?: Record<string, string>;
    // custom toc schema if any TODO remove this
    toc_schema?: Record<string, any>
    /**
     * If not set to "none" the previously generated content will be passed to the iteration.
     * If not set at all defaults to "section".
     * If "section" is used only the section content previously generated will be passed to the next iteration.
     * If "document" is used the whole previously generated document content will be passed to the next iteration.
     * Defaults to section.
     */
    remembrance_strategy?: "document" | "section" | "none";
    /**
     * If present will save sections in files using the pattern
     * The pattern must include a placeholder for the section id: %id.
     * Examples: `sections/%id.md`, `%id/page.mdx` etc.
     * @see SECTION_ID_PLACEHOLDER
     */
    section_file_pattern?: string;
    /**
     * An optional header to prepend to the section files.
     * The header can contain the following variables:
     * - ${section} - the section object
     * - ${date} - the date when the file was generated
     */
    section_file_header?: string;
}

export interface TocPart {
    id: string;
    name: string;
    description?: string;
    instructions?: string;
}

export interface TocSection {
    id: string;
    name: string;
    description?: string;
    instructions?: string;
    parts?: TocPart[];
}

export interface Toc {
    sections: TocSection[];
}


export interface SectionIndex extends PartIndex {
    parts?: PartIndex[];
}
export interface PartIndex {
    path: number[];
    name: string;
}
export interface TocIndex {
    sections: SectionIndex[];
}

export interface OutputMemoryMeta {
    toc: Toc;
    previouslyGenerated: string;
    lastProcessedPart?: number[] | undefined;
}

export interface Section {
    id: string;
    name: string;
    description?: string;
    content: string;
}
