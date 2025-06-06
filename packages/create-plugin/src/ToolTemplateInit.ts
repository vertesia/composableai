import { PackageJson } from "./Package.js";
import { TemplateInit, UserOptions } from "./TemplateInit.js";


export class ToolTemplateInit extends TemplateInit {
    constructor(options: UserOptions) {
        super(options);
    }

    getVars(): Record<string, any> {
        return {

        }
    }

    getPackageJson(): PackageJson {
        const answer = this.options;
        return {
            name: answer.plugin_name,
            version: answer.plugin_version || '1.0.0',
            description: answer.plugin_description || '',
            type: 'module',
            main: `lib/esm/index.js`,
            types: "lib/types/index.d.ts",
            files: [
                "lib"
            ],
            scripts: {
                "dev": "vite",
                "build": "tsc",
            }
        };
    }

    getDevDependencies(): string[] {
        return [
            "@hono/vite-dev-server",
            "@types/node",
            "esbuild",
            "typescript",
            "vite",
        ]
    }

    getRuntimeDependencies(): string[] {
        return [
            "@vertesia/agent-sdk",
            "@vertesia/client",
            "@vertesia/common",
            "hono"
        ]
    }

}