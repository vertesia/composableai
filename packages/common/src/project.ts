import { SupportedIntegrations } from "./integrations.js";
import { AccountRef } from "./user.js";

export interface ICreateProjectPayload {
    name: string;
    namespace: string;
    description?: string;
    auto_config?: boolean;
}
export enum ProjectRoles {
    owner = "owner", // all permissions
    admin = "admin", // all permissions
    project_admin = "project_admin", // all permissions but manage_account, manage_billing
    developer = "developer", // all permissions but manage_account, manage_billing, manage_roles, delete
    application = "application", // executor + request_pk
    consumer = "consumer", // required permissions for users of micro apps
    executor = "executor", // can only read and execute interactions
    reader = "reader", // can only read (browse)
    billing = "billing", // can only manage billings
    member = "member", // can only access, but no specific permissions
    app_member = "app_member", // used to mark an user have access to an application. does not provide any permission on its own
    content_superadmin = "content_superadmin", // can see all content objects and collections
}

export function isRoleIncludedIn(role: string, includingRole: string) {
    switch (includingRole) {
        case ProjectRoles.owner:
            return true; // includes billing to?
        case ProjectRoles.admin:
            return role !== ProjectRoles.billing && role !== ProjectRoles.owner;
        case ProjectRoles.developer:
            return role === ProjectRoles.developer;
        case ProjectRoles.billing:
            return role === ProjectRoles.billing;
        default:
            return false;
    }
}


export interface PopulatedProjectRef {
    id: string;
    name: string;
    account: AccountRef
}
export interface ProjectRef {
    id: string;
    name: string;
    account: string;
    /**
     * Only set when fetching the list of projects visible to an user which is an org admin or owner.
     * If present and true, it means that the project is not accessible to the user.(even if it visible in listing)
     * If not present or false then the project is accessible to the user.
     */
    restricted?: boolean;
}

export enum ResourceVisibility {
    public = "public",
    account = "account",
    project = "project"
}


// ==========================================
// Project Model Defaults Types
// ==========================================

/**
 * Environment and model pair for a default configuration.
 */
export interface ModelDefault {
    environment: string;
    model: string;
}

/**
 * Modality-specific default model overrides.
 * These override the base default when specific input modalities are detected.
 */
export interface ModalityDefaults {
    /** Override for inputs containing images */
    image?: ModelDefault;
    /** Override for inputs containing video (requires video-capable model) */
    video?: ModelDefault;
}

/**
 * System interaction category enum.
 * Categories group one or more system interactions for default model assignment.
 */
export enum SystemInteractionCategory {
    content_type = "content_type",
    intake = "intake",
    analysis = "analysis",
    agent = "agent",
    conversation = "conversation",
    other = "other",
}

/**
 * Map system interaction endpoints to categories.
 * Uses sys: namespace endpoints (e.g., "sys:ExtractInformation").
 */
export const SYSTEM_INTERACTION_CATEGORIES: Record<string, SystemInteractionCategory> = {
    "sys:ExtractInformation": SystemInteractionCategory.intake,
    "sys:SelectDocumentType": SystemInteractionCategory.intake,
    "sys:GenerateMetadataModel": SystemInteractionCategory.content_type,
    "sys:ChunkDocument": SystemInteractionCategory.intake,
    "sys:IdentifyTextSections": SystemInteractionCategory.intake,
    "sys:AnalyzeDocument": SystemInteractionCategory.analysis,
    "sys:ReduceTextSections": SystemInteractionCategory.analysis,
    "sys:GenericAgent": SystemInteractionCategory.agent,
    "sys:AdhocTaskAgent": SystemInteractionCategory.agent,
    "sys:Mediator": SystemInteractionCategory.other,
    "sys:AnalyzeConversation": SystemInteractionCategory.conversation,
    "sys:GetAgentConversationTopic": SystemInteractionCategory.conversation,
};

/**
 * Get category for a system interaction endpoint.
 * Returns 'other' for unmapped sys: interactions, undefined for non-system interactions.
 */
export function getSystemInteractionCategory(endpoint: string): SystemInteractionCategory | undefined {
    if (!endpoint.startsWith("sys:")) return undefined;
    return SYSTEM_INTERACTION_CATEGORIES[endpoint] ?? SystemInteractionCategory.other;
}

export type SystemDefaults = {
    [K in SystemInteractionCategory]?: ModelDefault;
};

/**
 * Extensible project defaults using map/dictionary pattern.
 */
export interface ProjectModelDefaults {
    /** Base default model - used when no other default applies */
    base?: ModelDefault;
    /** Modality-based overrides (image, video) - override base when specific input modalities detected */
    modality?: ModalityDefaults;
    /** System interaction category defaults */
    system?: SystemDefaults;
}

// ==========================================
// Project Configuration
// ==========================================

export interface ProjectConfiguration {

    human_context: string;

    /** @deprecated Use defaults.base - kept for backward compatibility */
    default_environment?: string;
    /** @deprecated Use defaults.base - kept for backward compatibility */
    default_model?: string;

    defaults?: ProjectModelDefaults;

    default_visibility?: ResourceVisibility;

    embeddings: {
        text?: ProjectConfigurationEmbeddings;
        image?: ProjectConfigurationEmbeddings;
        properties?: ProjectConfigurationEmbeddings
    }

    datacenter?: string;
    storage_bucket?: string;

}

// export interface ProjectConfigurationEmbeddings {
//     environment: string;
//     max_tokens: number;
//     dimensions: number;
//     model?: string;
// }

export enum SupportedEmbeddingTypes {
    text = "text",
    image = "image",
    properties = "properties"
}

export enum FullTextType {
    full_text = "full_text"
}

export type SearchTypes = SupportedEmbeddingTypes | FullTextType;

export const SearchTypes = {
    ...SupportedEmbeddingTypes,
    ...FullTextType
} as const;

export interface ProjectConfigurationEmbeddings {
    environment: string;
    enabled: boolean;
    dimensions: number;
    max_tokens?: number;
    model?: string;
}

export interface Project {
    id: string;
    name: string;
    namespace: string;
    description?: string;
    account: string;
    configuration: ProjectConfiguration;
    integrations: Map<string, any>;
    plugins: string[];
    created_by: string,
    updated_by: string,
    created_at: Date;
    updated_at: Date;
}

export interface ProjectCreatePayload {
    name: string;
    description?: string;
}

export interface ProjectUpdatePayload extends Partial<Project> { }


export const ProjectRefPopulate = "id name account";


export interface EmbeddingsStatusResponse {
    status: string;
    embeddingRunsInProgress?: number;
    totalRunsInProgress?: number;
    totalIndexableObjects?: number;
    embeddingsModels?: string[];
    objectsWithEmbeddings?: number;
    vectorIndex: {
        status: "READY" | "PENDING" | "DELETING" | "ABSENT",
        name?: string,
        type?: string
    }
}

export interface ProjectIntegrationListEntry {
    id: SupportedIntegrations;
    enabled: boolean;
}