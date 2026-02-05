"use strict";
/**
 * Widget compilation utility using Rollup
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileWidgets = compileWidgets;
const rollup_1 = require("rollup");
const node_path_1 = __importDefault(require("node:path"));
/**
 * Default external dependencies for widgets
 */
const DEFAULT_EXTERNALS = [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'react-dom/client'
];
/**
 * Compile widgets using Rollup
 *
 * @param widgets - Array of widget metadata to compile
 * @param outputDir - Directory to write compiled widgets
 * @param config - Widget compilation configuration
 * @returns Number of widgets compiled
 */
async function compileWidgets(widgets, outputDir, config = {}) {
    if (widgets.length === 0) {
        return 0;
    }
    const { external = DEFAULT_EXTERNALS, tsconfig = './tsconfig.json', typescript: typescriptOptions = {}, minify = false } = config;
    // Build each widget separately to get individual bundles
    const buildPromises = widgets.map(async (widget) => {
        // Dynamically import plugins - use any to bypass TypeScript module resolution issues
        const typescript = (await Promise.resolve(`${'@rollup/plugin-typescript'}`).then(s => __importStar(require(s)))).default;
        const nodeResolve = (await Promise.resolve(`${'@rollup/plugin-node-resolve'}`).then(s => __importStar(require(s)))).default;
        const commonjs = (await Promise.resolve(`${'@rollup/plugin-commonjs'}`).then(s => __importStar(require(s)))).default;
        const plugins = [
            typescript({
                tsconfig,
                declaration: false,
                sourceMap: true,
                ...typescriptOptions
            }),
            nodeResolve({
                browser: true,
                preferBuiltins: false,
                extensions: ['.tsx', '.ts', '.jsx', '.js']
            }),
            commonjs()
        ];
        // Add minification if requested
        if (minify) {
            const { terser } = await Promise.resolve(`${'rollup-plugin-terser'}`).then(s => __importStar(require(s)));
            plugins.push(terser({
                compress: {
                    drop_console: false
                }
            }));
        }
        const rollupConfig = {
            input: widget.path,
            output: {
                file: node_path_1.default.join(outputDir, `${widget.name}.js`),
                format: 'es',
                sourcemap: true,
                inlineDynamicImports: true
            },
            external,
            plugins
        };
        const bundle = await (0, rollup_1.rollup)(rollupConfig);
        await bundle.write(rollupConfig.output);
        await bundle.close();
    });
    await Promise.all(buildPromises);
    return widgets.length;
}
//# sourceMappingURL=widget-compiler.js.map