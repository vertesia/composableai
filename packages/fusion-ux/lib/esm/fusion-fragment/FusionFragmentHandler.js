import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * FusionFragmentHandler - Code block handler component
 * Parses fusion-fragment code blocks and renders them
 */
import { useMemo } from 'react';
import { parseAndValidateTemplate } from '../validation/validateTemplate.js';
import { FusionFragmentRenderer } from './FusionFragmentRenderer.js';
import { useFusionFragmentContextSafe } from './FusionFragmentContext.js';
const styles = {
    error: {
        backgroundColor: 'var(--red-2, #fef2f2)',
        border: '1px solid var(--red-6, #fca5a5)',
        borderRadius: '8px',
        padding: '16px',
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        fontSize: '13px',
    },
    errorTitle: {
        fontWeight: 600,
        color: 'var(--red-11, #dc2626)',
        marginBottom: '8px',
    },
    errorMessage: {
        color: 'var(--red-10, #ef4444)',
        whiteSpace: 'pre-wrap',
    },
    noContext: {
        backgroundColor: 'var(--yellow-2, #fefce8)',
        border: '1px solid var(--yellow-6, #fde047)',
        borderRadius: '8px',
        padding: '16px',
    },
    noContextTitle: {
        fontSize: '14px',
        fontWeight: 600,
        color: 'var(--yellow-11, #ca8a04)',
        marginBottom: '8px',
    },
    noContextMessage: {
        fontSize: '13px',
        color: 'var(--gray-11, #6b7280)',
    },
    loading: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        minHeight: '150px',
        borderRadius: '8px',
        border: '1px solid var(--gray-6, #e5e7eb)',
        backgroundColor: 'var(--gray-2, #f9fafb)',
    },
    loadingIcon: {
        width: '32px',
        height: '32px',
        color: 'var(--gray-9, #9ca3af)',
    },
    loadingText: {
        fontSize: '14px',
        color: 'var(--gray-9, #9ca3af)',
    },
    loadingDots: {
        display: 'flex',
        gap: '4px',
    },
    loadingDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: 'var(--gray-6, #d1d5db)',
        animation: 'fusion-fragment-bounce 1s infinite',
    },
};
/**
 * Check if JSON parsing failed due to incomplete content (streaming)
 * vs actually invalid JSON structure
 */
function isIncompleteJson(code) {
    const trimmed = code.trim();
    // Empty or very short content is likely incomplete
    if (trimmed.length < 2)
        return true;
    // Must start with { for a valid JSON object
    if (!trimmed.startsWith('{'))
        return false;
    // Try to parse - if it succeeds, it's not incomplete
    try {
        JSON.parse(trimmed);
        return false; // Valid JSON
    }
    catch (e) {
        const message = e instanceof Error ? e.message : '';
        // Common indicators of incomplete JSON during streaming
        const incompleteIndicators = [
            'unexpected end',
            'unterminated string',
            'expected',
            'unexpected token',
        ];
        const lowerMessage = message.toLowerCase();
        if (incompleteIndicators.some(ind => lowerMessage.includes(ind))) {
            // Additional check: count brackets to see if they're unbalanced
            let braceCount = 0;
            let bracketCount = 0;
            let inString = false;
            let escaped = false;
            for (const char of trimmed) {
                if (escaped) {
                    escaped = false;
                    continue;
                }
                if (char === '\\') {
                    escaped = true;
                    continue;
                }
                if (char === '"') {
                    inString = !inString;
                    continue;
                }
                if (!inString) {
                    if (char === '{')
                        braceCount++;
                    else if (char === '}')
                        braceCount--;
                    else if (char === '[')
                        bracketCount++;
                    else if (char === ']')
                        bracketCount--;
                }
            }
            // If brackets are unbalanced or we're in an unclosed string, it's incomplete
            return braceCount > 0 || bracketCount > 0 || inString;
        }
        // For other parse errors, consider it invalid rather than incomplete
        return false;
    }
}
/**
 * Loading placeholder shown while streaming incomplete JSON
 */
