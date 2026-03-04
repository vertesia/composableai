
let _usePluginAssets = true;

export function setUsePluginAssets(usePluginAssets: boolean) {
    _usePluginAssets = usePluginAssets
}

/**
 * Correctly resolve the URL to an asset so that it works in dev mode but also in prod as a standalone app or plugin.
 * Assets must be put inside /public/assets folder so the given `path` will be resolved as /assets/path in the right context
 * @param path 
 */
export function useAsset(path: string) {
    if (path.startsWith('/')) {
        path = path.substring(1);
    } else if (path.startsWith('./')) {
        path = path.substring(2);
    }
    if (_usePluginAssets) {
        // the plugin.js file is in lib/ directory and  we need to serve from assets/ directory 
        path = `../assets/${path}`;
        return new URL(path, import.meta.url).href;
    } else {
        return `/assets/${path}`;
    }
}