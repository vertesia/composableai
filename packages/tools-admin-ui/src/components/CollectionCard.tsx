import { NavLink } from '@vertesia/ui/router';
import type { CollectionInfo } from '../types.js';

export function CollectionCard({ collection }: { collection: CollectionInfo }) {
    const href = `/${collection.type}s/${collection.name}`;

    return (
        <NavLink href={href} className="vta-card-link">
            <div className="vta-card vta-card--link">
                <span className={`vta-card-type vta-card-type--${collection.type}`}>
                    {collection.type}
                </span>
                <div className="vta-card-title">{collection.title}</div>
                <div className="vta-card-desc">
                    {collection.description || 'No description'}
                </div>
                <div className="vta-card-url">
                    {collection.count} {collection.count === 1 ? 'item' : 'items'}
                </div>
            </div>
        </NavLink>
    );
}
