export {
    AgentChart, isRechartsSpec, isVegaLiteSpec, type AgentChartSpec,
    type RechartsChartSpec,
    type VegaLiteChartSpec
} from "./AgentChart";
export * from "./AnimatedThinkingDots";
export * from "./JumpingDots";
export { ModernAgentConversation } from "./ModernAgentConversation";
export { VegaLiteChart } from "./VegaLiteChart";
export * from "./WaitingMessages";
// MessageInput types for external use
export type { SelectedDocument, UploadedFile } from "./ModernAgentOutput/MessageInput";
// AskUser widget for displaying agent prompts/questions
export {
    AskUserWidget,
    ConfirmationWidget, type AskUserOption, type AskUserWidgetProps, type ConfirmationWidgetProps
} from "./AskUserWidget";
// MessageItem widget and types for external use
export { default as MessageItem } from "./ModernAgentOutput/MessageItem";
export type { MessageItemProps } from "./ModernAgentOutput/MessageItem";
// MessagesContainer widget and types for external use
export { default as MessagesContainer } from "./ModernAgentOutput/MessagesContainer";
export type { MessagesContainerProps } from "./ModernAgentOutput/MessagesContainer";
// Header widget and types for external use
export { default as Header } from "./ModernAgentOutput/Header";
export type { HeaderProps } from "./ModernAgentOutput/Header";
// StreamingMessage widget and types for external use
export { default as StreamingMessage } from "./ModernAgentOutput/StreamingMessage";
export type { StreamingMessageProps } from "./ModernAgentOutput/StreamingMessage";
export * from "./SkillWidgetProvider";
// Conversation theming — shared primitives & context
export { ConversationThemeProvider, useConversationTheme } from "./theme/ConversationThemeContext";
export type { ConversationTheme, ThemeClassValue, ViewMode } from "./theme/ConversationThemeContext";
// Conversation theming — per-component types & resolvers
export {
    resolveAllMessagesMixedTheme,
    type AllMessagesMixedThemeClasses, type AllMessagesMixedTheme, type ResolvedAllMessagesMixedThemeClasses,
} from "./theme/resolveAllMessagesMixedTheme";
export {
    resolveBatchProgressPanelTheme,
    type BatchProgressPanelThemeClasses, type BatchProgressPanelTheme, type ResolvedBatchProgressPanelThemeClasses,
} from "./theme/resolveBatchProgressPanelTheme";
export {
    resolveHeaderTheme,
    type HeaderThemeClasses, type HeaderTheme, type ResolvedHeaderThemeClasses,
} from "./theme/resolveHeaderTheme";
export {
    resolveMessageInputTheme,
    type MessageInputThemeClasses, type MessageInputTheme, type ResolvedMessageInputThemeClasses,
} from "./theme/resolveMessageInputTheme";
export {
    resolveMessageItemTheme,
    type MessageItemThemeClasses, type MessageItemTheme, type ResolvedMessageItemThemeClasses,
} from "./theme/resolveMessageItemTheme";
export {
    resolveModernAgentConversationTheme,
    type ModernAgentConversationThemeClasses, type ModernAgentConversationTheme, type ResolvedModernAgentConversationThemeClasses,
} from "./theme/resolveModernAgentConversationTheme";
export {
    resolvePlanPanelTheme,
    type PlanPanelThemeClasses, type PlanPanelTheme, type ResolvedPlanPanelThemeClasses,
} from "./theme/resolvePlanPanelTheme";
export {
    resolveStreamingMessageTheme,
    type StreamingMessageThemeClasses, type StreamingMessageTheme, type ResolvedStreamingMessageThemeClasses,
} from "./theme/resolveStreamingMessageTheme";
export {
    resolveToolCallGroupTheme,
    type ToolCallGroupThemeClasses, type ToolCallGroupTheme, type ResolvedToolCallGroupThemeClasses,
} from "./theme/resolveToolCallGroupTheme";
export {
    resolveWorkstreamTabsTheme,
    type WorkstreamTabsThemeClasses, type WorkstreamTabsTheme, type ResolvedWorkstreamTabsThemeClasses,
} from "./theme/resolveWorkstreamTabsTheme";

