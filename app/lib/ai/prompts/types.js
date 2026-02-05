"use strict";
/**
 * Type definitions for the centralized AI prompt management system
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_METADATA = exports.DEFAULT_REGISTRY_CONFIG = exports.PromptRegistryError = exports.PromptErrorType = exports.USE_CASES = exports.PROMPT_FORMATS = void 0;
// Re-export constants
exports.PROMPT_FORMATS = {
    TEMPLATE: 'template',
    BUILDER: 'builder',
    CONSTANT: 'constant'
};
exports.USE_CASES = {
    ASSISTANT_SYSTEM: 'assistant-system',
    BOAT_SUGGESTIONS: 'boat-suggestions',
    BOAT_DETAILS: 'boat-details',
    PROFILE_GENERATION: 'profile-generation',
    REGISTRATION_ASSESSMENT: 'registration-assessment'
};
// Error types for prompt registry
var PromptErrorType;
(function (PromptErrorType) {
    PromptErrorType["PROMPT_NOT_FOUND"] = "PROMPT_NOT_FOUND";
    PromptErrorType["VERSION_NOT_FOUND"] = "VERSION_NOT_FOUND";
    PromptErrorType["INVALID_PROMPT"] = "INVALID_PROMPT";
    PromptErrorType["VALIDATION_FAILED"] = "VALIDATION_FAILED";
    PromptErrorType["MIGRATION_FAILED"] = "MIGRATION_FAILED";
    PromptErrorType["VERSION_LIMIT_EXCEEDED"] = "VERSION_LIMIT_EXCEEDED";
    PromptErrorType["CACHE_ERROR"] = "CACHE_ERROR";
})(PromptErrorType || (exports.PromptErrorType = PromptErrorType = {}));
// Custom error class for prompt registry
var PromptRegistryError = /** @class */ (function (_super) {
    __extends(PromptRegistryError, _super);
    function PromptRegistryError(type, message, details) {
        var _this = _super.call(this, message) || this;
        _this.type = type;
        _this.details = details;
        _this.name = 'PromptRegistryError';
        return _this;
    }
    return PromptRegistryError;
}(Error));
exports.PromptRegistryError = PromptRegistryError;
// Configuration for the prompt management system
exports.DEFAULT_REGISTRY_CONFIG = {
    enableVersioning: true,
    enableTesting: true,
    enableCaching: true,
    cacheTTL: 5 * 60 * 1000, // 5 minutes
    maxVersionsPerPrompt: 10
};
// Default metadata template
exports.DEFAULT_METADATA = {
    created: new Date(),
    lastModified: new Date(),
    author: 'system',
    tags: [],
    version: '1.0.0',
    changelog: ['Initial version'],
    tests: []
};
