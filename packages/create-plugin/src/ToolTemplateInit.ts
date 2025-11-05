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
                "dev": "vite --port 5174",
                "build": "vite build && pnpm exec rollup -c",
                "test": "vitest",
                "test:ui": "vitest --ui",
                "test:coverage": "vitest --coverage",
            }
        };
    }

    getDevDependencies(): string[] {
        return [
            "@hono/vite-dev-server",
            "@rollup/plugin-commonjs",
            "@rollup/plugin-json",
            "@rollup/plugin-node-resolve",
            "@types/node",
            "@vitest/coverage-v8",
            "esbuild",
            "rollup",
            "rollup-plugin-terser",
            "typescript",
            "vite",
            "vitest",
        ]
    }

    getRuntimeDependencies(): string[] {
        return [
            "@hono/node-server",
            "@vertesia/client",
            "@vertesia/common",
            "@vertesia/tools-sdk",
            "dotenv",
            "hono",
            "jose"
        ]
    }

}
