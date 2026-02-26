import type { ReactNode } from 'react';
import type { ResourceType } from '../types.js';
import { NavLink } from '@vertesia/ui/router';

interface DetailPageProps {
    type: ResourceType;
    title: string;
    description?: string;
    tags?: string[];
    backHref?: string;
    children?: ReactNode;
}

export function DetailPage({ type, title, description, tags, backHref = '/', children }: DetailPageProps) {
    return (
        <div className="vta-root">
            <NavLink href={backHref} className="vta-detail-back">&larr; Back</NavLink>

            <div className="vta-detail-header">
                <span className={`vta-card-type vta-card-type--${type}`}>{type}</span>
                <h1 className="vta-detail-title">{title}</h1>
                {description && <p className="vta-detail-desc">{description}</p>}
                {tags && tags.length > 0 && (
                    <div className="vta-card-tags">
                        {tags.map(tag => (
                            <span key={tag} className="vta-tag">{tag}</span>
                        ))}
                    </div>
                )}
            </div>

            {children}
        </div>
    );
}
