# AI Prompt Management System Architecture

## Overview

This document outlines the architecture and implementation plan for a centralized AI prompt management system for the Find-My-Crew application. The system addresses the current challenge of scattered prompt texts across multiple files by providing a centralized, version-controlled, and testable prompt management solution.

## Current State Analysis

### Existing Prompt Patterns

1. **Inline Prompts** - Direct string templates in API routes
   - `app/api/ai/suggest-sailboats/route.ts` (lines 20-36)
   - `app/api/ai/fill-boat-details/route.ts` (lines 20-65)

2. **Builder Functions** - Dynamic prompt construction
   - `app/lib/ai/assistant/context.ts` - `buildSystemPrompt()` (lines 128-340)
   - `app/api/ai/assess-registration/[registrationId]/route.ts` - `buildAssessmentPrompt()` (lines 350-410+)

3. **Static Constants** - Pre-defined templates
   - `app/api/ai/generate-profile/route.ts` - `PROFILE_GENERATION_PROMPT` (lines 7-57)

### Current Challenges

- Prompts scattered across 9+ files
- No centralized overview or management
- Limited version control for prompt iterations
- Difficult to test prompt effectiveness
- Inconsistent formatting and structure
- No A/B testing capabilities

## Proposed Architecture

### 1. Centralized Prompt Registry

The core of the system is a prompt registry that serves as the single source of truth for all AI prompts.

```
app/lib/ai/prompts/
├── index.ts                    # Main registry exports
├── registry.ts                 # Core registry implementation
├── types.ts                    # TypeScript interfaces
├── use-cases/                  # Organized by use case
│   ├── assistant-system.ts     # System prompt builder
│   ├── boat-suggestions.ts     # Inline prompt template
│   ├── boat-details.ts         # Extraction prompt
│   ├── profile-generation.ts   # Profile builder
│   └── registration-assessment.ts # Assessment builder
├── builders/                   # Reusable prompt builders
│   ├── system-prompt-builder.ts
│   ├── assessment-builder.ts
│   └── template-builder.ts
├── templates/                  # Static prompt templates
│   ├── base-templates.ts
│   └── format-specifications.ts
└── versioning/                 # Version control system
    ├── versions.ts
    └── migration.ts
```

### 2. Core Interfaces

#### Prompt Definition
```typescript
interface PromptDefinition {
  id: string;
  version: string;
  useCase: UseCase;
  content: string | PromptBuilder;
  format: 'template' | 'builder' | 'constant';
  metadata: {
    description: string;
    created: Date;
    lastModified: Date;
    author: string;
    tags: string[];
    tests: TestSuite[];
  };
}
```

#### Prompt Registry
```typescript
interface PromptRegistry {
  getPrompt(useCase: UseCase, version?: string): PromptDefinition;
  listPrompts(): PromptMeta[];
  validatePrompt(prompt: PromptDefinition): ValidationResult;
  createVersion(useCase: UseCase, prompt: PromptDefinition, reason: string): void;
}
```

#### Test Suite
```typescript
interface TestSuite {
  name: string;
  inputs: any[];
  expectedOutputs: string[];
  thresholds: {
    accuracy: number;
    performance: number;
    formatCompliance: number;
  };
}
```

### 3. Use Cases to Organize

Based on current analysis, these are the identified use cases:

1. **`assistant-system`** - Complex 300+ line system prompt for AI assistant
2. **`boat-suggestions`** - Simple template for boat naming suggestions
3. **`boat-details`** - Extraction with strict format requirements
4. **`profile-generation`** - Facebook data summarization
5. **`registration-assessment`** - Crew-leg matching assessment

## Implementation Plan

### Phase 1: Core Infrastructure

#### Step 1: Create Type Definitions
- Define all TypeScript interfaces
- Create enums for use cases and prompt formats
- Establish metadata structure

#### Step 2: Implement Prompt Registry
- Core registry class with CRUD operations
- Version management capabilities
- Validation and testing framework

#### Step 3: Create Base Builders
- Reusable prompt builder utilities
- Template interpolation helpers
- Format specification utilities

### Phase 2: Migrate Existing Prompts

#### Step 4: Migrate Inline Prompts
- Extract prompts from API routes
- Convert to prompt definitions with metadata
- Maintain backward compatibility

#### Step 5: Migrate Builder Functions
- Convert existing builders to registry format
- Preserve dynamic functionality
- Add comprehensive test suites

#### Step 6: Migrate Static Constants
- Convert constants to prompt definitions
- Add version control and metadata
- Maintain performance characteristics

### Phase 3: Integration and Testing

#### Step 7: Update Service Layer
- Modify AI service to use prompt registry
- Update configuration to reference registry
- Maintain existing API contracts

#### Step 8: Comprehensive Testing
- Unit tests for all prompt definitions
- Integration tests for registry functionality
- Performance benchmarks for prompt retrieval

### Phase 4: Advanced Features

#### Step 9: A/B Testing Framework
- Multiple prompt version support
- Performance comparison utilities
- Automated optimization recommendations

#### Step 10: Monitoring and Analytics
- Prompt usage tracking
- Performance metrics collection
- Error rate monitoring

## File Structure Implementation

### Core Files

#### `app/lib/ai/prompts/types.ts`
```typescript
// Type definitions for the prompt management system
```

#### `app/lib/ai/prompts/registry.ts`
```typescript
// Core registry implementation with CRUD operations
```

