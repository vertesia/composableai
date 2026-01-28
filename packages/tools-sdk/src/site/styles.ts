/**
 * Shared CSS styles for the tools server HTML pages
 */
export const baseStyles = /*css*/`
:root {
    color-scheme: light dark;
}

body {
    font-family: system-ui, -apple-system, sans-serif;
    margin: 0;
    padding: 2.5rem 1.75rem;
    background:
        radial-gradient(circle at 0 0, rgba(56, 189, 248, 0.10), transparent 55%),
        radial-gradient(circle at 100% 0, rgba(129, 140, 248, 0.12), transparent 55%),
        #f9fafb;
    color: #0f172a;
    line-height: 1.5;
}

.page {
    max-width: 1120px;
    margin: 0 auto;
}

.hero {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2.25rem;
    padding: 1.75rem 2rem;
    margin-bottom: 2.5rem;
    border-radius: 1.25rem;
    background: linear-gradient(135deg, #ffffff, #f3f4ff);
    border: 1px solid #e5e7eb;
    box-shadow:
        0 18px 40px rgba(15, 23, 42, 0.08),
        0 0 0 1px rgba(248, 250, 252, 0.8);
}

.hero-main {
    display: flex;
    gap: 1.5rem;
    align-items: center;
}

.hero-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 999px;
    background: radial-gradient(circle at 30% 0, #38bdf8, #6366f1);
    box-shadow:
        0 0 0 1px rgba(15, 23, 42, 0.85),
        0 12px 30px rgba(37, 99, 235, 0.6);
}

.hero-logo-initial {
    font-size: 1.1rem;
    font-weight: 650;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #eff6ff;
}

.hero-logo img {
    display: block;
    max-width: 80%;
    max-height: 60%;
}

.logo-dark {
    display: none;
}

.hero-meta {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.hero-eyebrow {
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #6b7280;
}

.hero-title {
    font-size: 1.9rem;
    font-weight: 650;
    letter-spacing: -0.03em;
    color: #0f172a;
    margin: 0;
}

.hero-tagline {
    font-size: 0.95rem;
    color: #4b5563;
    margin: 0.1rem 0 0 0;
}

.hero-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
    font-size: 0.8rem;
    color: #6b7280;
}

.hero-summary span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
}

.hero-summary dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    display: inline-block;
    background: #22c55e;
}

.search-bar {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin: 0 0 1.75rem 0;
}

.search-input {
    max-width: 360px;
    padding: 0.55rem 0.75rem;
    border-radius: 999px;
    border: 1px solid #e5e7eb;
    background: #ffffff;
    color: #111827;
    font-size: 0.9rem;
    font-family: inherit;
    box-shadow: 0 4px 10px rgba(15, 23, 42, 0.04);
}

.search-input::placeholder {
    color: #9ca3af;
}

.search-input:focus {
    outline: none;
    border-color: #60a5fa;
    box-shadow:
        0 0 0 1px rgba(59, 130, 246, 0.4),
        0 6px 18px rgba(37, 99, 235, 0.18);
}

.search-hint {
    font-size: 0.75rem;
    color: #9ca3af;
}

.search-empty {
    margin-top: 1rem;
    font-size: 0.85rem;
    color: #9ca3af;
}

.hero-panel {
    min-width: 220px;
    max-width: 260px;
    padding: 1.25rem 1.4rem;
    border-radius: 1rem;
    background: radial-gradient(circle at 0 0, rgba(59, 130, 246, 0.10), transparent 70%),
        #eff6ff;
    border: 1px solid #bfdbfe;
    box-shadow: 0 16px 34px rgba(15, 23, 42, 0.10);
    font-size: 0.8rem;
}

.hero-panel-label {
    font-size: 0.7rem;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: #1d4ed8;
    margin-bottom: 0.5rem;
}

.hero-panel-endpoint {
    display: inline-flex;
    align-items: center;
    padding: 0.3rem 0.6rem;
    border-radius: 0.5rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.82rem;
    color: #111827;
}

.hero-panel-hint {
    margin-top: 0.6rem;
    color: #6b7280;
    line-height: 1.4;
}

.hero-panel-hint strong {
    color: #111827;
}

h1, h2 {
    margin: 0 0 1rem 0;
    color: #0f172a;
}

h1 { font-size: 1.875rem; }
h2 {
    font-size: 1.4rem;
    margin-top: 2rem;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: #6b7280;
}

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
    background: radial-gradient(circle at 0 0, rgba(56, 189, 248, 0.12), transparent 75%),
        #ffffff;
    padding: 1.25rem 1.35rem;
    border-radius: 14px;
    box-shadow:
        0 14px 30px rgba(15, 23, 42, 0.06),
        0 0 0 1px rgba(248, 250, 252, 0.9);
    border: 1px solid #e5e7eb;
    transition: transform 0.15s, box-shadow 0.15s;
    text-decoration: none;
    color: inherit;
    display: block;
}

.card:hover {
    transform: translateY(-3px);
    box-shadow:
        0 18px 40px rgba(15, 23, 42, 0.10),
        0 0 0 1px rgba(59, 130, 246, 0.6);
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
    color: #0f172a;
}

.card-desc {
    font-size: 0.925rem;
    color: #6b7280;
}

.card-meta {
    margin-top: 0.45rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #9ca3af;
}

.item-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.item-card {
    background: #ffffff;
    padding: 1rem 1.25rem;
    border-radius: 10px;
    border-left: 4px solid #6366f1;
    box-shadow:
        0 10px 24px rgba(15, 23, 42, 0.06),
        0 0 0 1px rgba(248, 250, 252, 0.9);
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

.section-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.75rem;
}

.section-subtitle {
    font-size: 0.8rem;
    color: #6b7280;
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
    background: #f9fafb;
    color: #374151;
    border: 1px solid #e5e7eb;
    margin-right: 0.25rem;
}

.badge.python { background: #fef3c7; color: #92400e; border-color: #facc15; }
.badge.typescript { background: #dbeafe; color: #1e40af; border-color: #60a5fa; }
.badge.javascript { background: #fef9c3; color: #854d0e; border-color: #facc15; }

@media (max-width: 768px) {
    body {
        padding: 1.75rem 1.25rem;
    }

    .hero {
        flex-direction: column;
        padding: 1.5rem 1.35rem;
    }

    .hero-panel {
        max-width: 100%;
        width: 100%;
    }
}

@media (prefers-color-scheme: dark) {
    body {
        background:
            radial-gradient(circle at 0 0, rgba(56, 189, 248, 0.18), transparent 55%),
            radial-gradient(circle at 100% 0, rgba(129, 140, 248, 0.25), transparent 55%),
            #020617;
        color: #e5e7eb;
    }

    .hero {
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(15, 23, 42, 0.92));
        border: 1px solid rgba(148, 163, 184, 0.45);
        box-shadow:
            0 24px 60px rgba(15, 23, 42, 0.85),
            0 0 0 1px rgba(15, 23, 42, 0.75);
    }

    .hero-eyebrow {
        color: #9ca3af;
    }

    .hero-title {
        color: #f9fafb;
    }

    .hero-tagline {
        color: #cbd5f5;
    }

    .hero-summary {
        color: #9ca3af;
    }

    .hero-summary span {
        background: rgba(15, 23, 42, 0.95);
        border-color: rgba(148, 163, 184, 0.45);
    }

    .hero-panel {
        background: radial-gradient(circle at 0 0, rgba(56, 189, 248, 0.16), transparent 70%),
            rgba(15, 23, 42, 0.96);
        border: 1px solid rgba(59, 130, 246, 0.6);
        box-shadow: 0 20px 40px rgba(15, 23, 42, 0.85);
    }

    .hero-panel-label {
        color: #93c5fd;
    }

    .hero-panel-endpoint {
        background: rgba(15, 23, 42, 0.98);
        border-color: rgba(148, 163, 184, 0.6);
        color: #e5e7eb;
    }

    .hero-panel-hint {
        color: #9ca3af;
    }

    .hero-panel-hint strong {
        color: #e5e7eb;
    }

    .search-input {
        background: rgba(15, 23, 42, 0.96);
        border-color: rgba(55, 65, 81, 0.9);
        color: #e5e7eb;
        box-shadow:
            0 6px 16px rgba(15, 23, 42, 0.9),
            0 0 0 1px rgba(15, 23, 42, 0.9);
    }

    .search-input::placeholder {
        color: #6b7280;
    }

    .search-input:focus {
        border-color: #60a5fa;
        box-shadow:
            0 0 0 1px rgba(59, 130, 246, 0.7),
            0 10px 26px rgba(30, 64, 175, 0.7);
    }

    .search-hint,
    .search-empty {
        color: #9ca3af;
    }

    h1, h2 {
        color: #e5e7eb;
    }

    h2 {
        color: #9ca3af;
    }

    a {
        color: #60a5fa;
    }

    hr {
        border-top-color: rgba(148, 163, 184, 0.4);
    }

    .card {
        background: radial-gradient(circle at 0 0, rgba(56, 189, 248, 0.12), transparent 75%),
            rgba(15, 23, 42, 0.9);
        box-shadow:
            0 14px 30px rgba(15, 23, 42, 0.8),
            0 0 0 1px rgba(15, 23, 42, 0.85);
        border-color: rgba(148, 163, 184, 0.5);
    }

    .card:hover {
        box-shadow:
            0 18px 40px rgba(15, 23, 42, 0.9),
            0 0 0 1px rgba(59, 130, 246, 0.8);
    }

    .card-title {
        color: #e5e7eb;
    }

    .card-desc {
        color: #9ca3af;
    }

    .card-meta {
        color: #6b7280;
    }

    .item-card {
        background: rgba(15, 23, 42, 0.9);
        box-shadow:
            0 10px 24px rgba(15, 23, 42, 0.9),
            0 0 0 1px rgba(15, 23, 42, 0.9);
    }

    .item-desc,
    .item-meta {
        color: #9ca3af;
    }

    .item-schema {
        background: rgba(15, 23, 42, 0.95);
        color: #e5e7eb;
    }

    .endpoint-url {
        color: #9ca3af;
    }

    .endpoint-url code {
        background: rgba(15, 23, 42, 0.95);
    }

    .badge {
        background: rgba(15, 23, 42, 0.96);
        color: #e5e7eb;
        border-color: rgba(148, 163, 184, 0.6);
    }

    .badge.python {
        background: rgba(252, 211, 77, 0.12);
        color: #facc15;
        border-color: rgba(250, 204, 21, 0.5);
    }

    .badge.typescript {
        background: rgba(59, 130, 246, 0.12);
        color: #93c5fd;
        border-color: rgba(59, 130, 246, 0.7);
    }

    .badge.javascript {
        background: rgba(251, 191, 36, 0.12);
        color: #fbbf24;
        border-color: rgba(251, 191, 36, 0.55);
    }

    .logo-light {
        display: none;
    }
    .logo-dark {
        display: block;
    }

    .plugin-link-primary:hover {
        background: #2563eb !important;
    }

    .plugin-link-secondary:hover {
        background: #059669 !important;
    }
}

.plugin-link-primary:hover {
    background: #2563eb;
}

.plugin-link-secondary:hover {
    background: #059669;
}
`;
