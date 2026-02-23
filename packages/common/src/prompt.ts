import type { JSONObject, JSONSchema } from "@llumiverse/common";
import { PromptRole } from "@llumiverse/common";
import { ProjectRef } from "./project.js";

export interface ChatPromptSchema {
    role: PromptRole.user | PromptRole.assistant;
    content: string;
}

export enum PromptStatus {
    draft = "draft",
    published = "published",
    archived = "archived",
}


export enum PromptSegmentDefType {
    chat = "chat",
    template = "template",
}

export interface PromptSegmentDef<
    T = string | PromptTemplate | PromptTemplateRef,
> {
    type: PromptSegmentDefType;
    template?: T; // the template id in case of a prompt template
    configuration?: any; // the configuration if any in case of builtin prompts
}
export interface PopulatedPromptSegmentDef
    extends Omit<PromptSegmentDef, "template"> {
    template?: PromptTemplate;
}
/**
 * Used for prompt rendering at interaction execution
 */
export interface ExecutablePromptSegmentDef
    extends Omit<PromptSegmentDef, "template"> {
    template?: ExecutablePromptTemplate;
}

export interface PromptTemplateRef {
    id: string;
    name: string;
    role: PromptRole;
    version: number;
    status: PromptStatus;
    content_type: TemplateType;
}

export interface PromptTemplateRefWithSchema extends PromptTemplateRef {
    inputSchema?: JSONSchema;
}

export enum TemplateType {
    jst = "jst",
    handlebars = "handlebars",
    text = "text",
}
export interface ExecutablePromptTemplate {
    role: PromptRole;
    content: string;
    content_type: TemplateType;
    inputSchema?: JSONSchema;
}
export interface PromptTemplate extends ExecutablePromptTemplate {
    id: string;
    name: string;
    status: PromptStatus;
    version: number;
    // only to be used by published versions
    // the id draft version which is the source of this published version (only when published)
    parent?: string;
    description?: string;
    test_data?: JSONObject; // optional test data satisfying the schema
    script?: string; // cache the template output
    project: string | ProjectRef; // or projectRef? ObjectIdType;
    // The name of a field in the input data that is of the specified schema and on each the template will iterate.
    // If not specified then the schema will define the whole input data
    tags?: string[];
    // only for drafts - when it was last published
    last_published_at?: Date;
    created_by: string,
    updated_by: string,
    created_at: Date;
    updated_at: Date;
}

export interface PromptTemplateForkPayload {
    keepTags?: boolean;
    targetProject?: string;
}

export interface PromptTemplateCreatePayload
    extends Omit<
        PromptTemplate,
        "id" | "created_at" | "updated_at" | "created_by" | "updated_by" | "project" | "status" | "version"
    > { }

export interface PromptTemplateUpdatePayload
    extends Partial<
        Omit<PromptTemplate, "id" | "created_at" | "updated_at" | "created_by" | "updated_by" | "project">
    > { }
