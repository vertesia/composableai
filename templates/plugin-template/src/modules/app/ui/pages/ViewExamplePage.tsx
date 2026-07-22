import { ViewExperience } from '@vertesia/ui/features';

// The example in-code View (src/modules/app/resources/views/document-library.ts) is
// contributed to Studio as `app:<app-name>:document-library`. Replace `example` with
// your plugin's registered app name (the app-package manifest `name`).
const DOCUMENT_LIBRARY_VIEW_ID = 'app:example:document-library';

/**
 * Example of embedding a reusable View Experience.
 *
 * Inside the Vertesia session (provided by VertesiaShell) `<ViewExperience>`
 * self-fetches and executes the View, so it needs only a `viewId`. Add
 * `onOpenHit` to route result clicks to a detail page, or `renderers` to
 * override the search / results / navigation surfaces.
 */
export function ViewExamplePage() {
    return (
        <div className="h-full">
            <ViewExperience viewId={DOCUMENT_LIBRARY_VIEW_ID} />
        </div>
    );
}