function LoadingPlaceholder() {
    return (_jsxs("div", { style: styles.loading, children: [_jsx("style", { children: `
        @keyframes fusion-fragment-bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      ` }), _jsxs("svg", { style: styles.loadingIcon, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("polyline", { points: "16 18 22 12 16 6" }), _jsx("polyline", { points: "8 6 2 12 8 18" })] }), _jsx("span", { style: styles.loadingText, children: "Loading fragment..." }), _jsx("div", { style: styles.loadingDots, children: [0, 1, 2].map(i => (_jsx("div", { style: {
                        ...styles.loadingDot,
                        animationDelay: `${i * 150}ms`,
                    } }, i))) })] }));
}
/**
 * Error display component
 */
function ParseError({ message }) {
    return (_jsxs("div", { style: styles.error, children: [_jsx("div", { style: styles.errorTitle, children: "Failed to parse fusion-fragment" }), _jsx("div", { style: styles.errorMessage, children: message })] }));
}
/**
 * Warning when no context is available
 */
function NoContextWarning({ template }) {
    const requiredKeys = template.sections
        .flatMap(s => s.fields || [])
        .map(f => f.key);
    return (_jsxs("div", { style: styles.noContext, children: [_jsx("div", { style: styles.noContextTitle, children: "No data context available" }), _jsxs("div", { style: styles.noContextMessage, children: ["This fusion-fragment requires data with keys: ", requiredKeys.join(', '), ".", _jsx("br", {}), "Wrap this component in a FusionFragmentProvider with the required data."] })] }));
}
/**
 * FusionFragmentHandler - Handles fusion-fragment code blocks
 *
 * This component is designed to be used as a code block renderer.
 * It parses the JSON template from the code block and renders it
 * using data from the FusionFragmentContext.
 *
 * @example
 * ```tsx
 * // In your markdown renderer:
 * const codeBlockRenderers = {
 *   'fusion-fragment': ({ code }) => <FusionFragmentHandler code={code} />
 * };
 * ```
 */
export function FusionFragmentHandler({ code, data: propData, onUpdate: propOnUpdate, }) {
    // Try to get context (may be null if no provider)
    const context = useFusionFragmentContextSafe();
    // Use prop data or context data
    const data = propData ?? context?.data;
    const onUpdate = propOnUpdate ?? context?.onUpdate;
    const sendMessage = context?.sendMessage;
    // Check if JSON is incomplete (streaming) - show loading placeholder
    const incomplete = useMemo(() => isIncompleteJson(code), [code]);
    // Parse and validate the template (only if not obviously incomplete)
    const result = useMemo(() => {
        if (incomplete) {
            return { valid: false, errors: [], template: undefined };
        }
        const dataKeys = data ? Object.keys(data) : [];
        return parseAndValidateTemplate(code, dataKeys);
    }, [code, data, incomplete]);
    // Show loading placeholder for incomplete JSON (streaming in progress)
    if (incomplete) {
        return _jsx(LoadingPlaceholder, {});
    }
    // Parse error
    if (!result.valid && !result.template) {
        const parseError = result.errors.find(e => e.path === 'root' && e.message.includes('JSON'));
        if (parseError) {
            return _jsx(ParseError, { message: parseError.message });
        }
    }
    // Template parsed but no data available
    if (result.template && !data) {
        return _jsx(NoContextWarning, { template: result.template });
    }
    // Template parsed but validation errors (show errors in renderer)
    if (result.template && data) {
        return (_jsx(FusionFragmentRenderer, { template: result.template, data: data, onUpdate: onUpdate, agentMode: sendMessage ? { enabled: true, sendMessage } : undefined }));
    }
    // Fallback for any other error case
    return (_jsx(ParseError, { message: result.errors.map(e => `${e.path}: ${e.message}`).join('\n') }));
}
/**
 * Factory function to create a code block renderer configuration
 * for use with markdown renderers that support custom code blocks
 */
export function createFusionFragmentCodeBlockRenderer() {
    return {
        language: 'fusion-fragment',
        component: FusionFragmentHandler,
    };
}
//# sourceMappingURL=FusionFragmentHandler.js.map