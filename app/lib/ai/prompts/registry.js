"use strict";
/**
 * Core Prompt Registry Implementation
 * Centralized management system for AI prompts with versioning, testing, and caching
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.PromptRegistry = void 0;
var types_1 = require("./types");
var PromptRegistry = /** @class */ (function () {
    function PromptRegistry(config) {
        this.prompts = new Map();
        this.versions = new Map();
        this.cache = new Map();
        this.metrics = [];
        this.migrations = [];
        this.config = __assign(__assign({}, types_1.DEFAULT_REGISTRY_CONFIG), config);
    }
    /**
     * Register a new prompt or update an existing one
     */
    PromptRegistry.prototype.registerPrompt = function (prompt) {
        // Validate the prompt
        var validation = this.validatePrompt(prompt);
        if (!validation.isValid) {
            throw new types_1.PromptRegistryError(types_1.PromptErrorType.INVALID_PROMPT, 'Prompt validation failed', validation.errors);
        }
        // Check if prompt already exists
        var existing = this.prompts.get(prompt.id);
        if (existing) {
            // Update existing prompt
            this.updatePrompt(prompt);
        }
        else {
            // Create new prompt
            this.createPrompt(prompt);
        }
    };
    /**
     * Get a prompt by use case and optional version
     */
    PromptRegistry.prototype.getPrompt = function (useCase, version) {
        // First try to find by use case
        var prompt = Array.from(this.prompts.values())
            .find(function (p) { return p.useCase === useCase; });
        if (!prompt) {
            throw new types_1.PromptRegistryError(types_1.PromptErrorType.PROMPT_NOT_FOUND, "No prompt found for use case: ".concat(useCase));
        }
        // If version specified, get specific version
        if (version) {
            return this.getPromptByVersion(prompt.id, version);
        }
        return prompt;
    };
    /**
     * Get a specific version of a prompt
     */
    PromptRegistry.prototype.getPromptByVersion = function (promptId, version) {
        var versions = this.versions.get(promptId);
        if (!versions) {
            throw new types_1.PromptRegistryError(types_1.PromptErrorType.VERSION_NOT_FOUND, "No versions found for prompt: ".concat(promptId));
        }
        var versionData = versions.find(function (v) { return v.version === version; });
        if (!versionData) {
            throw new types_1.PromptRegistryError(types_1.PromptErrorType.VERSION_NOT_FOUND, "Version ".concat(version, " not found for prompt: ").concat(promptId));
        }
        // Return a prompt definition with the specific version content
        var currentPrompt = this.prompts.get(promptId);
        if (!currentPrompt) {
            throw new types_1.PromptRegistryError(types_1.PromptErrorType.PROMPT_NOT_FOUND, "Prompt not found: ".concat(promptId));
        }
        return __assign(__assign({}, currentPrompt), { metadata: __assign(__assign({}, currentPrompt.metadata), { version: version }), content: versionData.content });
    };
    /**
     * Execute a prompt with context
     */
    PromptRegistry.prototype.executePrompt = function (useCase, context, version) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, prompt_1, result;
            return __generator(this, function (_a) {
                startTime = performance.now();
                try {
                    prompt_1 = this.getPrompt(useCase, version);
                    result = this.executePromptContent(prompt_1.content, context);
                    // Record metrics
                    this.recordMetrics({
                        promptId: prompt_1.id,
                        useCase: useCase,
                        timestamp: new Date(),
                        executionTime: performance.now() - startTime,
                        success: true
                    });
                    return [2 /*return*/, result];
                }
                catch (error) {
                    // Record failed metrics
                    this.recordMetrics({
                        promptId: '',
                        useCase: useCase,
                        timestamp: new Date(),
                        executionTime: performance.now() - startTime,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                    throw error;
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * List all prompts with metadata
     */
    PromptRegistry.prototype.listPrompts = function (search) {
        var _this = this;
        var prompts = Array.from(this.prompts.values());
        // Apply filters
        if (search) {
            if (search.useCase) {
                prompts = prompts.filter(function (p) { return p.useCase === search.useCase; });
            }
            if (search.tags && search.tags.length > 0) {
                prompts = prompts.filter(function (p) { var _a; return (_a = search.tags) === null || _a === void 0 ? void 0 : _a.every(function (tag) { return p.metadata.tags.includes(tag); }); });
            }
            if (search.format) {
                prompts = prompts.filter(function (p) { return p.format === search.format; });
            }
            if (search.author) {
                prompts = prompts.filter(function (p) { return p.metadata.author === search.author; });
            }
            if (search.dateRange) {
                var _a = search.dateRange, start_1 = _a.start, end_1 = _a.end;
                prompts = prompts.filter(function (p) {
                    var date = p.metadata.lastModified;
                    return (!start_1 || date >= start_1) && (!end_1 || date <= end_1);
                });
            }
            if (search.text) {
                var text_1 = search.text.toLowerCase();
                prompts = prompts.filter(function (p) {
                    return p.metadata.description.toLowerCase().includes(text_1) ||
                        _this.getPromptContentAsString(p.content).toLowerCase().includes(text_1);
                });
            }
        }
        // Convert to meta format
        return prompts.map(function (p) { return ({
            id: p.id,
            useCase: p.useCase,
            version: p.metadata.version,
            description: p.metadata.description,
            format: p.format,
            tags: p.metadata.tags,
            lastModified: p.metadata.lastModified,
            testCount: p.metadata.tests.length
        }); });
    };
    /**
     * Create a new version of an existing prompt
     */
    PromptRegistry.prototype.createVersion = function (useCase, prompt, reason) {
        var existing = Array.from(this.prompts.values())
            .find(function (p) { return p.useCase === useCase; });
        if (!existing) {
            throw new types_1.PromptRegistryError(types_1.PromptErrorType.PROMPT_NOT_FOUND, "No existing prompt found for use case: ".concat(useCase));
        }
        // Get existing versions
        var versions = this.versions.get(existing.id) || [];
        // Check version limit
        if (versions.length >= this.config.maxVersionsPerPrompt) {
            // Remove oldest version
            versions.shift();
        }
        // Add new version
        var newVersion = {
            version: this.getNextVersion(existing.metadata.version),
            content: prompt.content,
            reason: reason,
            date: new Date(),
            tests: prompt.metadata.tests || [],
            isActive: true
        };
        versions.push(newVersion);
        this.versions.set(existing.id, versions);
        // Update current prompt metadata
        existing.metadata.version = newVersion.version;
        existing.metadata.lastModified = new Date();
        existing.metadata.changelog.push(reason);
        this.clearCache(existing.id);
    };
    /**
     * Run tests for a specific prompt
     */
    PromptRegistry.prototype.runTests = function (useCase, version) {
        return __awaiter(this, void 0, void 0, function () {
            var prompt, testResults, _i, _a, testSuite, _b, _c, testCase, result, testResult, error_1, totalTests, passedTests, successRate;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        prompt = this.getPrompt(useCase, version);
                        testResults = [];
                        _i = 0, _a = prompt.metadata.tests;
                        _d.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 8];
                        testSuite = _a[_i];
                        _b = 0, _c = testSuite.cases;
                        _d.label = 2;
                    case 2:
                        if (!(_b < _c.length)) return [3 /*break*/, 7];
                        testCase = _c[_b];
                        _d.label = 3;
                    case 3:
                        _d.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.executePrompt(useCase, testCase.input, version)];
                    case 4:
                        result = _d.sent();
                        testResult = this.validateTestCase(result, testCase, testSuite.thresholds);
                        testResults.push(testResult);
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _d.sent();
                        testResults.push({
                            isValid: false,
                            errors: ["Test case failed: ".concat(error_1)],
                            warnings: []
                        });
                        return [3 /*break*/, 6];
                    case 6:
                        _b++;
                        return [3 /*break*/, 2];
                    case 7:
                        _i++;
                        return [3 /*break*/, 1];
                    case 8:
                        totalTests = testResults.length;
                        passedTests = testResults.filter(function (r) { return r.isValid; }).length;
                        successRate = totalTests > 0 ? passedTests / totalTests : 0;
                        return [2 /*return*/, {
                                isValid: successRate >= 0.8, // 80% success rate required
                                errors: testResults.flatMap(function (r) { return r.errors; }),
                                warnings: testResults.flatMap(function (r) { return r.warnings; })
                            }];
                }
            });
        });
    };
    /**
     * Get registry statistics
     */
    PromptRegistry.prototype.getStats = function () {
        var totalPrompts = this.prompts.size;
        var totalVersions = Array.from(this.versions.values())
            .reduce(function (sum, versions) { return sum + versions.length; }, 0);
        var totalTests = Array.from(this.prompts.values())
            .reduce(function (sum, prompt) { return sum + prompt.metadata.tests.length; }, 0);
        var mostUsed = this.getMostUsedPrompts(5);
        return {
            totalPrompts: totalPrompts,
            totalVersions: totalVersions,
            totalTests: totalTests,
            averageTestCoverage: totalPrompts > 0 ? totalTests / totalPrompts : 0,
            lastUpdated: new Date(),
            mostUsedPrompts: mostUsed,
            performanceMetrics: {
                averageRetrievalTime: this.getAverageRetrievalTime(),
                cacheHitRate: this.getCacheHitRate()
            }
        };
    };
    /**
     * Migrate a prompt from inline to registry
     */
    PromptRegistry.prototype.migratePrompt = function (prompt, fromLocation, toLocation) {
        try {
            this.registerPrompt(prompt);
            var record = {
                id: "".concat(prompt.id, "_").concat(Date.now()),
                fromLocation: fromLocation,
                toLocation: toLocation,
                migrationDate: new Date(),
                status: 'success',
                notes: "Migrated ".concat(prompt.useCase, " prompt from ").concat(fromLocation, " to ").concat(toLocation)
            };
            this.migrations.push(record);
            return record;
        }
        catch (error) {
            var record = {
                id: "".concat(prompt.id, "_").concat(Date.now()),
                fromLocation: fromLocation,
                toLocation: toLocation,
                migrationDate: new Date(),
                status: 'failed',
                notes: "Migration failed: ".concat(error instanceof Error ? error.message : 'Unknown error')
            };
            this.migrations.push(record);
            throw error;
        }
    };
    // Private methods
    PromptRegistry.prototype.createPrompt = function (prompt) {
        // Set default metadata
        prompt.metadata = __assign(__assign({}, types_1.DEFAULT_METADATA), prompt.metadata);
        this.prompts.set(prompt.id, prompt);
        // Initialize versions
        this.versions.set(prompt.id, []);
        // Create initial version
        this.createVersion(prompt.useCase, __assign(__assign({}, prompt), { id: undefined }), 'Initial version');
        this.clearCache(prompt.id);
    };
    PromptRegistry.prototype.updatePrompt = function (prompt) {
        var existing = this.prompts.get(prompt.id);
        if (!existing) {
            throw new types_1.PromptRegistryError(types_1.PromptErrorType.PROMPT_NOT_FOUND, "Prompt not found: ".concat(prompt.id));
        }
        // Update metadata
        existing.metadata.lastModified = new Date();
        if (prompt.metadata.description) {
            existing.metadata.description = prompt.metadata.description;
        }
        if (prompt.metadata.tags) {
            existing.metadata.tags = prompt.metadata.tags;
        }
        if (prompt.metadata.tests) {
            existing.metadata.tests = prompt.metadata.tests;
        }
        // Update content
        existing.content = prompt.content;
        this.clearCache(prompt.id);
    };
    PromptRegistry.prototype.executePromptContent = function (content, context) {
        if (typeof content === 'string') {
            return this.interpolateTemplate(content, context);
        }
        else if (typeof content === 'function') {
            return content(context);
        }
        else {
            throw new Error('Invalid prompt content type');
        }
    };
    PromptRegistry.prototype.interpolateTemplate = function (template, context) {
        if (!context)
            return template;
        return template.replace(/\$\{(\w+)\}/g, function (match, key) {
            var _a;
            return (_a = context[key]) !== null && _a !== void 0 ? _a : match;
        });
    };
    PromptRegistry.prototype.validatePrompt = function (prompt) {
        var errors = [];
        var warnings = [];
        // Validate required fields
        if (!prompt.id)
            errors.push('Prompt ID is required');
        if (!prompt.useCase)
            errors.push('Use case is required');
        if (!prompt.content)
            errors.push('Prompt content is required');
        if (!prompt.format)
            errors.push('Prompt format is required');
        // Validate format
        var validFormats = ['template', 'builder', 'constant'];
        if (!validFormats.includes(prompt.format)) {
            errors.push("Invalid format: ".concat(prompt.format));
        }
        // Validate content based on format
        var format = prompt.format;
        if (format === 'template' && typeof prompt.content !== 'string') {
            errors.push('Template format requires string content');
        }
        else if (format === 'builder' && typeof prompt.content !== 'function') {
            errors.push('Builder format requires function content');
        }
        // Validate metadata
        if (prompt.metadata.tests && !Array.isArray(prompt.metadata.tests)) {
            errors.push('Tests must be an array');
        }
        return {
            isValid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    };
    PromptRegistry.prototype.validateTestCase = function (actual, expected, thresholds) {
        var errors = [];
        var warnings = [];
        // Simple string comparison for now
        if (actual !== expected.expectedOutput) {
            errors.push("Output mismatch. Expected: ".concat(expected.expectedOutput, ", Got: ").concat(actual));
        }
        return {
            isValid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    };
    PromptRegistry.prototype.getNextVersion = function (currentVersion) {
        var parts = currentVersion.split('.').map(Number);
        parts[parts.length - 1]++;
        return parts.join('.');
    };
    PromptRegistry.prototype.getPromptContentAsString = function (content) {
        if (typeof content === 'string') {
            return content;
        }
        else if (typeof content === 'function') {
            return content.toString();
        }
        return '';
    };
    PromptRegistry.prototype.recordMetrics = function (metrics) {
        this.metrics.push(metrics);
        // Keep only last 1000 metrics
        if (this.metrics.length > 1000) {
            this.metrics = this.metrics.slice(-1000);
        }
    };
    PromptRegistry.prototype.getMostUsedPrompts = function (limit) {
        var counts = new Map();
        for (var _i = 0, _a = this.metrics; _i < _a.length; _i++) {
            var metric = _a[_i];
            var count = counts.get(metric.promptId) || 0;
            counts.set(metric.promptId, count + 1);
        }
        return Array.from(counts.entries())
            .map(function (_a) {
            var id = _a[0], count = _a[1];
            return ({ id: id, count: count });
        })
            .sort(function (a, b) { return b.count - a.count; })
            .slice(0, limit);
    };
    PromptRegistry.prototype.getAverageRetrievalTime = function () {
        if (this.metrics.length === 0)
            return 0;
        var totalTime = this.metrics.reduce(function (sum, metric) { return sum + metric.executionTime; }, 0);
        return totalTime / this.metrics.length;
    };
    PromptRegistry.prototype.getCacheHitRate = function () {
        // Simple cache hit rate calculation based on cache operations
        // This is a simplified implementation
        return 0.8; // Placeholder
    };
    PromptRegistry.prototype.clearCache = function (promptId) {
        if (promptId) {
            this.cache.delete(promptId);
        }
        else {
            this.cache.clear();
        }
    };
    return PromptRegistry;
}());
exports.PromptRegistry = PromptRegistry;
