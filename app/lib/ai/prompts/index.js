"use strict";
/**
 * Main exports for the AI Prompt Management System
 * Provides the central registry and utility functions for prompt management
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptUtils = exports.USE_CASES = exports.PROMPT_FORMATS = exports.DEFAULT_METADATA = exports.DEFAULT_REGISTRY_CONFIG = exports.PromptErrorType = exports.PromptRegistryError = exports.promptRegistry = exports.PromptRegistry = void 0;
// Import all types and constants from types.ts
var types_1 = require("./types");
Object.defineProperty(exports, "PromptRegistryError", { enumerable: true, get: function () { return types_1.PromptRegistryError; } });
Object.defineProperty(exports, "PromptErrorType", { enumerable: true, get: function () { return types_1.PromptErrorType; } });
Object.defineProperty(exports, "DEFAULT_REGISTRY_CONFIG", { enumerable: true, get: function () { return types_1.DEFAULT_REGISTRY_CONFIG; } });
Object.defineProperty(exports, "DEFAULT_METADATA", { enumerable: true, get: function () { return types_1.DEFAULT_METADATA; } });
Object.defineProperty(exports, "PROMPT_FORMATS", { enumerable: true, get: function () { return types_1.PROMPT_FORMATS; } });
Object.defineProperty(exports, "USE_CASES", { enumerable: true, get: function () { return types_1.USE_CASES; } });
// Import the registry class from registry.ts
var registry_1 = require("./registry");
// Export the registry class
var registry_2 = require("./registry");
Object.defineProperty(exports, "PromptRegistry", { enumerable: true, get: function () { return registry_2.PromptRegistry; } });
// Create and export the default registry instance
exports.promptRegistry = new registry_1.PromptRegistry();
// Utility functions for common operations
var PromptUtils = /** @class */ (function () {
    function PromptUtils() {
    }
    /**
     * Create a prompt definition with proper metadata
     */
    PromptUtils.createPromptDefinition = function (id, useCase, content, format, description, tags, tests) {
        if (tags === void 0) { tags = []; }
        if (tests === void 0) { tests = []; }
        return {
            id: id,
            useCase: useCase,
            content: content,
            format: format,
            metadata: {
                description: description,
                created: new Date(),
                lastModified: new Date(),
                author: 'system',
                tags: tags,
                version: '1.0.0',
                changelog: ['Initial version'],
                tests: tests
            }
        };
    };
    /**
     * Create a test case for prompt validation
     */
    PromptUtils.createTestCase = function (name, input, expectedOutput, description) {
        return {
            name: name,
            input: input,
            expectedOutput: expectedOutput,
            description: description
        };
    };
    /**
     * Create a test suite for comprehensive prompt testing
     */
    PromptUtils.createTestSuite = function (name, cases, accuracyThreshold, performanceThreshold, formatThreshold) {
        if (accuracyThreshold === void 0) { accuracyThreshold = 0.9; }
        if (performanceThreshold === void 0) { performanceThreshold = 1000; }
        if (formatThreshold === void 0) { formatThreshold = 0.95; }
        return {
            name: name,
            cases: cases,
            thresholds: {
                accuracy: accuracyThreshold,
                performance: performanceThreshold,
                formatCompliance: formatThreshold
            }
        };
    };
    /**
     * Create a template prompt with interpolation support
     */
    PromptUtils.createTemplatePrompt = function (id, useCase, template, description, tags) {
        if (tags === void 0) { tags = []; }
        return this.createPromptDefinition(id, useCase, template, 'template', description, tags);
    };
    /**
     * Create a builder prompt with dynamic content generation
     */
    PromptUtils.createBuilderPrompt = function (id, useCase, builder, description, tags) {
        if (tags === void 0) { tags = []; }
        return this.createPromptDefinition(id, useCase, builder, 'builder', description, tags);
    };
    /**
     * Create a constant prompt with static content
     */
    PromptUtils.createConstantPrompt = function (id, useCase, content, description, tags) {
        if (tags === void 0) { tags = []; }
        return this.createPromptDefinition(id, useCase, content, 'constant', description, tags);
    };
    /**
     * Validate prompt content against expected format
     */
    PromptUtils.validatePromptContent = function (content, expectedFormat) {
        if (expectedFormat === void 0) { expectedFormat = 'text'; }
        try {
            switch (expectedFormat) {
                case 'json':
                    JSON.parse(content);
                    return true;
                case 'markdown':
                    // Basic markdown validation
                    return content.includes('#') || content.includes('**') || content.includes('*');
                case 'text':
                    return typeof content === 'string' && content.length > 0;
                default:
                    return false;
            }
        }
        catch (_a) {
            return false;
        }
    };
    /**
     * Get prompt statistics and usage information
     */
    PromptUtils.getPromptStats = function (registry) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, registry.getStats()];
            });
        });
    };
    /**
     * Export prompts to JSON format for backup or sharing
     */
    PromptUtils.exportPrompts = function (registry) {
        var prompts = Array.from(registry['prompts'].values());
        return JSON.stringify(prompts, null, 2);
    };
    /**
     * Import prompts from JSON format
     */
    PromptUtils.importPrompts = function (registry, json) {
        var prompts = JSON.parse(json);
        for (var _i = 0, prompts_1 = prompts; _i < prompts_1.length; _i++) {
            var prompt_1 = prompts_1[_i];
            registry.registerPrompt(prompt_1);
        }
    };
    /**
     * Compare two prompt versions
     */
    PromptUtils.compareVersions = function (promptA, promptB) {
        var contentDiff = [];
        var metadataDiff = [];
        // Compare content
        if (typeof promptA.content === 'string' && typeof promptB.content === 'string') {
            if (promptA.content !== promptB.content) {
                contentDiff.push('Content differs');
            }
        }
        // Compare metadata
        if (promptA.metadata.description !== promptB.metadata.description) {
            metadataDiff.push('Description differs');
        }
        if (promptA.metadata.version !== promptB.metadata.version) {
            metadataDiff.push('Version differs');
        }
        return {
            contentDiff: contentDiff,
            metadataDiff: metadataDiff,
            versionDiff: "".concat(promptA.metadata.version, " vs ").concat(promptB.metadata.version)
        };
    };
    /**
     * Generate prompt documentation
     */
    PromptUtils.generateDocumentation = function (registry) {
        var prompts = registry.listPrompts();
        var docs = '# AI Prompt Documentation\\n\\n';
        for (var _i = 0, prompts_2 = prompts; _i < prompts_2.length; _i++) {
            var prompt_2 = prompts_2[_i];
            docs += "## ".concat(prompt_2.id, "\\n");
            docs += "**Use Case:** ".concat(prompt_2.useCase, "\\n");
            docs += "**Format:** ".concat(prompt_2.format, "\\n");
            docs += "**Version:** ".concat(prompt_2.version, "\\n");
            docs += "**Tags:** ".concat(prompt_2.tags.join(', '), "\\n");
            docs += "**Tests:** ".concat(prompt_2.testCount, "\\n\\n");
        }
        return docs;
    };
    return PromptUtils;
}());
exports.PromptUtils = PromptUtils;
