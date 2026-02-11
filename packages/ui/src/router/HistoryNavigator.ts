import { joinPath } from "./path";
import { PathWithParams } from "./PathWithParams";

const BASE_PATH = Symbol('BASE_PATH');
export { BASE_PATH };

export type LocationChangeEventName = 'beforeChange' | 'afterChange';
export type LocationChangeType = 'initial' | 'popState' | 'linkClick' | 'navigate';
export class LocationChangeEvent {
    _canceled = false;
    constructor(
        public name: LocationChangeEventName,
        public type: LocationChangeType,
        public location: URL,
        public state?: any) {
    }

    get isPageLoad() {
        return this.type === 'initial';
    }

    get isBackForward() {
        return this.type === 'popState';
    }

    get isLinkClick() {
        return this.type === 'linkClick';
    }

    get isNavigation() {
        return this.type === 'navigate';
    }

    get isCancelable() {
        return this.name === 'beforeChange';
    }

    cancel() {
        if (this.name === 'afterChange') {
            throw new Error('Cannot cancel afterChange event');
        }
        this._canceled = true;
    }

}

export class BeforeLocationChangeEvent extends LocationChangeEvent {
    constructor(type: LocationChangeType, location: URL, state?: any) {
        super('beforeChange', type, location, state);
    }
}
export class AfterLocationChangeEvent extends LocationChangeEvent {
    constructor(type: LocationChangeType, location: URL, state?: any) {
        super('afterChange', type, location, state);
    }
}

export interface NavigateOptions {
    replace?: boolean;
    state?: any;
    /**
     * if defined prepend the basePath to the `to` argument
     */
    basePath?: string;
    /**
     * if defined, indicate whether the basePath will be used as a top-level base path or a nested base path.
     */
    isBasePathNested?: boolean;
    // Number of steps to go back in history, which will pop the history stack instead of pushing a new entry
    stepsBack?: number;
    // the title to set for the new history entry
    title?: string;
}

function getElementHrefAsUrl(elem: HTMLElement) {
    if (elem && elem.tagName.toLowerCase() === 'a') {
        const href = (elem as HTMLAnchorElement)?.href.trim();
        if (typeof href === 'string' && href.length > 0) {
            return new URL(href);
        }
    }
    return null;
}

export class HistoryNavigator {
    // params to preserve in the query string when navigating
    stickyParams?: Record<string, string>;
    _popStateListener?: (ev: PopStateEvent) => void;
    _linkNavListener?: (ev: MouseEvent) => void;
    _listeners: ((event: LocationChangeEvent) => void)[] = [];
    constructor() {
    }

    addListener(listener: (event: LocationChangeEvent) => void) {
        this._listeners.push(listener);
    }

    fireLocationChange(event: LocationChangeEvent) {
        for (const listener of this._listeners) {
            listener(event);
        }
    }

    /**
     * Should be called when the page is first loaded.
     * It will fire a location change event with type `initial` and the current window.location as the location
     */
    firePageLoad() {
        this.fireLocationChange(new AfterLocationChangeEvent('initial', new URL(window.location.href)));
    }

    addStickyParams(path: string) {
        if (this.stickyParams) {
            return new PathWithParams(path).add(this.stickyParams).toString();
        }
        return path;
    }

    navigate(to: string, options: NavigateOptions = {}) {
        if (options.stepsBack && options.stepsBack > 0) {
            this.stepBack(options.stepsBack, options);
            return;
        }

        if (options.basePath) {
            let basePath = options.basePath;
            if (!basePath.startsWith('/')) {
                basePath = '/' + basePath;
            }
            to = joinPath(basePath, to);
        }
        to = this.addStickyParams(to);
        this._navigate(new URL(to, window.location.href), 'navigate', options);
    }

    stepBack(steps: number, options: NavigateOptions = {}) {
        const historyChain = window.history.state.historyChain || [];
        const to = historyChain.length >= steps
            ? new URL(historyChain[historyChain.length - steps].href, window.location.href)
            : new URL(window.location.origin, window.location.href);
        this._navigate(to, 'popState', options);

        const stateToStore = {
            from: window.location.href,
            historyChain: historyChain.slice(0, -steps),
            data: options.state || undefined,
            title: options.title || document.title
        };
        
        window.history['replaceState'](stateToStore, '', to.href);
        this.fireLocationChange(new AfterLocationChangeEvent('popState', to, options.state));
    }

    _navigate(to: URL, type: LocationChangeType, options: NavigateOptions) {
        const beforeEvent = new BeforeLocationChangeEvent(type, to, options.state);
        this.fireLocationChange(beforeEvent);
        if (beforeEvent._canceled) {
            return;
        }
        
        // Build navigation chain by preserving previous history
        const currentState = window.history.state;
        const currentTitle = options.title || document.title;
        
        // Create new history chain entry
        const newChainEntry = {
            title: currentTitle,
            href: window.location.pathname + window.location.search + window.location.hash
        };
        
        // Build the history chain - clear if using replace
        let historyChain: Array<{title: string, href: string}> = [];
        if (!options.replace && currentState?.historyChain) {
            historyChain = [...currentState.historyChain];
        }

        // Only add to chain if not replacing
        if (!options.replace) {
            historyChain.push(newChainEntry);
            
            // Limit chain length to prevent memory issues (keep last 10 entries)
            if (historyChain.length > 10) {
                historyChain = historyChain.slice(-10);
            }
        }
        
        const stateToStore = {
            from: window.location.href,
            historyChain: historyChain,
            data: options.state || undefined,
            title: options.title || document.title
        };
        
        window.history[options.replace ? 'replaceState' : 'pushState'](stateToStore, '', to.href);
        
        this.fireLocationChange(new AfterLocationChangeEvent(type, to, options.state));
    }

    start() {
        if (typeof window === "undefined") {
            return;
        }
        const _popStateListener = (ev: PopStateEvent) => {
            let type: LocationChangeType = ev.state ? 'popState' : 'linkClick';
            const to = new URL(window.location.href);
            let state: any = undefined;
            if (ev.state) {
                type = 'popState';
                state = ev.state.data;
            } else {
                type = 'linkClick';
            }
            this.fireLocationChange(new AfterLocationChangeEvent(type, to, state));
        }
        const _linkNavListener = (ev: MouseEvent) => {
            const target = ev.target as HTMLElement;
            // Skip anchors with download attribute or blob: URLs - they are file downloads, not navigation
            if (target.tagName.toLowerCase() === 'a' && (
                (target as HTMLAnchorElement).hasAttribute('download') ||
                (target as HTMLAnchorElement).href?.startsWith('blob:')
            )) {
                return;
            }
            const url = getElementHrefAsUrl(target)
            if (url && url.origin === window.location.origin) {
                ev.preventDefault();
                const to = new URL(this.addStickyParams(url.href));
                const basePath = (ev as any)[BASE_PATH] || (ev.target as any)[BASE_PATH];
                if (basePath) {
                    to.pathname = joinPath(basePath, to.pathname);
                }
                this._navigate(to, 'linkClick', {});
            }
        }
        this._popStateListener = _popStateListener;
        this._linkNavListener = _linkNavListener;
        window.addEventListener('popstate', _popStateListener);
        document.body.addEventListener('click', this._linkNavListener);
    }

    stop() {
        this._popStateListener && window.removeEventListener('popstate', this._popStateListener);
        this._linkNavListener && document.body.removeEventListener('click', this._linkNavListener);
    }
}