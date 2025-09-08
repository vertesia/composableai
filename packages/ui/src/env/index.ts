// hook to initialize the environment and auth session
// the main app must call this hook before rendering the page.

import { AuthTokenPayload } from "@vertesia/common";

export interface EnvProps {
    name: string; // the app name
    version: string,
    isLocalDev: boolean,
    isDocker: boolean,
    type: "production" | "staging" | "preview" | "development" | string,
    endpoints: {
        zeno: string,
        studio: string,
        sts?: string, // Security Token Service endpoint
    },
    firebase?: {
        apiKey: string,
        authDomain: string,
        projectId: string,
        appId?: string,
        providerType?: string,
    },
    datadog: boolean,
    logger?: {
        info: (msg: string, ...args: any) => void,
        warn: (msg: string, ...args: any) => void,
        error: (msg: string, ...args: any) => void,
        debug: (msg: string, ...args: any) => void,
    }
    onLogin?: (token: AuthTokenPayload) => void,
    onLogout?: () => void,
}

export class VertesiaEnvironment implements Readonly<EnvProps> {

    constructor(private _props?: EnvProps | undefined) {
    }

    init(props?: EnvProps) {
        this._props = props;
        return this;
    }

    private prop<K extends keyof EnvProps>(name: K): EnvProps[K] {
        if (!this._props) {
            throw new Error("VertesiaEnvironment was not initialized");
        }
        return this._props[name];
    }

    get version() {
        return this.prop("version");
    }

    get name() {
        return this.prop("name");
    }

    get type() {
        return this.prop("type");
    }

    get isProd() {
        return this.type === "production";
    }

    get isStable() {
        return this.type === "production" || this.type === "preview" || this.type === "dr";
    }

    get isDev() {
        return !this.isStable;
    }

    get isPreview() {
        return this.type === "preview";
    }

    get isLocalDev() {
        return this.prop("isLocalDev");
    }

    get isDocker() {
        return this.prop("isDocker");
    }

    get endpoints() {
        return this.prop("endpoints");
    }

    get firebase() {
        return this.prop("firebase");
    }

    get datadog() {
        return this.prop("datadog");
    }

    get logger() {
        return this._props?.logger ?? console
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
