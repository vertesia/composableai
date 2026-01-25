/**
 * FusionFragmentHandler - Code block handler component
 * Parses fusion-fragment code blocks and renders them
 */

import { useMemo, type ReactElement } from 'react';
import type { FragmentTemplate } from '../types.js';
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
    whiteSpace: 'pre-wrap' as const,
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
    flexDirection: 'column' as const,
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
function isIncompleteJson(code: string): boolean {
  const trimmed = code.trim();

  // Empty or very short content is likely incomplete
  if (trimmed.length < 2) return true;

  // Must start with { for a valid JSON object
  if (!trimmed.startsWith('{')) return false;

  // Try to parse - if it succeeds, it's not incomplete
  try {
    JSON.parse(trimmed);
    return false; // Valid JSON
  } catch (e) {
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
          if (char === '{') braceCount++;
          else if (char === '}') braceCount--;
          else if (char === '[') bracketCount++;
          else if (char === ']') bracketCount--;
        }
      }

      // If brackets are unbalanced or we're in an unclosed string, it's incomplete
      return braceCount > 0 || bracketCount > 0 || inString;
    }

    // For other parse errors, consider it invalid rather than incomplete
    return false;
  }
}

export interface FusionFragmentHandlerProps {
  /** The JSON code from the fusion-fragment code block */
  code: string;
  /** Optional data to use instead of context */
  data?: Record<string, unknown>;
  /** Optional update handler */
  onUpdate?: (key: string, value: unknown) => Promise<void>;
}

/**
 * Loading placeholder shown while streaming incomplete JSON
 */
function LoadingPlaceholder(): ReactElement {
  return (
    <div style={styles.loading}>
      <style>{`
        @keyframes fusion-fragment-bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
      <svg
        style={styles.loadingIcon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
      <span style={styles.loadingText}>Loading fragment...</span>
      <div style={styles.loadingDots}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              ...styles.loadingDot,
              animationDelay: `${i * 150}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Error display component
 */
function ParseError({ message }: { message: string }): ReactElement {
  return (
    <div style={styles.error}>
      <div style={styles.errorTitle}>Failed to parse fusion-fragment</div>
      <div style={styles.errorMessage}>{message}</div>
    </div>
  );
}

/**
 * Warning when no context is available
 */
function NoContextWarning({ template }: { template: FragmentTemplate }): ReactElement {
  const requiredKeys = template.sections
    .flatMap(s => s.fields || [])
    .map(f => f.key);

  return (
    <div style={styles.noContext}>
      <div style={styles.noContextTitle}>No data context available</div>
      <div style={styles.noContextMessage}>
        This fusion-fragment requires data with keys: {requiredKeys.join(', ')}.
        <br />
        Wrap this component in a FusionFragmentProvider with the required data.
      </div>
    </div>
  );
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
export function FusionFragmentHandler({
  code,
  data: propData,
  onUpdate: propOnUpdate,
}: FusionFragmentHandlerProps): ReactElement {
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
    return <LoadingPlaceholder />;
  }

  // Parse error
  if (!result.valid && !result.template) {
    const parseError = result.errors.find(e => e.path === 'root' && e.message.includes('JSON'));
    if (parseError) {
      return <ParseError message={parseError.message} />;
    }
  }

  // Template parsed but no data available
  if (result.template && !data) {
    return <NoContextWarning template={result.template} />;
  }

  // Template parsed but validation errors (show errors in renderer)
  if (result.template && data) {
    return (
      <FusionFragmentRenderer
        template={result.template}
        data={data}
        onUpdate={onUpdate}
        agentMode={sendMessage ? { enabled: true, sendMessage } : undefined}
      />
    );
  }

  // Fallback for any other error case
  return (
    <ParseError
      message={result.errors.map(e => `${e.path}: ${e.message}`).join('\n')}
    />
  );
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
