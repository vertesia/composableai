import { JSONSchema4 } from "json-schema";
import type { JSONObject } from "@llumiverse/core";
import { ProjectRef } from "./project.js";
import { PromptRole } from "@llumiverse/core";

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

export interface PromptTemplateRef {
    id: string;
    name: string;
    role: PromptRole;
    version: number;
    status: PromptStatus;
    content_type: TemplateType;
}

export interface PromptTemplateRefWithSchema extends PromptTemplateRef {
    inputSchema?: JSONSchema4;
}

export enum TemplateType {
    text = "text",
    js = "js",
    jst = "jst",
}

export interface PromptTemplate {
    id: string;
    name: string;
    role: PromptRole;
    status: PromptStatus;
    version: number;
    // only to be used by published versions
    // the id draft version which is the source of this published version (only when published)
    parent?: string;
    description?: string;
    content_type: TemplateType;
    content: string;
    test_data?: JSONObject; // optional test data satisfying the schema
    script?: string; // cache the template output
    inputSchema?: JSONSchema4;
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
