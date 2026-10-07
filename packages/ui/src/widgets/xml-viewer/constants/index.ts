export const ATTRIBUTE_GROUP_KEY = ':@';
export const ATTRIBUTE_TEXT = '#text';
export const ATTRIBUTE_COMMENT = '#comment';
export const ATTRIBUTE_CDATA = '#cdata';
export const DECLARATION_TAG = 'DECLARATION_TAG';
export const TAG = 'TAG';

export const defaultTheme = {
    tagColor: 'var(--destructive)',
    textColor: 'var(--foreground)',
    attributeKeyColor: 'var(--info)',
    attributeValueColor: 'var(--success)',
    separatorColor: 'var(--foreground)',
    commentColor: 'var(--muted)',
    cdataColor: 'var(--success)',
    fontFamily: 'monospace',
};

export const darkTheme = {
    ...defaultTheme,
    fontFamily: 'monospace',
};
