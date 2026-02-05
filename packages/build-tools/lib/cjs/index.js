"use strict";
/**
 * Vertesia Rollup Import Plugin
 *
 * A flexible Rollup plugin for transforming imports with custom compilers and validation.
 * Supports preset transformers for common use cases (skills, raw files) and custom transformers.
 *
 * @example
 * ```typescript
 * import { vertesiaImportPlugin, skillTransformer, rawTransformer } from '@vertesia/build-tools';
 *
 * export default {
 *   plugins: [
 *     vertesiaImportPlugin({
 *       transformers: [skillTransformer, rawTransformer]
 *     })
 *   ]
 * };
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFrontmatter = exports.TemplateType = exports.PromptRole = exports.PromptDefinitionSchema = exports.SkillDefinitionSchema = exports.promptTransformer = exports.skillCollectionTransformer = exports.rawTransformer = exports.skillTransformer = exports.vertesiaImportPlugin = void 0;
// Core plugin
var plugin_js_1 = require("./plugin.js");
Object.defineProperty(exports, "vertesiaImportPlugin", { enumerable: true, get: function () { return plugin_js_1.vertesiaImportPlugin; } });
// Presets
var index_js_1 = require("./presets/index.js");
Object.defineProperty(exports, "skillTransformer", { enumerable: true, get: function () { return index_js_1.skillTransformer; } });
Object.defineProperty(exports, "rawTransformer", { enumerable: true, get: function () { return index_js_1.rawTransformer; } });
Object.defineProperty(exports, "skillCollectionTransformer", { enumerable: true, get: function () { return index_js_1.skillCollectionTransformer; } });
Object.defineProperty(exports, "promptTransformer", { enumerable: true, get: function () { return index_js_1.promptTransformer; } });
Object.defineProperty(exports, "SkillDefinitionSchema", { enumerable: true, get: function () { return index_js_1.SkillDefinitionSchema; } });
Object.defineProperty(exports, "PromptDefinitionSchema", { enumerable: true, get: function () { return index_js_1.PromptDefinitionSchema; } });
Object.defineProperty(exports, "PromptRole", { enumerable: true, get: function () { return index_js_1.PromptRole; } });
Object.defineProperty(exports, "TemplateType", { enumerable: true, get: function () { return index_js_1.TemplateType; } });
// Utilities
var frontmatter_js_1 = require("./parsers/frontmatter.js");
Object.defineProperty(exports, "parseFrontmatter", { enumerable: true, get: function () { return frontmatter_js_1.parseFrontmatter; } });
//# sourceMappingURL=index.js.map