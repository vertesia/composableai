import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * SectionRenderer component
 * Renders a section with grid layout and collapsible behavior
 */
import { useState, useMemo } from 'react';
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
        flexDirection: 'column',
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
        userSelect: 'none',
    },
    title: {
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--gray-11, #6b7280)',
        textTransform: 'uppercase',
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
function ChevronIcon({ collapsed }) {
    return (_jsx("svg", { style: {
            ...styles.chevron,
            ...(collapsed ? styles.chevronCollapsed : {}),
        }, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("polyline", { points: "6 9 12 15 18 9" }) }));
}
/**
 * SectionRenderer component
 * Displays a section with title, optional collapse, and grid of fields
 */
export function SectionRenderer({ section, data, onUpdate, agentMode, }) {
    const [isCollapsed, setIsCollapsed] = useState(section.collapsed ?? false);
    const layout = section.layout || 'grid-3';
    const isTable = layout === 'table';
    const isChart = layout === 'chart';
    const layoutStyle = isTable || isChart ? {} : gridLayouts[layout];
    const isCollapsible = section.collapsed !== undefined;
    // Get table rows from data
    const tableRows = useMemo(() => {
        if (!isTable || !section.dataKey)
            return [];
        const rows = data[section.dataKey];
        return Array.isArray(rows) ? rows : [];
    }, [isTable, section.dataKey, data]);
    const headerStyle = useMemo(() => ({
        ...styles.header,
        ...(isCollapsible ? styles.headerCollapsible : {}),
    }), [isCollapsible]);
    const contentStyle = useMemo(() => ({
        ...styles.content,
        ...layoutStyle,
        ...(isCollapsed ? styles.contentCollapsed : styles.contentExpanded),
    }), [isCollapsed, layoutStyle]);
    const handleHeaderClick = () => {
        if (isCollapsible) {
            setIsCollapsed(!isCollapsed);
        }
    };
    // Render content based on layout type
    const renderContent = () => {
        if (isTable && section.columns) {
            return _jsx(TableRenderer, { columns: section.columns, rows: tableRows });
        }
        if (isChart && section.chart) {
            return _jsx(ChartRenderer, { chart: section.chart, data: data });
        }
        // Default: render fields
        return section.fields?.map((field, index) => (_jsx(FieldRenderer, { field: field, value: data[field.key], onUpdate: onUpdate ? (value) => onUpdate(field.key, value) : undefined, agentMode: agentMode }, field.key || index)));
    };
    return (_jsxs("div", { style: styles.section, children: [_jsxs("div", { style: headerStyle, onClick: handleHeaderClick, role: isCollapsible ? 'button' : undefined, "aria-expanded": isCollapsible ? !isCollapsed : undefined, children: [isCollapsible && _jsx(ChevronIcon, { collapsed: isCollapsed }), _jsx("span", { style: styles.title, children: section.title })] }), _jsx("div", { style: contentStyle, children: renderContent() })] }));
}
//# sourceMappingURL=SectionRenderer.js.map