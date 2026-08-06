import { ViewExperience } from '@vertesia/ui/features';

const DOCUMENT_LIBRARY_VIEW_ID = `app:${import.meta.env.VITE_APP_NAME}:document-library`;

/**
 * Example of embedding a reusable View Experience.
 *
 * Inside the Vertesia session (provided by VertesiaShell) `<ViewExperience>`
 * self-fetches and executes the View, so it needs only a `viewId`. Add
 * `onOpenHit` to route result clicks to a detail page, or `renderers` to
 * override the search, results, or navigation surfaces.
 */
export function ViewExamplePage() {
    return (
        <div className="h-full">
            <ViewExperience viewId={DOCUMENT_LIBRARY_VIEW_ID} />
        </div>
    );
}
