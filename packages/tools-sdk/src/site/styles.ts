/**
 * Shared CSS styles for the tools server HTML pages
 */
export const baseStyles = /*css*/`
body {
    font-family: system-ui, -apple-system, sans-serif;
    margin: 0;
    padding: 2rem;
    background: #f9fafb;
    color: #1f2937;
    line-height: 1.5;
}

h1, h2 {
    margin: 0 0 1rem 0;
    color: #111827;
}

h1 { font-size: 1.875rem; }
h2 { font-size: 1.5rem; margin-top: 2rem; }

a {
    color: #2563eb;
    text-decoration: none;
}
a:hover {
    text-decoration: underline;
}

hr {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 2rem 0;
}

.card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
}

.card {
    background: white;
    padding: 1.25rem;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: transform 0.15s, box-shadow 0.15s;
    text-decoration: none;
    color: inherit;
    display: block;
}

.card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 0.75rem;
}

.card-icon svg {
    width: 100%;
    height: 100%;
}

.card-title {
    font-weight: 600;
    font-size: 1.1rem;
    margin-bottom: 0.25rem;
}

.card-desc {
    font-size: 0.925rem;
    color: #6b7280;
}

.item-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.item-card {
    background: white;
    padding: 1rem 1.25rem;
    border-radius: 8px;
    border-left: 4px solid #6366f1;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.item-card.skill {
    border-left-color: #10b981;
}

.item-card.interaction {
    border-left-color: #f59e0b;
}

.item-name {
    font-weight: 600;
    font-size: 1.05rem;
}

.item-desc {
    font-size: 0.9rem;
    color: #6b7280;
    margin-top: 0.25rem;
}

.item-meta {
    font-size: 0.8rem;
    color: #9ca3af;
    margin-top: 0.5rem;
}

.item-schema {
    margin-top: 0.75rem;
    font-size: 0.8rem;
    font-family: ui-monospace, monospace;
    background: #f3f4f6;
    padding: 0.75rem;
    border-radius: 6px;
    overflow-x: auto;
    white-space: pre-wrap;
    color: #374151;
}

.header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
}

.header-icon {
    width: 64px;
    height: 64px;
}

.header-icon svg {
    width: 100%;
    height: 100%;
}

.endpoint-url {
    font-size: 0.85rem;
    color: #6b7280;
    margin-top: 0.25rem;
}

.endpoint-url code {
    background: #f3f4f6;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-family: ui-monospace, monospace;
}

.badge {
    display: inline-block;
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    background: #e5e7eb;
    color: #374151;
    margin-right: 0.25rem;
}

.badge.python { background: #fef3c7; color: #92400e; }
.badge.typescript { background: #dbeafe; color: #1e40af; }
.badge.javascript { background: #fef9c3; color: #854d0e; }
`;
