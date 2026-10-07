export interface Theme {
    /**
     * The tag name color (`<tag-name />`)
     *
     * @default var(--destructive)
     */
    tagColor?: string;
    /**
     * The text color (`<tag>Text</tag>`)
     *
     * @default var(--foreground)
     */
    textColor?: string;
    /**
     * The attribute key color (`<tag attribute-key="hello" />`)
     *
     * @default var(--info)
     */
    attributeKeyColor?: string;
    /**
     * The attribute value color (` <tag attr="Attribute value">`)
     *
     * @default var(--success)
     */
    attributeValueColor?: string;
    /**
     * The separators colors (`<, >, </, />, =, <?, ?>`)
     *
     * @default var(--foreground)
     */
    separatorColor?: string;
    /**
     * The comment color (`<!-- this is a comment -->`)
     *
     * @default var(--muted)
     */
    commentColor?: string;
    /**
     * the cdata element color (`<![CDATA[some stuff]]>`)
     *
     * @default var(--success)
     */
    cdataColor?: string;
    /**
     * The font family
     *
     * @default monospace
     */
    fontFamily?: string;
}

export interface XMLViewerProps {
    /**
     * A xml string to prettify.
     */
    xml: string;
    /**
     * An object to customize the default theme.
     *
     * @default
     * ```js
     * {
     *   tagColor: 'var(--destructive)',
     *   textColor: 'var(--foreground)',
     *   attributeKeyColor: 'var(--info)',
     *   attributeValueColor: 'var(--success)',
     *   separatorColor: 'var(--foreground)',
     *   commentColor: 'var(--muted)',
     *   cdataColor: 'var(--success)',
     *   fontFamily: 'monospace',
     * }
     * ```
     */
    theme?: Theme;
    /**
     * The size of the indentation.
     *
     * @default 2
     */
    indentSize?: number;
    /**
     * When the xml is invalid, invalidXml component will be returned.
     *
     * @default <div>Invalid XML!</div>
     */
    invalidXml?: React.ReactElement;
    /**
     * Allow collapse/expand tags by click on them. When tag is collapsed its content and attributes are hidden.
     *
     * @default false
     */
    collapsible?: boolean;
    /**
     * @deprecated use the initialCollapsedDepth instead
     */
    initalCollapsedDepth?: number;
    /**
     * When the **collapsible** is true, this set the level that will be started as collapsed.
     * For example, if you want to everything starts as collapsed, set 0.
     *
     * @default undefined
     */
    initialCollapsedDepth?: number;
}
