import { StringFacet } from './StringFacet';
import { StringListFacet } from './StringListFacet';
import { TypeFacet } from './TypeFacet';

interface FacetsNavProps {
    facets: any;
    search: any;
}
export function FacetsNav({ facets, search }: FacetsNavProps) {
    return (
        <div className='flex items-center gap-x-4 w-full'>
            {facets.role && <StringFacet search={search} className="flex-1" name="role" buckets={facets.role || []} placeholder="Filter by Role" />}
            {facets.type && <TypeFacet search={search} className="flex-1" buckets={facets.type || []} />}
            {facets.status && <StringFacet search={search} className="flex-1" name="status" buckets={facets.status || []} placeholder="Filter by Status" />}
            {facets.location && <StringFacet search={search} className="flex-1" name="location" buckets={facets.location || []} placeholder="Filter by Location" />}
            {facets.tags && <StringListFacet search={search} className="flex-1" name='tags' buckets={facets.tags || []} placeholder="Filter by Tags" />}
        </div>
    )
}
