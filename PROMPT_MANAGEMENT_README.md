# AI Prompt Management System

## Overview

The AI Prompt Management System provides centralized management for all AI prompts in the Find-My-Crew application. This system addresses the challenge of scattered prompt texts across multiple files by providing a centralized, version-controlled, and testable prompt management solution.

## Features

- **Centralized Management**: Single location for all AI prompts
- **Version Control**: Track changes and rollback capabilities
- **Testing Framework**: Automated validation and performance testing
- **Type Safety**: Full TypeScript support with comprehensive interfaces
- **Backward Compatibility**: Gradual migration support for existing code
- **Performance Monitoring**: Built-in metrics and optimization tracking
- **A/B Testing**: Support for multiple prompt versions and experimentation

## Quick Start

### Basic Usage

```typescript
import { promptRegistry, PromptUtils, USE_CASES } from './app/lib/ai/prompts';

// Execute a prompt
const result = await promptRegistry.executePrompt(
  USE_CASES.BOAT_SUGGESTIONS,
  { boatType: 'cruiser', preferences: ['elegant'] }
);

console.log(result);
```

### Creating New Prompts

```typescript
import { PromptUtils, USE_CASES, PROMPT_FORMATS } from './app/lib/ai/prompts';

// Create a template prompt
const boatSuggestions = PromptUtils.createTemplatePrompt(
  'boat-suggestions',
  USE_CASES.BOAT_SUGGESTIONS,
  'Suggest 5 names for a ${boatType} boat...',
  'Generate boat name suggestions',
  ['boat', 'naming', 'creative']
);

// Register the prompt
promptRegistry.registerPrompt(boatSuggestions);
```

### Version Management

```typescript
// Create a new version of an existing prompt
promptRegistry.createVersion(
  USE_CASES.BOAT_SUGGESTIONS,
  updatedPrompt,
  'Updated prompt with better formatting'
);

// Execute specific version
const result = await promptRegistry.executePrompt(
  USE_CASES.BOAT_SUGGESTIONS,
  context,
  '2.0.0' // specific version
);
```

## File Structure

```
app/lib/ai/prompts/
├── index.ts                    # Main exports and registry instance
├── types.ts                    # TypeScript interfaces and types
├── registry.ts                 # Core registry implementation
├── builders/                   # Reusable prompt builders
│   ├── system-prompt-builder.ts
│   └── template-builder.ts
├── use-cases/                  # Organized by use case
│   ├── assistant-system.ts
│   ├── boat-suggestions.ts
│   ├── boat-details.ts
│   ├── profile-generation.ts
│   └── registration-assessment.ts
├── templates/                  # Static prompt templates
├── versioning/                 # Version control system
└── examples/                   # Integration examples

Migration scripts:
├── migration/migration.ts      # Migration utilities
└── test_prompt_management.ts   # Test suite
```

## Migration Guide

### Phase 1: Register Existing Prompts

```typescript
import { promptRegistry, PromptUtils, USE_CASES } from './app/lib/ai/prompts';

// Migrate inline prompt to registry
const boatSuggestions = PromptUtils.createTemplatePrompt(
  'boat-suggestions',
  USE_CASES.BOAT_SUGGESTIONS,
  `Suggest 5 names for a ${boatType} boat...`,
  'Generate boat name suggestions',
  ['boat', 'naming', 'creative']
);

promptRegistry.registerPrompt(boatSuggestions);
```

### Phase 2: Update API Routes

```typescript
// Before (inline prompt)
export async function POST(request: Request) {
  const prompt = `Suggest 5 names for a ${boatType} boat...`;
  const result = await callAI({ useCase: 'boat-suggestions', prompt });
  return Response.json(result);
}

// After (using registry)
export async function POST(request: Request) {
  const result = await promptRegistry.executePrompt(
    USE_CASES.BOAT_SUGGESTIONS,
    { boatType, preferences }
  );
  return Response.json(result);
}
```

### Phase 3: Enable Backward Compatibility

```typescript
import { compatibilityAdapter } from './app/lib/ai/prompts/migration/migration';

// Gradual migration with feature flags
export async function POST(request: Request) {
  const useNewSystem = process.env.USE_PROMPT_REGISTRY === 'true';

  if (useNewSystem) {
    const result = await promptRegistry.executePrompt(
      USE_CASES.BOAT_SUGGESTIONS,
      { boatType, preferences }
    );
    return Response.json(result);
  } else {
    const prompt = compatibilityAdapter.getBoatSuggestionsPrompt(boatType, preferences);
    const result = await callAI({ useCase: 'boat-suggestions', prompt });
    return Response.json(result);
  }
}
```

## Use Cases

### Boat Suggestions
- **Purpose**: Generate boat name suggestions based on type and preferences
- **Format**: Template with variable interpolation
- **Output**: JSON array of suggested names

