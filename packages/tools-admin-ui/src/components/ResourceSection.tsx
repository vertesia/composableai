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
            {showDivider && <hr className="vta-divider" />}
            <div>
                <h2 className="vta-section-title">
                    {title}
                    <span className="vta-section-count">({resources.length})</span>
                </h2>
                <p className="vta-section-subtitle">{subtitle}</p>
            </div>
            <div className="vta-card-grid">
                {resources.map(r => (
                    <ResourceCard key={`${r.type}:${r.name}`} resource={r} />
                ))}
            </div>
        </section>
    );
}
