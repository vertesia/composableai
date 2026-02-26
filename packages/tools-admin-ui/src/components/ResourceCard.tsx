import type { ResourceItem } from '../types.js';

export function ResourceCard({ resource }: { resource: ResourceItem }) {
    return (
        <div className="vta-card">
            <span className={`vta-card-type vta-card-type--${resource.type}`}>
                {resource.type}
            </span>
            <div className="vta-card-title">{resource.title}</div>
            <div className="vta-card-desc">
                {resource.description || 'No description'}
            </div>
            {resource.tags && resource.tags.length > 0 && (
                <div className="vta-card-tags">
                    {resource.tags.map(tag => (
                        <span key={tag} className="vta-tag">{tag}</span>
                    ))}
                </div>
            )}
            {resource.url && (
                <div className="vta-card-url">{resource.url}</div>
            )}
        </div>
    );
}
