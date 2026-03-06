import { Card } from '@vertesia/ui/core';
import { Download, LayoutDashboard } from 'lucide-react';

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
        <Card className="mb-10 overflow-hidden border bg-linear-to-br from-card to-muted-background">
            <div className="flex flex-col gap-6 p-6 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-1 flex-col gap-3">
                    <div className="flex items-center gap-4">
                        <div className="flex size-14 items-center justify-center rounded-xl bg-linear-to-br from-sky-400 to-indigo-500 text-sm font-semibold uppercase tracking-wider text-white shadow-lg">
                            {getInitials(title)}
                        </div>
                        <div>
                            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Tools Server</p>
                            <h1 className="-tracking-wide text-2xl font-bold text-foreground">{title}</h1>
                        </div>
                    </div>

                    <p className="text-sm text-muted-foreground">
                        Discover the tools, skills, interactions, and content types exposed by this server.
                    </p>

                    <div className="flex flex-wrap gap-2">
                        {badgeLabels.map(({ type, label }) => (
                            <SummaryBadge key={type} count={counts[type] || 0} label={label} />
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-3 pt-1">
                        <a
                            href="/app/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center gap-2 rounded bg-primary px-3 text-xs font-medium text-white shadow-xs hover:bg-primary/90"
                        >
                            <LayoutDashboard className="size-4" />
                            UI Plugin Dev
                        </a>
                        <a
                            href="/lib/plugin.js"
                            className="inline-flex h-8 items-center gap-2 rounded bg-primary/5 px-3 text-xs font-medium text-primary shadow-xs hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/20"
                        >
                            <Download className="size-4" />
                            Plugin Bundle
                        </a>
                    </div>
                </div>

                <aside className="min-w-55 max-w-65 shrink-0">
                    <EndpointPanel label="Base endpoint" path="/api" />
                    <EndpointPanel label="Package endpoint" path="/api/package" />
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        Use <strong className="text-foreground">POST /api/tools/&lt;collection&gt;</strong> or{' '}
                        <strong className="text-foreground">POST /api/skills/&lt;collection&gt;</strong> to call these from your apps or agents.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">v{version}</p>
                </aside>
            </div>
        </Card>
    );
}
