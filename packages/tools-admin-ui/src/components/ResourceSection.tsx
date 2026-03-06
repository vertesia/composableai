import { Separator } from '@vertesia/ui/core';

import type { ResourceItem } from '../types.js';
import { ResourceCard } from './ResourceCard.js';

interface ResourceSectionProps {
    title: string;
    subtitle: string;
    resources: ResourceItem[];
    showDivider?: boolean;
}

export function ResourceSection({ title, subtitle, resources, showDivider }: ResourceSectionProps) {
    if (resources.length === 0) return null;

    return (
        <section>
            {showDivider && <Separator className="my-8" />}
            <div>
                <h2 className="text-xl font-semibold text-foreground">
                    {title}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">({resources.length})</span>
                </h2>
                <p className="mb-4 text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {resources.map(r => (
                    <ResourceCard key={`${r.type}:${r.name}`} resource={r} />
                ))}
            </div>
        </section>
    );
}
