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
    non_applicable = "non_applicable"
}

/**
 * Map system interaction endpoints to categories.
 */
export const SYSTEM_INTERACTION_CATEGORIES: Record<string, SystemInteractionCategory> = {
    "ExtractInformation": SystemInteractionCategory.intake,
    "SelectDocumentType": SystemInteractionCategory.intake,
    "GenerateMetadataModel": SystemInteractionCategory.content_type,
    "ChunkDocument": SystemInteractionCategory.intake,
    "IdentifyTextSections": SystemInteractionCategory.intake,
    "AnalyzeDocument": SystemInteractionCategory.analysis,
    "ReduceTextSections": SystemInteractionCategory.analysis,
    "GenericAgent": SystemInteractionCategory.non_applicable,
    "AdhocTaskAgent": SystemInteractionCategory.non_applicable,
    "Mediator": SystemInteractionCategory.non_applicable,
    "AnalyzeConversation": SystemInteractionCategory.analysis,
    "GetAgentConversationTopic": SystemInteractionCategory.analysis,
};

/**
 * Get category for a system interaction endpoint.
 * Returns undefined if category is non-applicable or endpoint is not recognized.
 * Note: Caller is responsible for determining if the interaction is a system interaction.
 * @param endpoint - The interaction endpoint name
 */
export function getSystemInteractionCategory(endpoint: string): SystemInteractionCategory | undefined {
    if (endpoint.startsWith("sys:")) {
        // Strip sys: prefix
        endpoint = endpoint.substring(4);
    }
    const category = SYSTEM_INTERACTION_CATEGORIES[endpoint];
    if (category === SystemInteractionCategory.non_applicable) {
        return undefined;
    }
    return category || undefined;
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

/**
 * Configuration for starting agents via email.
 * When enabled, emails sent to {interactionName}+{projectId}@{inbound_domain}
 * will start an agent with the email body as the initial message.
 */
export interface EmailAgentStartSettings {
    /** Whether email-triggered agents are enabled for this project */
    enabled: boolean;
    /** The inbound email domain (e.g., "acme.vertesia.io") */
    inbound_domain: string;
    /** Resend webhook signing secret for this project */
    webhook_secret: string;
    /** Optional: Resend API key override for this project */
    resend_api_key?: string;
    /** Optional: Whitelist of allowed sender email domains */
    allowed_sender_domains?: string[];
}

export interface ProjectConfiguration {

    human_context: string;

    /** @deprecated Use defaults.base - kept for backward compatibility */
    default_environment?: string;
    /** @deprecated Use defaults.base - kept for backward compatibility */
    default_model?: string;

    defaults?: ProjectModelDefaults;

    default_visibility?: ResourceVisibility;

    sync_content_properties?: boolean;

    embeddings: {
        text?: ProjectConfigurationEmbeddings;
        image?: ProjectConfigurationEmbeddings;
        properties?: ProjectConfigurationEmbeddings
    }

    datacenter?: string;
    storage_bucket?: string;

    /**
     * Enable real-time streaming of agent LLM responses to clients.
     * When enabled, LLM responses are streamed chunk-by-chunk via Redis pub/sub.
     * Defaults to true if not specified.
     */
    agent_streaming_enabled?: boolean;

    /**
     * Configuration for starting agents via email.
     * When enabled, emails sent to {interactionName}+{projectId}@{inbound_domain}
     * will start an agent with the specified interaction.
     */
    email_agent_start?: EmailAgentStartSettings;

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