### Boat Details Extraction
- **Purpose**: Extract boat specifications from unstructured text
- **Format**: Template with strict formatting requirements
- **Output**: Structured boat specification JSON

### Profile Generation
- **Purpose**: Create sailing profiles from Facebook data
- **Format**: Template with data analysis requirements
- **Output**: Comprehensive JSON profile

### Assistant System
- **Purpose**: Dynamic system prompts for AI assistant
- **Format**: Builder with context injection
- **Output**: Complex system prompt with user context

### Registration Assessment
- **Purpose**: Assess crew-leg compatibility
- **Format**: Builder with multiple data sources
- **Output**: Compatibility assessment JSON

## Testing

### Running Tests

```bash
# Run the comprehensive test suite
node test_prompt_management.ts

# Run specific use case tests
npm test -- --grep "boat-suggestions"
```

### Creating Test Cases

```typescript
import { PromptUtils } from './app/lib/ai/prompts';

// Create test case
const testCase = PromptUtils.createTestCase(
  'Basic boat suggestions',
  { boatType: 'cruiser', preferences: ['elegant'] },
  JSON.stringify({ names: ['Sea Breeze', 'Ocean Voyager'] })
);

// Create test suite
const testSuite = PromptUtils.createTestSuite(
  'Boat Suggestions Test',
  [testCase],
  0.9,    // accuracy threshold
  1000,   // performance threshold (ms)
  0.95    // format compliance threshold
);
```

## Performance Monitoring

### Built-in Metrics

The registry automatically tracks:
- Prompt execution time
- Success/failure rates
- Memory usage
- Cache hit rates

### Custom Monitoring

```typescript
import { promptRegistry } from './app/lib/ai/prompts';

// Get registry statistics
const stats = promptRegistry.getStats();
console.log('Registry stats:', stats);

// Monitor specific prompts
const prompt = promptRegistry.getPrompt('boat-suggestions');
console.log('Prompt metadata:', prompt.metadata);
```

## Version Control

### Creating Versions

```typescript
// Create new version
promptRegistry.createVersion(
  USE_CASES.BOAT_SUGGESTIONS,
  updatedPrompt,
  'Updated prompt with better formatting'
);

// List versions
const versions = promptRegistry.getVersions('boat-suggestions');
console.log('Available versions:', versions);
```

### A/B Testing

```typescript
// Execute different versions
const result1 = await promptRegistry.executePrompt('boat-suggestions', context, '1.0.0');
const result2 = await promptRegistry.executePrompt('boat-suggestions', context, '2.0.0');

// Compare results and performance
```

## Best Practices

### Prompt Design

1. **Clear Descriptions**: Always provide meaningful descriptions and tags
2. **Comprehensive Testing**: Include test cases for all prompt variations
3. **Version Management**: Use semantic versioning for prompt changes
4. **Documentation**: Maintain clear documentation for complex prompts

### Performance Optimization

1. **Caching**: Enable caching for frequently used prompts
2. **Lazy Loading**: Load prompts only when needed
3. **Memory Management**: Monitor memory usage for large prompts
4. **Error Handling**: Implement proper error handling and fallbacks

### Migration Strategy

1. **Gradual Migration**: Use feature flags for gradual rollout
2. **Backward Compatibility**: Maintain old prompts during transition
3. **Testing**: Comprehensive testing before and after migration
4. **Monitoring**: Monitor performance and error rates during migration

## Troubleshooting

### Common Issues

1. **Prompt Not Found**: Check use case identifier and registry initialization
2. **Execution Errors**: Verify prompt content and context parameters
3. **Performance Issues**: Enable caching and monitor execution times
4. **Version Conflicts**: Use semantic versioning and proper migration

### Debug Tools

```typescript
// List all registered prompts
const prompts = promptRegistry.listPrompts();
console.log('Available prompts:', prompts);

// Get prompt details
const prompt = promptRegistry.getPrompt('boat-suggestions');
console.log('Prompt details:', prompt);

// Run validation tests
const result = await promptRegistry.runTests('boat-suggestions');
console.log('Validation result:', result);
```

## Future Enhancements

### Planned Features

1. **Prompt Marketplace**: Share and reuse prompts across projects
2. **Automated Optimization**: AI-driven prompt improvement suggestions
3. **Collaborative Editing**: Multi-user prompt development workflow
4. **External Integrations**: Support for external prompt management tools

### Extensibility

The system is designed to be extensible:
- Custom prompt builders
- Additional storage backends
- Enhanced testing frameworks
- Integration with external AI services

## Support

For questions, issues, or contributions:

1. Check the troubleshooting section above
2. Review the comprehensive test suite
3. Examine the integration examples
4. Create an issue with detailed reproduction steps

## License

This project is licensed under the MIT License - see the LICENSE file for details.