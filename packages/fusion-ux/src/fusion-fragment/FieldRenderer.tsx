/**
 * FieldRenderer component
 * Renders a single field with formatting and optional edit capability
 */

import React, { useMemo, useState, useCallback, type ReactElement } from 'react';
import type { FieldRendererProps, FieldTemplate } from '../types.js';

// Styles as constants
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    minWidth: 0, // Allow text truncation
  },
  label: {
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--gray-11, #6b7280)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  value: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--gray-12, #1f2937)',
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    fontVariantNumeric: 'tabular-nums' as const,
    letterSpacing: '-0.02em',
  },
  unit: {
    fontSize: '12px',
    color: 'var(--gray-10, #9ca3af)',
    marginLeft: '4px',
  },
  highlight: {
    success: { color: 'var(--green-11, #15803d)' },
    warning: { color: 'var(--yellow-11, #ca8a04)' },
    error: { color: 'var(--red-11, #dc2626)' },
    info: { color: 'var(--blue-11, #2563eb)' },
  },
  editable: {
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: '4px',
    transition: 'background-color 0.15s',
  },
  tooltip: {
    position: 'relative' as const,
  },
  nullValue: {
    color: 'var(--gray-9, #9ca3af)',
    fontStyle: 'italic' as const,
  },
};

/**
 * Format a value according to the field's format specification
 */
function formatValue(value: unknown, field: FieldTemplate): string {
  if (value === null || value === undefined) {
    return '\u2014'; // em-dash for null/undefined
  }

  switch (field.format) {
    case 'number': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return String(value);

      const options: Intl.NumberFormatOptions = {
        minimumFractionDigits: field.decimals ?? 0,
        maximumFractionDigits: field.decimals ?? 2,
      };
      return new Intl.NumberFormat('en-US', options).format(num);
    }

    case 'currency': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return String(value);

      const options: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: field.currency || 'USD',
        minimumFractionDigits: field.decimals ?? 0,
        maximumFractionDigits: field.decimals ?? 0,
      };
      return new Intl.NumberFormat('en-US', options).format(num);
    }

    case 'percent': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return String(value);

      // Assume value is already a percentage (e.g., 25 for 25%)
      // If it's a decimal (e.g., 0.25), multiply by 100
      const pct = num < 1 && num > -1 && num !== 0 ? num * 100 : num;
      const decimals = field.decimals ?? 1;
      return `${pct.toFixed(decimals)}%`;
    }

    case 'date': {
      if (!value) return '\u2014';

      const date = value instanceof Date ? value : new Date(String(value));
      if (isNaN(date.getTime())) return String(value);

      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date);
    }

    case 'boolean': {
      const bool = typeof value === 'boolean' ? value : value === 'true' || value === '1';
      return bool ? 'Yes' : 'No';
    }

    case 'text':
    default:
      return String(value);
  }
}

/**
 * FieldRenderer component
 * Displays a field with label, formatted value, and optional highlighting
 */
export function FieldRenderer({
  field,
  value,
  onUpdate,
  agentMode,
}: FieldRendererProps): ReactElement {
  const [isHovered, setIsHovered] = useState(false);

  const formattedValue = useMemo(
    () => formatValue(value, field),
    [value, field]
  );

  const isNull = value === null || value === undefined;
  const isEditable = field.editable && (onUpdate || agentMode);

  const handleClick = useCallback(() => {
    if (!isEditable) return;

    if (agentMode?.enabled && agentMode.sendMessage) {
      // Send message to agent for editing
      agentMode.sendMessage(
        `Please help me update the "${field.label}" field (key: ${field.key}). Current value: ${formattedValue}`
      );
    }
    // Direct edit mode would go here (Phase 2)
  }, [isEditable, agentMode, field, formattedValue]);

  const valueStyle = useMemo(() => {
    const base = { ...styles.value };

    if (isNull) {
      return { ...base, ...styles.nullValue };
    }

    if (field.highlight) {
      return { ...base, ...styles.highlight[field.highlight] };
    }

    if (isEditable) {
      return {
        ...base,
        ...styles.editable,
        backgroundColor: isHovered ? 'var(--gray-3, #f3f4f6)' : 'transparent',
      };
    }

    return base;
  }, [isNull, field.highlight, isEditable, isHovered]);

  return (
    <div
      style={styles.container}
      title={field.tooltip}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      role={isEditable ? 'button' : undefined}
      tabIndex={isEditable ? 0 : undefined}
    >
      <span style={styles.label}>{field.label}</span>
      <span style={valueStyle}>
        {formattedValue}
        {field.unit && !isNull && (
          <span style={styles.unit}>{field.unit}</span>
        )}
      </span>
    </div>
  );
}
