import { addDevDependencies, addRuntimeDependencies } from "./deps.js";
import { PackageJson } from "./Package.js";

export interface UserOptions {
    pm: "npm" | "pnpm";
    plugin_name: string;
    plugin_version: string;
    plugin_description?: string;
    isolation: "shadow" | "css";
    template: string; // 'web' | 'tool' | 'activity'
}

export abstract class TemplateInit {
    pluginName: PluginName;
    constructor(public options: UserOptions) {
        this.pluginName = new PluginName(options.plugin_name);
    }
    abstract getPackageJson(): PackageJson;

    abstract getDevDependencies(): string[];

    abstract getRuntimeDependencies(): string[];

    abstract getVars(): Record<string, any>;

    installDeps() {
        const pm = this.options.pm;
        console.log("Installing dependencies");
        addDevDependencies(pm, this.getDevDependencies());
        addRuntimeDependencies(pm, this.getRuntimeDependencies());
    }
}

export class PluginName {
    scope?: string;
    name: string;
    _title?: string;
    constructor(public value: string) {
        if (value.startsWith('@')) {
            const index = value.indexOf('/');
            if (index > -1) {
                this.name = value.substring(index + 1);
                this.scope = value.substring(1, index);
            } else {
                throw new Error("Invalid plugin name");
            }
        } else {
            this.name = value;
            this.scope = undefined
        }
    }
    get title() {
        if (!this._title) {
            this._title = this.name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }
        return this._title;
    }
    get pascalCase() {
        return this.name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
    }
}