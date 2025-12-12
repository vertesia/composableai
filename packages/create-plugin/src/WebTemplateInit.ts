import { PackageJson } from "./Package.js";
import { TemplateInit, UserOptions } from "./TemplateInit.js";


export class WebTemplateInit extends TemplateInit {
    constructor(options: UserOptions) {
        super(options);
    }

    getVars(): Record<string, any> {
        return {
            plugin_title: this.pluginName.title,
            PluginComponent: this.pluginName.pascalCase + "Plugin",
            inlineCss: this.options.isolation === "css"
        }
    }

    getPackageJson(): PackageJson {
        const answer = this.options;
        return {
            name: answer.plugin_name,
            version: answer.plugin_version || '1.0.0',
            description: answer.plugin_description || '',
            type: 'module',
            files: [
                "dist"
            ],
            scripts: {
                "dev": "vite dev",
                "build:app": "vite build --mode app",
                "build:lib": "vite build --mode lib",
                "build": "vite build --mode app && vite build --mode lib",
                "lint": "eslint .",
                "preview": "vite preview"
            },
            peerDependencies: {
                "react": "^19.2.3",
                "react-dom": "^19.2.3"
            },
        };
    }

    getDevDependencies(): string[] {
        return [
            "@eslint/js",
            "@vertesia/plugin-builder",
            "@vitejs/plugin-basic-ssl",
            "@vitejs/plugin-react",
            "@tailwindcss/vite",
            "@tailwindcss/forms",
            "@types/node",
            "@types/react",
            "@types/react-dom",
            "eslint",
            "eslint-plugin-react-hooks",
            "eslint-plugin-react-refresh",
            "globals",
            "react",
            "react-dom",
            "tailwindcss",
            "typescript",
            "typescript-eslint",
            "vite",
            "vite-plugin-serve-static"
        ]
    }

    getRuntimeDependencies(): string[] {
        return [
            "@vertesia/common",
            "@vertesia/ui",
        ]
    }

}