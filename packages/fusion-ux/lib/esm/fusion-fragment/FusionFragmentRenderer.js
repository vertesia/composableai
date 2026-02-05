import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
/**
 * FusionFragmentRenderer - Main component
 * Renders a model-generated template with actual data values
 */
import { useMemo } from 'react';
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
function ValidationErrors({ errors }) {
    return (_jsxs("div", { style: styles.error, children: [_jsxs("div", { style: styles.errorTitle, children: ["Template Validation Failed (", errors.length, " error", errors.length > 1 ? 's' : '', ")"] }), _jsx("ul", { style: styles.errorList, children: errors.map((error, index) => (_jsxs("li", { style: styles.errorItem, children: [_jsx("span", { children: error.message }), _jsxs("span", { style: styles.errorPath, children: ["at ", error.path] }), error.suggestion && (_jsxs("span", { style: styles.errorSuggestion, children: ["\\u2192 ", error.suggestion] }))] }, index))) })] }));
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
export function FusionFragmentRenderer({ template, data, onUpdate, agentMode, className, }) {
    // Validate template against data keys
    const validation = useMemo(() => {
        const dataKeys = Object.keys(data);
        return validateTemplate(template, dataKeys);
    }, [template, data]);
    // Show validation errors if any
    if (!validation.valid) {
        return _jsx(ValidationErrors, { errors: validation.errors });
    }
    return (_jsxs("div", { style: styles.container, className: className, children: [template.title && (_jsx("div", { style: styles.title, children: template.title })), template.sections.map((section, index) => (_jsx(SectionRenderer, { section: section, data: data, onUpdate: onUpdate, agentMode: agentMode }, section.title || index))), template.footer && (_jsx("div", { style: styles.footer, children: template.footer }))] }));
}
//# sourceMappingURL=FusionFragmentRenderer.js.map