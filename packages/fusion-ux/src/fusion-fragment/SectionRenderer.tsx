/**
 * SectionRenderer component
 * Renders a section with grid layout and collapsible behavior
 */

import React, { useState, useMemo, type ReactElement } from 'react';
import type { SectionRendererProps } from '../types.js';
import { FieldRenderer } from './FieldRenderer.js';
import { TableRenderer } from './TableRenderer.js';
import { ChartRenderer } from './ChartRenderer.js';

// Layout grid configurations
const gridLayouts = {
  'grid-2': {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  'grid-3': {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
  },
  'grid-4': {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
};

const styles = {
  section: {
    marginBottom: '20px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
    cursor: 'default',
  },
  headerCollapsible: {
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  title: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--gray-11, #6b7280)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  chevron: {
    width: '14px',
    height: '14px',
    color: 'var(--gray-10, #9ca3af)',
    transition: 'transform 0.2s',
  },
  chevronCollapsed: {
    transform: 'rotate(-90deg)',
  },
  content: {
    overflow: 'hidden',
    transition: 'max-height 0.2s ease-out',
  },
  contentCollapsed: {
    maxHeight: '0',
    opacity: 0,
  },
  contentExpanded: {
    maxHeight: '2000px', // Large enough for most content
    opacity: 1,
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--gray-5, #e5e7eb)',
    marginTop: '16px',
  },
};

// Simple chevron SVG component
function ChevronIcon({ collapsed }: { collapsed: boolean }): ReactElement {
  return (
    <svg
      style={{
        ...styles.chevron,
        ...(collapsed ? styles.chevronCollapsed : {}),
      }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/**
 * SectionRenderer component
 * Displays a section with title, optional collapse, and grid of fields
 */
export function SectionRenderer({
  section,
  data,
  onUpdate,
  agentMode,
}: SectionRendererProps): ReactElement {
  const [isCollapsed, setIsCollapsed] = useState(section.collapsed ?? false);

  const layout = section.layout || 'grid-3';
  const isTable = layout === 'table';
  const isChart = layout === 'chart';
  const layoutStyle = isTable || isChart ? {} : gridLayouts[layout as keyof typeof gridLayouts];

  const isCollapsible = section.collapsed !== undefined;

  // Get table rows from data
  const tableRows = useMemo(() => {
    if (!isTable || !section.dataKey) return [];
    const rows = data[section.dataKey];
    return Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
  }, [isTable, section.dataKey, data]);

  const headerStyle = useMemo(
    () => ({
      ...styles.header,
      ...(isCollapsible ? styles.headerCollapsible : {}),
    }),
    [isCollapsible]
  );

  const contentStyle = useMemo(
    () => ({
      ...styles.content,
      ...layoutStyle,
      ...(isCollapsed ? styles.contentCollapsed : styles.contentExpanded),
    }),
    [isCollapsed, layoutStyle]
  );

  const handleHeaderClick = () => {
    if (isCollapsible) {
      setIsCollapsed(!isCollapsed);
    }
  };

  // Render content based on layout type
  const renderContent = () => {
    if (isTable && section.columns) {
      return <TableRenderer columns={section.columns} rows={tableRows} />;
    }

    if (isChart && section.chart) {
      return <ChartRenderer chart={section.chart} data={data} />;
    }

    // Default: render fields
    return section.fields?.map((field, index) => (
      <FieldRenderer
        key={field.key || index}
        field={field}
        value={data[field.key]}
        onUpdate={
          onUpdate ? (value) => onUpdate(field.key, value) : undefined
        }
        agentMode={agentMode}
      />
    ));
  };

  return (
    <div style={styles.section}>
      <div
        style={headerStyle}
        onClick={handleHeaderClick}
        role={isCollapsible ? 'button' : undefined}
        aria-expanded={isCollapsible ? !isCollapsed : undefined}
      >
        {isCollapsible && <ChevronIcon collapsed={isCollapsed} />}
        <span style={styles.title}>{section.title}</span>
      </div>

      <div style={contentStyle}>
        {renderContent()}
      </div>
    </div>
  );
}
