/**
 * Data Binding Module
 *
 * Resolves data bindings for fusion pages by fetching data from
 * various sources (content objects, data stores, APIs, etc.).
 *
 * @example
 * ```tsx
 * import {
 *   createDataBindingResolver,
 *   DataBindingResolverContext,
 *   usePageData,
 * } from '@vertesia/fusion-ux';
 *
 * // Create resolver with Vertesia client
 * const resolver = createDataBindingResolver({
 *   fetchers: {
 *     fetchContentObject: (id) => client.objects.retrieve(id),
 *     queryObjects: (query) => client.objects.find(query),
 *     queryDataStore: (storeId, sql) => client.data.query(storeId, { sql }),
 *     fetchArtifact: (path) => client.files.download(path),
 *     fetchApi: (endpoint, opts) => fetch(endpoint, opts).then(r => r.json()),
 *   }
 * });
 *
 * // Provide resolver to app
 * function App() {
 *   return (
 *     <DataBindingResolverContext.Provider value={resolver}>
 *       <FusionPage page={page} />
 *     </DataBindingResolverContext.Provider>
 *   );
 * }
 *
 * // Use in page component
 * function FusionPage({ page }) {
 *   const { route } = useParams();
 *   const { data, loading, error } = usePageData(page.dataBindings, { route });
 *
 *   if (loading) return <Loading />;
 *   if (error) return <Error message={error} />;
 *
 *   return <PageRenderer page={page} data={data} />;
 * }
 * ```
 *
 * @packageDocumentation
 */

// Types
export type {
    ResolvedBinding,
    ResolutionContext,
    PageDataResult,
    ResolveOptions,
    DataFetchers,
    DataCache,
    ResolverConfig,
    DataBindingResolver,
} from './types.js';

// Resolver
export { createDataBindingResolver, builtInTransforms } from './resolver.js';

// Interpolation utilities
export {
    interpolateString,
    interpolateObject,
    getNestedValue,
    hasInterpolation,
    extractInterpolationKeys,
    validateInterpolationKeys,
} from './interpolate.js';

// React hooks
export {
    DataBindingResolverContext,
    useDataBindingResolver,
    usePageData,
    useBinding,
    usePollingData,
    type PageDataState,
    type UsePageDataOptions,
} from './hooks.js';
