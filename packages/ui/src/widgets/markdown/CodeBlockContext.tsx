import React, { useMemo } from 'react';

/**
 * Context for passing artifact run ID, callbacks, and the MarkdownRenderer component
 * to code block handlers. MarkdownRenderer is injected here (rather than imported
 * directly in ArtifactContentRenderer) to break the circular dependency:
 *   MarkdownRenderer → codeBlockHandlers → ArtifactContentRenderer → MarkdownRenderer
 */
export interface CodeBlockHandlerContext {
    artifactRunId?: string;
    onProposalSelect?: (optionId: string) => void;
    onProposalSubmit?: (response: string) => void;
    MarkdownRenderer?: React.ComponentType<{ children: string; artifactRunId?: string }>;
}

const CodeBlockContext = React.createContext<CodeBlockHandlerContext>({});

export function CodeBlockHandlerProvider({
    children,
    artifactRunId,
    onProposalSelect,
    onProposalSubmit,
    MarkdownRenderer,
}: CodeBlockHandlerContext & { children: React.ReactNode }) {
    const value = useMemo(
        () => ({ artifactRunId, onProposalSelect, onProposalSubmit, MarkdownRenderer }),
        [artifactRunId, onProposalSelect, onProposalSubmit, MarkdownRenderer]
    );
    return <CodeBlockContext.Provider value={value}>{children}</CodeBlockContext.Provider>;
}

export function useCodeBlockContext() {
    return React.useContext(CodeBlockContext);
}
