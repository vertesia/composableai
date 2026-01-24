/**
 * FusionFragmentRenderer - Main component
 * Renders a model-generated template with actual data values
 */

import React, { useMemo, type ReactElement } from 'react';
import type { FusionFragmentRendererProps, ValidationError } from '../types.js';
import { validateTemplate } from '../validation/validateTemplate.js';
import { SectionRenderer } from './SectionRenderer.js';

const styles = {
  container: {
    backgroundColor: 'var(--gray-2, #f9fafb)',
    border: '1px solid var(--gray-5, #e5e7eb)',
    borderRadius: '8px',
    padding: '16px 20px',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--gray-12, #1f2937)',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--gray-5, #e5e7eb)',
  },
  footer: {
    fontSize: '12px',
    color: 'var(--gray-10, #9ca3af)',
    marginTop: '16px',
    paddingTop: '12px',
    borderTop: '1px solid var(--gray-5, #e5e7eb)',
  },
  error: {
    backgroundColor: 'var(--red-2, #fef2f2)',
    border: '1px solid var(--red-6, #fca5a5)',
    borderRadius: '8px',
    padding: '16px',
  },
  errorTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--red-11, #dc2626)',
    marginBottom: '12px',
  },
  errorList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  errorItem: {
    fontSize: '13px',
    color: 'var(--red-11, #dc2626)',
    marginBottom: '8px',
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  },
  errorPath: {
    fontSize: '11px',
    color: 'var(--red-9, #ef4444)',
    display: 'block',
  },
  errorSuggestion: {
    fontSize: '12px',
    color: 'var(--gray-11, #6b7280)',
    marginTop: '4px',
    fontStyle: 'italic',
  },
};

/**
 * Component to display validation errors
 */
function ValidationErrors({ errors }: { errors: ValidationError[] }): ReactElement {
  return (
    <div style={styles.error}>
      <div style={styles.errorTitle}>
        Template Validation Failed ({errors.length} error{errors.length > 1 ? 's' : ''})
      </div>
      <ul style={styles.errorList}>
        {errors.map((error, index) => (
          <li key={index} style={styles.errorItem}>
            <span>{error.message}</span>
            <span style={styles.errorPath}>at {error.path}</span>
            {error.suggestion && (
              <span style={styles.errorSuggestion}>\u2192 {error.suggestion}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * FusionFragmentRenderer - Main renderer component
 *
 * Takes a model-generated template and actual data, validates the template,
 * and renders the UI with proper formatting and layout.
 *
 * @example
 * ```tsx
 * <FusionFragmentRenderer
 *   template={{
 *     title: "Fund Parameters",
 *     sections: [{
 *       title: "Identity",
 *       layout: "grid-3",
 *       fields: [
 *         { label: "Firm Name", key: "firmName" },
 *         { label: "Vintage", key: "vintageYear", format: "number" }
 *       ]
 *     }]
 *   }}
 *   data={{ firmName: "Acme Capital", vintageYear: 2024 }}
 * />
 * ```
 */
export function FusionFragmentRenderer({
  template,
  data,
  onUpdate,
  agentMode,
  className,
}: FusionFragmentRendererProps): ReactElement {
  // Validate template against data keys
  const validation = useMemo(() => {
    const dataKeys = Object.keys(data);
    return validateTemplate(template, dataKeys);
  }, [template, data]);

  // Show validation errors if any
  if (!validation.valid) {
    return <ValidationErrors errors={validation.errors} />;
  }

  return (
    <div style={styles.container} className={className}>
      {template.title && (
        <div style={styles.title}>{template.title}</div>
      )}

      {template.sections.map((section, index) => (
        <SectionRenderer
          key={section.title || index}
          section={section}
          data={data}
          onUpdate={onUpdate}
          agentMode={agentMode}
        />
      ))}

      {template.footer && (
        <div style={styles.footer}>{template.footer}</div>
      )}
    </div>
  );
}
