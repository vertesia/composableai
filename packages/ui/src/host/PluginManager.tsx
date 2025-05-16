import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { PluginManifest } from "@vertesia/common";

export enum PluginInstanceStatus {
    registered,
    loading,
    loaded,
    error, //loading error
    installed,
}

export interface PluginModule {
    mount(slot: string): React.ReactNode;
    css?: string;
}

export class PluginInstance {
    status: PluginInstanceStatus = PluginInstanceStatus.registered;
    _module?: PluginModule;
    error?: Error;

    constructor(public manifest: PluginManifest) {
    }

    get isInstalled() {
        return this.status === PluginInstanceStatus.installed;
    }

    get isLoading() {
        return this.status === PluginInstanceStatus.loading;
    }

    get styleId() {
        return `plugin-style-${this.manifest.id}`;
    }

    async _load() {
        if (this.status === PluginInstanceStatus.registered) {
            try {
                const module = await import(/* @vite-ignore */ this.manifest.src);
                this.status = PluginInstanceStatus.loading;
                if (typeof module.mount !== "function") {
                    throw new Error(`Plugin ${this.manifest.id} does not provide a mount function`);
                }
                this._module = module;
                this.status = PluginInstanceStatus.loaded;
            } catch (err) {
                this.status = PluginInstanceStatus.error;
                throw err;
            }
        } else {
            throw new Error(`Plugin ${this.manifest.id} was already loaded`);
        }
    }

    async getModule(): Promise<PluginModule> {
        if (!this._module) {
            await this._load();
        }
        return this._module!;
    }

    install() {
        if (this.status === PluginInstanceStatus.loaded && this._module) {
            const module = this._module;
            if (module.css) {
                // inject css
                let style = document.getElementById(this.styleId) as HTMLStyleElement;
                if (!style) {
                    style = document.createElement('style');
                    style.id = this.styleId;
                    style.appendChild(document.createTextNode(module.css));
                    document.head.appendChild(style);
                    this.status = PluginInstanceStatus.installed;
                }
            }
        } else if (this.status !== PluginInstanceStatus.installed) {
            throw new Error(`Plugin ${this.manifest.id} is not loaded: ` + this.status);
        }
    }

    async uninstall() {
        if (this.status === PluginInstanceStatus.installed) {
            const style = document.getElementById(this.styleId);
            if (style) {
                style.remove();
                this.status = PluginInstanceStatus.loaded;
            }
        }
    }
}

export class PluginManager {
    plugins: Record<string, PluginInstance> = {};
    constructor(manifests: PluginManifest[] = []) {
        this.addAll(manifests);
    }
    addAll(manifests: PluginManifest[]) {
        return manifests.map(manifest => this.add(manifest));
    }
    add(manifest: PluginManifest) {
        const instance = new PluginInstance(manifest);
        this.plugins[manifest.id] = instance;
        return instance;
    }
    remove(id: string) {
        const instance = this.plugins[id];
        if (instance) {
            instance.uninstall();
            delete this.plugins[id];
        }
    }
    get(id: string) {
        return this.plugins[id];
    }
}

export interface PluginManagerState {
    manager: PluginManager;
    refresh(): void;
}

const PluginManagerContext = createContext<PluginManagerState | null>(null);

interface PluginsProviderProps {
    plugins: PluginManifest[];
    children?: React.ReactNode | React.ReactNode[];
}
export function PluginsProvider({ plugins, children }: PluginsProviderProps) {
    const [key, setKey] = useState(0);
    const manager = useMemo(() => new PluginManager(plugins), [plugins]);
    const ctx = {
        manager,
        refresh: () => setKey(key + 1),
    }
    return <PluginManagerContext.Provider key={key} value={ctx}>
        {children}
    </PluginManagerContext.Provider>
}

export function usePluginManager() {
    const ctx = useContext(PluginManagerContext);
    if (!ctx) {
        throw new Error('No PluginManagerContext found');
    }
    return ctx;
}

export function usePluginInstance(id: string) {
    return usePluginManager().manager.get(id);
}

/**
 * Get the plugin instance and load the module. Returns null if the plugin is not yet loaded.
 * When the plugin loads then returns the plugin instance
 * @param id
 * @returns
 */
export function usePluginModule(id: string): {
    plugin: PluginInstance | null,
    module: PluginModule | null,
    error: Error | null,
} {
    const [module, setModule] = useState<PluginModule | null>(null);
    const { manager } = usePluginManager();
    const plugin = manager.get(id);
    useEffect(() => {
        if (plugin) {
            plugin.getModule().then(setModule);
        }
    }, [plugin]);
    if (!plugin) {
        return {
            plugin: null,
            module: null,
            error: new Error(`Plugin ${id} not found`),
        }
    } else if (plugin.error) {
        return {
            plugin: plugin,
            module: plugin._module || null,
            error: plugin.error,
        };
    } else if (module) {
        return {
            plugin: plugin,
            module: module,
            error: null,
        };
    } else {
        return {
            plugin: plugin,
            module: module,
            error: plugin.error || null,
        };
    }
}
