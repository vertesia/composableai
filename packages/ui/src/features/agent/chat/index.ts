// Resource deep-link resolver — lets an embedding app override how agent resource references
// (documents, collections, interactions, ...) map to routes/links in the chat.
export {
    type AgentResourceLinkReference,
    type AgentResourceResolver,
    AgentResourceResolverProvider,
    type AgentResourceTarget,
    type ResourceResolveContext,
    useAgentResourceResolver,
} from '@vertesia/ui/widgets';
export {
    AgentApprovalModeSelector,
    type AgentApprovalModeSelectorProps,
} from './AgentApprovalModeSelector';
export {
    AgentChart,
    type AgentChartSpec,
    isRechartsSpec,
    isVegaLiteSpec,
    type RechartsChartSpec,
    type VegaLiteChartSpec,
} from './AgentChart';
export {
    AgentChatFixtureReplay,
    type AgentChatFixtureReplayProps,
    type AgentChatReplayFixture,
    type AgentChatReplayStreamingFrame,
    type AgentChatReplayStreamingMessage,
} from './AgentChatFixtureReplay';
export { AgentChatPlaybackControls, type AgentChatPlaybackControlsProps } from './AgentChatPlaybackControls';
export * from './AnimatedThinkingDots';
// AskUser widget for displaying agent prompts/questions
export {
    type AskUserOption,
    AskUserWidget,
    type AskUserWidgetProps,
    ConfirmationWidget,
    type ConfirmationWidgetProps,
} from './AskUserWidget';
// Artifact listing hook (run artifacts tree) for external use
export {
    type ArtifactTreeNode,
    isSystemArtifact,
    type UseArtifactsResult,
    useArtifacts,
} from './hooks/useArtifacts.js';
// Document side-panel hook for external use
export { type UseDocumentPanelResult, useDocumentPanel } from './hooks/useDocumentPanel.js';
export * from './JumpingDots';
export {
    type AgentMessageFilter,
    ModernAgentConversation,
    type ModernAgentConversationProps,
    type SendAgentMessageFn,
    type StartWorkflowFn,
    type StartWorkflowOptions,
} from './ModernAgentConversation';
// AgentConversationViewMode type for external use
export type {
    AgentConversationViewMode,
    AgentInitialRequestTemplate,
    AgentInitialRequestTemplateContext,
} from './ModernAgentOutput/AllMessagesMixed';
// BatchProgressPanel types for external use
export type { BatchProgressPanelClassNames } from './ModernAgentOutput/BatchProgressPanel';
export type { HeaderProps } from './ModernAgentOutput/Header';
// Header widget and types for external use
export { default as Header } from './ModernAgentOutput/Header';
// MessageInput types for external use
export type { SelectedDocument, UploadedFile } from './ModernAgentOutput/MessageInput';
export type { MessageItemClassNames, MessageItemProps, MessageStyleConfig } from './ModernAgentOutput/MessageItem';
// MessageItem widget and types for external use
export { default as MessageItem, MESSAGE_STYLES } from './ModernAgentOutput/MessageItem';
export type { MessagesContainerProps } from './ModernAgentOutput/MessagesContainer';
// MessagesContainer widget and types for external use
export { default as MessagesContainer } from './ModernAgentOutput/MessagesContainer';
export type { StreamingMessageClassNames, StreamingMessageProps } from './ModernAgentOutput/StreamingMessage';
// StreamingMessage widget and types for external use
export { default as StreamingMessage } from './ModernAgentOutput/StreamingMessage';
// ToolCallGroup types for external use
export type { ToolCallGroupClassNames } from './ModernAgentOutput/ToolCallGroup';
export {
    type AgentChatPlaybackCursor,
    type AgentChatPlaybackState,
    clampPlaybackCursor,
    createPlaybackState,
    getNextUserTurnIndex,
    getPlaybackCursorIndex,
    getPreviousUserTurnIndex,
    isAgentChatPlaybackAvailable,
    isAgentChatPlaybackEnabled,
    isLocalhostAgentChatPlaybackAvailable,
    isLocalhostAgentChatPlaybackEnabled,
} from './playback';
export * from './SkillWidgetProvider';
// Item type of UseDocumentPanelResult.openDocuments
export type { OpenDocument } from './types/document.js';
export { VegaLiteChart } from './VegaLiteChart';
export * from './WaitingMessages';
// Workstream naming / status / lifecycle helpers. Listed explicitly rather than
// re-exported wholesale so that adding a helper to workstreams.ts is not silently
// an addition to this package's public surface.
export {
    formatWorkstreamName,
    getWorkstreamActivityDetails,
    getWorkstreamDisplayName,
    getWorkstreamLaunchDetails,
    getWorkstreamLifecycleStatus,
    getWorkstreamStatusClass,
    isWorkstreamInternalResultMessage,
    isWorkstreamInternalResultText,
    isWorkstreamTerminalMessage,
    type WorkstreamInfo,
    type WorkstreamLaunchDetails,
} from './workstreams.js';
