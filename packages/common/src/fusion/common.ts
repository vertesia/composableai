/**
 * Common Fusion Types
 *
 * Shared types used across fusion applications, pages, and navigation.
 */

// ============================================================================
// Icon Types
// ============================================================================

/**
 * Icon specification supporting multiple icon sources.
 */
export interface IconSpec {
    /** Icon library/type */
    type: 'lucide' | 'heroicons' | 'emoji' | 'url' | 'custom';
    /** Icon name or value */
    value: string;
    /** Icon color (CSS color value) */
    color?: string;
    /** Icon size */
    size?: 'sm' | 'md' | 'lg' | number;
}

// ============================================================================
// Theme Types
// ============================================================================

/**
 * Logo specification with light/dark variants.
 */
export interface LogoSpec {
    /** Logo URL for light theme */
    light?: string;
    /** Logo URL for dark theme */
    dark?: string;
    /** Alt text for accessibility */
    alt?: string;
    /** Logo dimensions */
    width?: number;
    height?: number;
}

/**
 * Application theme specification.
 */
export interface ThemeSpec {
    /** Primary brand color */
    primaryColor?: string;
    /** Accent color for highlights */
    accentColor?: string;
    /** Background color */
    backgroundColor?: string;
    /** Text color */
    textColor?: string;
    /** Border radius style */
    borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
    /** Application logo */
    logo?: LogoSpec;
    /** Custom CSS to inject */
    customCss?: string;
    /** Font family */
    fontFamily?: string;
}

// ============================================================================
// Conditional Types
// ============================================================================

/**
 * Condition for showing/hiding elements based on data or user context.
 */
export interface ConditionalSpec {
    /** Condition type */
    type: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan' | 'isEmpty' | 'isNotEmpty' | 'hasPermission' | 'custom';
    /** Data key or context property to check */
    field?: string;
    /** Value to compare against */
    value?: unknown;
    /** Custom expression (for type: 'custom') */
    expression?: string;
}

// ============================================================================
// Badge Types
// ============================================================================

/**
 * Badge specification for displaying counts or status indicators.
 */
export interface BadgeSpec {
    /** Data key for badge value */
    dataKey?: string;
    /** Static value (if not data-driven) */
    value?: string | number;
    /** Badge variant */
    variant?: 'default' | 'success' | 'attention' | 'destructive' | 'info' | 'muted';
    /** Maximum value before showing "N+" */
    max?: number;
    /** Whether to show when value is 0 */
    showZero?: boolean;
}

// ============================================================================
// Link Types
// ============================================================================

/**
 * Link specification for navigation and actions.
 */
export interface LinkSpec {
    /** Link type */
    type: 'internal' | 'external' | 'download';
    /** URL or path */
    href: string;
    /** Target for external links */
    target?: '_blank' | '_self';
    /** Download filename (for download type) */
    download?: string;
}
