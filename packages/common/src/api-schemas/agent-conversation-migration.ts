import {
    ContentHashSchema,
    ConversationRefSchema,
    IdentifierSchema,
    NativeConversationImportReportSchema,
    TimestampSchema,
    ToolDefinitionSchema,
} from '@llumiverse/conversation/schemas';
import { z } from 'zod';
import { EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE } from '../versions.js';
import { CanonicalConversationHeadScopeSchema } from './interaction.js';

export const AgentConversationArchiveSourceSchema = z
    .strictObject({
        subject_run_id: IdentifierSchema,
        owner_run_id: IdentifierSchema,
        scope: CanonicalConversationHeadScopeSchema,
        workflow_id: IdentifierSchema,
        first_workflow_run_id: IdentifierSchema,
        content_hash: ContentHashSchema.regex(/^sha256:[a-f0-9]{64}$/),
        byte_length: z
            .number()
            .int()
            .positive()
            .max(16 * 1024 * 1024),
        storage_generation: z.string().min(1).max(1024),
        immutable_storage_version: z.string().min(1).max(1024).nullable().meta({
            description:
                'An actual immutable backend version when available. Null means the generation is a conditional identity only.',
        }),
    })
    .meta({ id: 'AgentConversationArchiveSource' });

export const AgentConversationNativeArchiveAttestationSchema = z
    .strictObject({
        evidence: z
            .literal('owner_attested')
            .meta({ description: 'Declared by an authorized owner; not provider-verified.' }),
        protocol: z.enum([
            'openai.chat.completions',
            'openai.responses',
            'anthropic.messages',
            'google.generate_content',
            'aws.bedrock.converse',
        ]),
        provider: IdentifierSchema,
        model: IdentifierSchema.nullable().meta({
            description: 'The recorded invocation model, or null when unknown. Never the newly requested target.',
        }),
        completeness: z.enum(['complete', 'fragment', 'unknown']),
        recorded_at: TimestampSchema.meta({
            description: 'The explicitly recorded import timestamp, pinned for operation identity.',
        }),
        evidence_note: z.string().min(1).max(2000),
        tool_definitions: z.array(ToolDefinitionSchema).max(2048).meta({
            description:
                'Historical canonical tool definitions from immutable source evidence or this explicit attestation. Never the current catalog.',
        }),
    })
    .meta({ id: 'AgentConversationNativeArchiveAttestation' });

export const ImportAgentRunConversationArchivePayloadSchema = z
    .discriminatedUnion('type', [
        z.strictObject({ type: z.literal('source') }),
        z.strictObject({
            type: z.literal('attested_native'),
            expected_source: AgentConversationArchiveSourceSchema,
            attestation: AgentConversationNativeArchiveAttestationSchema,
        }),
    ])
    .meta({
        id: 'ImportAgentRunConversationArchivePayload',
        type: 'object',
        required: ['type'],
        discriminator: { propertyName: 'type' },
        // Strict branches own closedness; the propertyless union wrapper must admit their fields.
        additionalProperties: true,
    });

const responseShape = {
    api_version: z.literal(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE),
    source: AgentConversationArchiveSourceSchema,
    continuation_readiness: z.literal('not_validated'),
};
export const ImportAgentRunConversationArchiveResponseSchema = z
    .discriminatedUnion('status', [
        z.strictObject({
            ...responseShape,
            status: z.literal('initialized'),
            head: ConversationRefSchema,
            report: NativeConversationImportReportSchema.optional(),
        }),
        z.strictObject({
            ...responseShape,
            status: z.literal('already_initialized'),
            head: ConversationRefSchema,
            report: NativeConversationImportReportSchema.optional(),
        }),
        z.strictObject({ ...responseShape, status: z.literal('attestation_required') }),
    ])
    .meta({
        id: 'ImportAgentRunConversationArchiveResponse',
        type: 'object',
        required: ['status'],
        discriminator: { propertyName: 'status' },
        // Strict branches own closedness; the propertyless union wrapper must admit their fields.
        additionalProperties: true,
    });
