"use strict";
/**
 * Preset transformers for common use cases
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateType = exports.PromptRole = exports.PromptDefinitionSchema = exports.promptTransformer = exports.rawTransformer = exports.skillCollectionTransformer = exports.SkillDefinitionSchema = exports.skillTransformer = void 0;
var skill_js_1 = require("./skill.js");
Object.defineProperty(exports, "skillTransformer", { enumerable: true, get: function () { return skill_js_1.skillTransformer; } });
Object.defineProperty(exports, "SkillDefinitionSchema", { enumerable: true, get: function () { return skill_js_1.SkillDefinitionSchema; } });
var skill_collection_js_1 = require("./skill-collection.js");
Object.defineProperty(exports, "skillCollectionTransformer", { enumerable: true, get: function () { return skill_collection_js_1.skillCollectionTransformer; } });
var raw_js_1 = require("./raw.js");
Object.defineProperty(exports, "rawTransformer", { enumerable: true, get: function () { return raw_js_1.rawTransformer; } });
var prompt_js_1 = require("./prompt.js");
Object.defineProperty(exports, "promptTransformer", { enumerable: true, get: function () { return prompt_js_1.promptTransformer; } });
Object.defineProperty(exports, "PromptDefinitionSchema", { enumerable: true, get: function () { return prompt_js_1.PromptDefinitionSchema; } });
Object.defineProperty(exports, "PromptRole", { enumerable: true, get: function () { return prompt_js_1.PromptRole; } });
Object.defineProperty(exports, "TemplateType", { enumerable: true, get: function () { return prompt_js_1.TemplateType; } });
//# sourceMappingURL=index.js.map