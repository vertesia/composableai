import type * as Wire from './wire-types.generated.js';

export type AgentConversationArchiveSource = Wire.AgentConversationArchiveSource;
export type AgentConversationNativeArchiveAttestation = Wire.AgentConversationNativeArchiveAttestation;
export type ImportAgentRunConversationArchivePayload = Wire.ImportAgentRunConversationArchivePayload;
export type ImportAgentRunConversationArchiveResponse = Wire.ImportAgentRunConversationArchiveResponse;

export type {
    NativeConversationImportCompleteness,
    NativeConversationImportDiagnostic,
    NativeConversationImportDiagnosticCode,
    NativeConversationImportReport,
} from '@llumiverse/conversation';
