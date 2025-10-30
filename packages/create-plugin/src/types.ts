/**
 * Template types available for plugin creation
 */
export enum TemplateType {
    WEB = 'web',
    TOOL = 'tool'
}

/**
 * Get display name for template type
 */
export function getTemplateDisplayName(type: TemplateType): string {
    switch (type) {
        case TemplateType.WEB:
            return 'Web Application Plugin';
        case TemplateType.TOOL:
            return 'Agent Tool Server';
    }
}
