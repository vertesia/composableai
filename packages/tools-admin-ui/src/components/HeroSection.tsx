import type { ResourceItem, ResourceType } from '../types.js';
import { EndpointPanel } from './EndpointPanel.js';
import { SummaryBadge } from './SummaryBadge.js';

interface HeroSectionProps {
    title: string;
    version: string;
    resources: ResourceItem[];
}

function getInitials(title: string): string {
    return title.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function countByType(resources: ResourceItem[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const r of resources) {
        counts[r.type] = (counts[r.type] || 0) + 1;
    }
    return counts;
}

const badgeLabels: { type: ResourceType; label: string }[] = [
    { type: 'tool', label: 'tool' },
    { type: 'skill', label: 'skill' },
    { type: 'interaction', label: 'interaction' },
    { type: 'type', label: 'content type' },
    { type: 'template', label: 'template' },
    { type: 'mcp', label: 'MCP provider' },
];

export function HeroSection({ title, version, resources }: HeroSectionProps) {
    const counts = countByType(resources);

    return (
        <header className="vta-hero">
            <div className="vta-hero-main">
                <div className="vta-hero-identity">
                    <div className="vta-hero-logo">
                        {getInitials(title)}
                    </div>
                    <div>
                        <p className="vta-hero-eyebrow">Tools Server</p>
                        <h1 className="vta-hero-title">{title}</h1>
                    </div>
                </div>

                <p className="vta-hero-tagline">
                    Discover the tools, skills, interactions, and content types exposed by this server.
                </p>

                <div className="vta-hero-summary">
                    {badgeLabels.map(({ type, label }) => (
                        <SummaryBadge key={type} count={counts[type] || 0} label={label} />
                    ))}
                </div>

                <div className="vta-hero-links">
                    <a href="/ui/" target="_blank" className="vta-link-primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <line x1="9" y1="3" x2="9" y2="21" />
                        </svg>
                        UI Plugin Dev
                    </a>
                    <a href="/lib/plugin.js" className="vta-link-secondary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Plugin Bundle
                    </a>
                </div>
            </div>

            <aside className="vta-hero-panel">
                <EndpointPanel label="Base endpoint" path="/api" />
                <EndpointPanel label="Package endpoint" path="/api/package" />
                <p className="vta-hero-hint">
                    Use <strong>POST /api/tools/&lt;collection&gt;</strong> or{' '}
                    <strong>POST /api/skills/&lt;collection&gt;</strong> to call these from your apps or agents.
                </p>
                <p className="vta-hero-version">v{version}</p>
            </aside>
        </header>
    );
}
