/** Shared by server-rendered boot markup and React auth loaders. No React dependency. */
export const LOADING_ICON_SIZE = 40;
export const LOADING_INDICATOR_STYLES = `
@keyframes vertesia-loading-spin {
    0%, 100% { opacity: .5; transform: scale(.92); }
    50% { opacity: 1; transform: scale(1); }
}
.vertesia-loading-motion {
    animation: var(--vertesia-loading-animation, vertesia-loading-spin 2s linear infinite);
}
.vertesia-loading-icon {
    width: ${LOADING_ICON_SIZE}px !important;
    min-width: ${LOADING_ICON_SIZE}px !important;
    max-width: ${LOADING_ICON_SIZE}px !important;
    height: ${LOADING_ICON_SIZE}px !important;
    min-height: ${LOADING_ICON_SIZE}px !important;
    max-height: ${LOADING_ICON_SIZE}px !important;
    margin: 0;
    padding: 0;
    object-fit: contain;
    flex: none;
    border-radius: 0 !important;
}
@media (prefers-reduced-motion: reduce) {
    .vertesia-loading-motion { animation: none !important; }
}
`;
