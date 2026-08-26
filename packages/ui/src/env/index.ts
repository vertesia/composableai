// hook to initialize the environment and auth session
// the main app must call this hook before rendering the page.

import type { AuthTokenPayload } from '@vertesia/common';

export interface EnvProps {
    name: string; // the app name
    version: string;
    commitTimestamp?: string; // ISO timestamp of the deployed commit
    sdkVersion?: string; // the @vertesia/ui package version
    isLocalDev: boolean;
    isDocker: boolean;
    type: 'production' | 'staging' | 'preview' | 'development' | string;
    endpoints: {
        zeno: string;
        studio: string;
        sts: string; // Security Token Service endpoint
        /**
         * Central Auth broker that issues the sign-in redirect and hosts `/logout`.
         *
         * Optional: when unset the session falls back to the long-standing broker, so an app that
         * does not set it keeps its current behaviour exactly. Set it to move one environment at a
         * time onto a different broker.
         */
        auth?: string;
        git?: string; // Smart HTTP app source git endpoint
        mcp?: string;
        /** Appgen app-gateway endpoint (serves live development previews and app bundles). */
        gateway?: string;
    };
    firebase?: {
        apiKey: string;
        authDomain: string;
        projectId: string;
        appId?: string;
        providerType?: string;
    };
    region?: string;
    datadogRum?: boolean;
    datadogLogs?: boolean;
    /**
     * Development-only Vertesia auth token.
     *
     * This is intended for sandbox/dev previews where the host process already
     * has a short-lived Vertesia token. Production apps must not set this.
     */
    devAuthToken?: string;
    /**
     * Optional host-provided Vertesia auth token bootstrap.
     *
     * Published generated apps use this to ask their same-origin app gateway for
     * the token backing the gateway session cookie, allowing UserSession to
     * initialize without redirecting through Central Auth.
     */
    authTokenProvider?: () => Promise<string | undefined>;
    logger?: {
        info: (msg: string, ...args: unknown[]) => void;
        warn: (msg: string, ...args: unknown[]) => void;
        error: (msg: string, ...args: unknown[]) => void;
        debug: (msg: string, ...args: unknown[]) => void;
    };
    onLogin?: (token: AuthTokenPayload) => void;
    onLogout?: () => void;
}

export type VertesiaRuntimeConfig =
    | {
          authMode: 'firebase';
          firebase: {
              apiKey: string;
              authDomain: string;
              projectId: string;
              appId: string;
          };
      }
    | {
          authMode: 'central';
      };

declare global {
    interface Window {
        AUTH_MODE?: 'firebase' | 'central';
        __VERTESIA_RUNTIME_CONFIG__?: VertesiaRuntimeConfig;
    }
}

function injectedRuntimeConfig(): VertesiaRuntimeConfig | undefined {
    if (typeof window === 'undefined') return undefined;
    const runtimeConfig = window.__VERTESIA_RUNTIME_CONFIG__;
    if (runtimeConfig?.authMode === 'central') return runtimeConfig;
    if (runtimeConfig?.authMode !== 'firebase') return undefined;

    const firebase = runtimeConfig.firebase;
    if (!firebase?.apiKey || !firebase.authDomain || !firebase.projectId || !firebase.appId) return undefined;
    return runtimeConfig;
}

export class VertesiaEnvironment implements Readonly<EnvProps> {
    constructor(private _props?: EnvProps | undefined) {}

    init(props?: EnvProps) {
        const runtimeConfig = injectedRuntimeConfig();
        const runtimeFirebase = runtimeConfig?.authMode === 'firebase' ? runtimeConfig.firebase : undefined;
        this._props = props && runtimeFirebase && !props.firebase ? { ...props, firebase: runtimeFirebase } : props;
        if (runtimeConfig && window.AUTH_MODE === undefined) window.AUTH_MODE = runtimeConfig.authMode;
        return this;
    }

    private prop<K extends keyof EnvProps>(name: K): EnvProps[K] {
        if (!this._props) {
            throw new Error('VertesiaEnvironment was not initialized');
        }
        return this._props[name];
    }

    get version() {
        return this.prop('version');
    }

    get commitTimestamp() {
        return this._props?.commitTimestamp;
    }

    get sdkVersion() {
        return this._props?.sdkVersion;
    }

    get name() {
        return this.prop('name');
    }

    get type() {
        return this.prop('type');
    }

    get isProd() {
        return this.type === 'production' || this.type === 'preview';
    }

    get isDev() {
        return !this.isProd;
    }

    get isLocalDev() {
        return this.prop('isLocalDev');
    }

    get isDocker() {
        return this.prop('isDocker');
    }

    get endpoints() {
        return this.prop('endpoints');
    }

    get firebase() {
        return this.prop('firebase');
    }

    get region() {
        return this._props?.region;
    }

    /**
     * @deprecated Use datadogRum and datadogLogs instead for more granular control. This will be removed in a future release. Is an alias for DatadogRUM
     *
     */
    get datadog() {
        return this.datadogRum;
    }

    get datadogRum() {
        return this._props?.datadogRum ?? false;
    }

    get datadogLogs() {
        return this._props?.datadogLogs ?? false;
    }

    get devAuthToken() {
        return this._props?.devAuthToken;
    }

    get authTokenProvider() {
        return this._props?.authTokenProvider;
    }

    get logger() {
        return this._props?.logger ?? console;
    }

    /**
     * Callback to notify the host app when the user logs in.
     */
    onLogin(token: AuthTokenPayload) {
        this._props?.onLogin?.(token);
    }

    /**
     * Callback to notify the host app when the user logs out
     */
    onLogout() {
        this._props?.onLogout?.();
    }
}

const Env = new VertesiaEnvironment();

export { Env };
