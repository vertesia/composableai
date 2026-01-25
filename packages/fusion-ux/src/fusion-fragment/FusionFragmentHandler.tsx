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
};

export interface FusionFragmentHandlerProps {
  /** The JSON code from the fusion-fragment code block */
  code: string;
  /** Optional data to use instead of context */
  data?: Record<string, unknown>;
  /** Optional update handler */
  onUpdate?: (key: string, value: unknown) => Promise<void>;
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

  // Parse and validate the template
  const result = useMemo(() => {
    const dataKeys = data ? Object.keys(data) : [];
    return parseAndValidateTemplate(code, dataKeys);
  }, [code, data]);

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