#### `app/lib/ai/prompts/index.ts`
```typescript
// Main exports and registry instantiation
```

### Use Case Files

#### `app/lib/ai/prompts/use-cases/assistant-system.ts`
```typescript
// System prompt for AI assistant (300+ lines)
```

#### `app/lib/ai/prompts/use-cases/boat-suggestions.ts`
```typescript
// Boat naming suggestions template
```

#### `app/lib/ai/prompts/use-cases/boat-details.ts`
```typescript
// Boat specifications extraction prompt
```

#### `app/lib/ai/prompts/use-cases/profile-generation.ts`
```typescript
// Profile generation from Facebook data
```

#### `app/lib/ai/prompts/use-cases/registration-assessment.ts`
```typescript
// Crew registration assessment prompt
```

## Integration Points

### Service Layer Integration
```typescript
// app/lib/ai/service.ts - Updated to use registry
export async function callAI(options: AICallOptions): Promise<AIResponse> {
  const prompt = promptRegistry.getPrompt(options.useCase);
  // Implementation with registry integration
}
```

### Configuration Integration
```typescript
// app/lib/ai/config.ts - Updated to reference registry
export const useCases: UseCaseConfig = {
  'assistant-system': {
    model: 'deepseek-coder',
    provider: ['deepseek'],
    promptId: 'assistant-system', // Reference registry
    temperature: 0.7,
    maxTokens: 4000
  }
};
```

## Migration Strategy

### Backward Compatibility
- Maintain existing API contracts during transition
- Gradual migration of individual prompts
- Feature flags for registry vs inline prompt usage

### Testing During Migration
- Parallel testing of old and new prompt systems
- Performance comparison benchmarks
- Validation of prompt output consistency

## Benefits

### Developer Experience
- **Centralized Overview**: Single location to view all prompts
- **Better Tooling**: Enhanced IDE support with typed interfaces
- **Clear Documentation**: Built-in metadata and examples
- **Reduced Cognitive Load**: Consistent patterns across all prompts

### Maintainability
- **Version Control**: Track changes and rollback capabilities
- **Testing Framework**: Automated validation and performance testing
- **Consistent Structure**: Standardized formatting and organization
- **Easy Updates**: Centralized location for prompt modifications

### Operational Excellence
- **Performance Monitoring**: Built-in metrics and optimization
- **A/B Testing**: Multiple version support for experimentation
- **Error Tracking**: Comprehensive validation and error handling
- **Documentation**: Self-documenting prompt definitions

## Future Enhancements

### Phase 2 Features (Post-Implementation)
1. **Prompt Optimization**: AI-driven prompt improvement suggestions
2. **Usage Analytics**: Detailed metrics on prompt performance
3. **Collaborative Editing**: Multi-user prompt development workflow
4. **External Integrations**: Support for external prompt management tools

### Long-term Vision
1. **Prompt Marketplace**: Share and reuse prompts across projects
2. **Automated Testing**: Continuous validation of prompt effectiveness
3. **Performance Optimization**: Automatic prompt tuning based on usage data
4. **Multi-Language Support**: Internationalization for prompt content

## Implementation Timeline

### Week 1: Core Infrastructure
- Days 1-2: Type definitions and interfaces
- Days 3-4: Registry implementation
- Days 5-7: Base builders and utilities

### Week 2: Prompt Migration
- Days 1-3: Migrate inline prompts
- Days 4-5: Migrate builder functions
- Days 6-7: Migrate static constants

### Week 3: Integration and Testing
- Days 1-3: Service layer updates
- Days 4-5: Configuration updates
- Days 6-7: Comprehensive testing

### Week 4: Advanced Features
- Days 1-3: A/B testing framework
- Days 4-5: Monitoring and analytics
- Days 6-7: Documentation and final refinements

## Success Criteria

### Functional Requirements
- [ ] All existing prompts migrated to registry
- [ ] Zero breaking changes to existing API
- [ ] All prompt functionality preserved
- [ ] Comprehensive test coverage (>90%)

### Performance Requirements
- [ ] Prompt retrieval under 10ms
- [ ] Registry initialization under 100ms
- [ ] Memory usage under 5MB for all prompts
- [ ] No impact on existing API response times

### Quality Requirements
- [ ] TypeScript compilation with no errors
- [ ] All prompts pass validation tests
- [ ] Comprehensive documentation
- [ ] Code review approval

## Risk Mitigation

### Migration Risks
- **Mitigation**: Gradual migration with feature flags
- **Mitigation**: Parallel testing during transition period
- **Mitigation**: Rollback capabilities for each prompt

### Performance Risks
- **Mitigation**: Caching layer for prompt retrieval
- **Mitigation**: Lazy loading of prompt definitions
- **Mitigation**: Performance monitoring and alerts

### Operational Risks
- **Mitigation**: Comprehensive testing framework
- **Mitigation**: Clear rollback procedures
- **Mitigation**: Documentation and training materials

## Conclusion

This centralized AI prompt management system provides a robust solution for organizing and managing AI prompts in the Find-My-Crew application. The architecture balances immediate needs with long-term scalability, ensuring that the system can grow and evolve as prompt requirements become more complex.

The phased implementation approach minimizes risk while maximizing value delivery, and the comprehensive testing framework ensures reliability and performance. This system will significantly improve the developer experience while maintaining the high-quality AI interactions that users expect.