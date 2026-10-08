// Shared with rendered regression checks so they exercise the styles the chat actually injects.
export const agentMarkdownStyles = `
/* Better vertical rhythm for markdown */
.vprose > * + *:not(:where(.not-prose, .not-prose *)) {
    margin-top: 0.625rem;
}
.vprose > h1 + *:not(:where(.not-prose, .not-prose *)),
.vprose > h2 + *:not(:where(.not-prose, .not-prose *)),
.vprose > h3 + *:not(:where(.not-prose, .not-prose *)) {
    margin-top: 0.375rem;
}
/* Tables should read like part of the conversation, not a separate app grid. */
.vprose table:not(:where(.not-prose, .not-prose *)) {
    margin-top: 0.875rem;
    margin-bottom: 0.875rem;
    border-collapse: collapse;
    width: 100%;
    background: transparent;
}
.vprose th:not(:where(.not-prose, .not-prose *)),
.vprose td:not(:where(.not-prose, .not-prose *)) {
    padding: 0.5rem 0.625rem;
    border: 0;
    border-bottom: 1px solid color-mix(in oklch, var(--border) 70%, transparent);
    background: transparent;
    text-align: left;
}
.vprose thead th:not(:where(.not-prose, .not-prose *)) {
    background: transparent;
    font-weight: 600;
    color: var(--muted);
    font-size: 0.75rem;
    text-transform: none;
    letter-spacing: 0;
}
.vprose tbody tr:hover:not(:where(.not-prose, .not-prose *)) {
    background: transparent;
}
/* Dark mode table styles */
.dark .vprose th:not(:where(.not-prose, .not-prose *)),
.dark .vprose td:not(:where(.not-prose, .not-prose *)) {
    border-color: color-mix(in oklch, var(--border) 70%, transparent);
}
.dark .vprose thead th:not(:where(.not-prose, .not-prose *)) {
    background: transparent;
    color: var(--muted);
}
.dark .vprose tbody tr:hover:not(:where(.not-prose, .not-prose *)) {
    background: transparent;
}
/* Horizontal rules as section dividers */
.vprose hr:not(:where(.not-prose, .not-prose *)) {
    margin-top: 1rem;
    margin-bottom: 1rem;
    border-color: var(--border);
}
/* Better blockquote styling */
.vprose blockquote:not(:where(.not-prose, .not-prose *)) {
    margin-top: 0.875rem;
    margin-bottom: 0.875rem;
    padding-left: 1rem;
    border-left-width: 3px;
    border-left-color: var(--border);
    color: var(--muted);
}
/* Code blocks */
.vprose pre:not(:where(.not-prose, .not-prose *)) {
    margin-top: 0.75rem;
    margin-bottom: 0.75rem;
    padding: 0.75rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    background-color: var(--muted-background);
    color: var(--foreground);
}
.vprose pre code:not(:where(.not-prose, .not-prose *)) {
    color: inherit;
}
.dark .vprose pre:not(:where(.not-prose, .not-prose *)) {
    color: var(--foreground);
}

/* Summary chat markdown: keep structure, but match the app's quieter conversation surface. */
.agent-markdown:not(:where(.not-prose, .not-prose *)) {
    color: color-mix(in oklch, var(--foreground) 78%, transparent);
    font-size: 0.875rem;
    line-height: 1.625;
    overflow-x: auto;
}
.agent-markdown > * + *:not(:where(.not-prose, .not-prose *)) {
    margin-top: 0.65rem;
}
.agent-markdown p:not(:where(.not-prose, .not-prose *)) {
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
}
.agent-markdown h1:not(:where(.not-prose, .not-prose *)),
.agent-markdown h2:not(:where(.not-prose, .not-prose *)),
.agent-markdown h3:not(:where(.not-prose, .not-prose *)),
.agent-markdown h4:not(:where(.not-prose, .not-prose *)) {
    margin-top: 1.2rem;
    margin-bottom: 0.45rem;
    color: var(--foreground);
    font-weight: 650;
    letter-spacing: 0;
    line-height: 1.3;
}
.agent-markdown h1:not(:where(.not-prose, .not-prose *)) {
    font-size: 1.2rem;
}
.agent-markdown h2:not(:where(.not-prose, .not-prose *)) {
    font-size: 1.05rem;
}
.agent-markdown h3:not(:where(.not-prose, .not-prose *)),
.agent-markdown h4:not(:where(.not-prose, .not-prose *)) {
    font-size: 0.95rem;
}
.agent-markdown h1:first-child:not(:where(.not-prose, .not-prose *)),
.agent-markdown h2:first-child:not(:where(.not-prose, .not-prose *)),
.agent-markdown h3:first-child:not(:where(.not-prose, .not-prose *)),
.agent-markdown h4:first-child:not(:where(.not-prose, .not-prose *)) {
    margin-top: 0;
}
.agent-markdown hr:not(:where(.not-prose, .not-prose *)) {
    margin: 1.15rem 0;
    border: 0;
    border-top: 1px solid var(--border);
    opacity: 0.65;
}
.agent-markdown ul:not(:where(.not-prose, .not-prose *)),
.agent-markdown ol:not(:where(.not-prose, .not-prose *)) {
    margin-top: 0.55rem;
    margin-bottom: 0.55rem;
    padding-left: 1.25rem;
}
.agent-markdown li:not(:where(.not-prose, .not-prose *)) {
    margin-top: 0.2rem;
    margin-bottom: 0.2rem;
    padding-left: 0.1rem;
    color: inherit;
}
.agent-markdown li:not(:where(.not-prose, .not-prose *))::marker {
    color: var(--muted);
}
.agent-markdown strong:not(:where(.not-prose, .not-prose *)) {
    color: var(--foreground);
    font-weight: 600;
}
.agent-markdown em:not(:where(.not-prose, .not-prose *)) {
    color: color-mix(in oklch, var(--foreground) 72%, transparent);
}
.agent-markdown a:not(:where(.not-prose, .not-prose *)) {
    color: var(--foreground);
    text-decoration-color: var(--muted);
    text-underline-offset: 3px;
}
.agent-markdown blockquote:not(:where(.not-prose, .not-prose *)) {
    margin-top: 0.85rem;
    margin-bottom: 0.85rem;
    padding-left: 0.875rem;
    border-left: 2px solid var(--border);
    color: var(--muted);
    font-style: normal;
}
.agent-markdown :not(pre) > code:not(:where(.not-prose, .not-prose *)) {
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    background: var(--muted);
    color: var(--foreground);
    padding: 0.1rem 0.35rem;
    font-size: 0.8125em;
    font-weight: 500;
}
.agent-markdown pre:not(:where(.not-prose, .not-prose *)) {
    margin-top: 0.85rem;
    margin-bottom: 0.85rem;
    max-height: 32rem;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--muted);
    color: var(--foreground);
    padding: 0.875rem;
    font-size: 0.8125rem;
    line-height: 1.55;
}
.agent-markdown pre code:not(:where(.not-prose, .not-prose *)) {
    border: 0;
    background: transparent;
    color: inherit;
    padding: 0;
    font-size: inherit;
}
.agent-markdown table:not(:where(.not-prose, .not-prose *)) {
    display: table;
    width: 100%;
    max-width: 100%;
    margin: 0.9rem 0 1rem;
    border: 0;
    border-collapse: collapse;
    border-spacing: 0;
    font-size: 0.8125rem;
    table-layout: fixed;
    background: transparent;
}
.agent-markdown thead:not(:where(.not-prose, .not-prose *)) {
    background: transparent;
}
.agent-markdown th:not(:where(.not-prose, .not-prose *)),
.agent-markdown td:not(:where(.not-prose, .not-prose *)) {
    border: 0;
    border-bottom: 1px solid color-mix(in oklch, var(--border) 70%, transparent);
    background: transparent;
    padding: 0.55rem 0.75rem;
    text-align: left;
    vertical-align: top;
    overflow-wrap: anywhere;
    word-break: normal;
    white-space: normal;
}
.agent-markdown th:not(:where(.not-prose, .not-prose *)) {
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0;
    text-transform: none;
    white-space: nowrap;
}
.agent-markdown td:not(:where(.not-prose, .not-prose *)) {
    color: inherit;
}
.agent-markdown th + th:not(:where(.not-prose, .not-prose *)),
.agent-markdown td + td:not(:where(.not-prose, .not-prose *)) {
    padding-inline-start: 1.75rem;
}
.agent-markdown th:first-child:not(:where(.not-prose, .not-prose *)),
.agent-markdown td:first-child:not(:where(.not-prose, .not-prose *)) {
    min-width: 0;
    width: auto;
    white-space: normal;
}
.agent-markdown col:not(:where(.not-prose, .not-prose *)) {
    width: var(--agent-markdown-table-column-width);
}
.agent-markdown tr:last-child td:not(:where(.not-prose, .not-prose *)) {
    border-bottom: 0;
}
.agent-markdown tbody tr:nth-child(even):not(:where(.not-prose, .not-prose *)) {
    background: transparent;
}
.agent-markdown tbody tr:hover:not(:where(.not-prose, .not-prose *)) {
    background: transparent;
}
`;
