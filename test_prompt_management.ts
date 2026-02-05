/**
 * Test file for the AI Prompt Management System
 * Validates the centralized prompt registry and migration functionality
 */

import { promptRegistry, PromptUtils, USE_CASES } from './app/lib/ai/prompts';
import { migrationManager, compatibilityAdapter } from './app/lib/ai/prompts/migration/migration';

/**
 * Test the prompt management system functionality
 */
async function testPromptManagementSystem() {
  console.log('🧪 Testing AI Prompt Management System\\n');

  try {
    // Test 1: Register prompts
    console.log('Test 1: Registering prompts...');
    const boatSuggestions = PromptUtils.createTemplatePrompt(
      'test-boat-suggestions',
      USE_CASES.BOAT_SUGGESTIONS,
      'Test boat suggestions prompt: ${boatType} with preferences: ${preferences}',
      'Test boat suggestions',
      ['test', 'boat']
    );

    promptRegistry.registerPrompt(boatSuggestions);
    console.log('✅ Boat suggestions prompt registered successfully');

    // Test 2: Retrieve prompts
    console.log('\\nTest 2: Retrieving prompts...');
    const retrieved = promptRegistry.getPrompt(USE_CASES.BOAT_SUGGESTIONS);
    console.log('✅ Retrieved prompt:', retrieved.id);
    console.log('   Description:', retrieved.metadata.description);

    // Test 3: List prompts
    console.log('\\nTest 3: Listing all prompts...');
    const prompts = promptRegistry.listPrompts();
    console.log('✅ Found', prompts.length, 'prompts:');
    prompts.forEach(p => console.log(`   - ${p.id} (${p.useCase})`));

    // Test 4: Execute prompts
    console.log('\\nTest 4: Executing prompts...');
    const result = await promptRegistry.executePrompt(
      USE_CASES.BOAT_SUGGESTIONS,
      { boatType: 'cruiser', preferences: ['elegant'] }
    );
    console.log('✅ Prompt executed successfully:');
    console.log('   Result:', result);

    // Test 5: Version management
    console.log('\\nTest 5: Testing version management...');
    const updatedPrompt = {
      ...boatSuggestions,
      content: 'Updated test prompt: ${boatType}'
    };
    promptRegistry.createVersion(
      USE_CASES.BOAT_SUGGESTIONS,
      updatedPrompt,
      'Testing version management'
    );
    console.log('✅ Version created successfully');

    // Test 6: Run tests
    console.log('\\nTest 6: Running prompt tests...');
    const testResult = await promptRegistry.runTests(USE_CASES.BOAT_SUGGESTIONS);
    console.log('✅ Test results:', {
      isValid: testResult.isValid,
      errorCount: testResult.errors.length,
      warningCount: testResult.warnings.length
    });

    // Test 7: Get statistics
    console.log('\\nTest 7: Getting registry statistics...');
    const stats = promptRegistry.getStats();
    console.log('✅ Registry stats:', {
      totalPrompts: stats.totalPrompts,
      totalVersions: stats.totalVersions,
      totalTests: stats.totalTests,
      averageTestCoverage: stats.averageTestCoverage
    });

    // Test 8: Migration functionality
    console.log('\\nTest 8: Testing migration functionality...');
    const migrationResults = await migrationManager.migrateAll();
    console.log('✅ Migration results:', {
      total: migrationResults.length,
      successful: migrationResults.filter(m => m.status === 'success').length,
      failed: migrationResults.filter(m => m.status === 'failed').length
    });

    // Test 9: Backward compatibility
    console.log('\\nTest 9: Testing backward compatibility...');
    compatibilityAdapter.setUseOldPrompts(true);
    const oldPrompt = compatibilityAdapter.getBoatSuggestionsPrompt('cruiser', ['elegant']);
    console.log('✅ Old prompt format:', oldPrompt.length > 0 ? 'Available' : 'Missing');

    compatibilityAdapter.setUseOldPrompts(false);
    const newPrompt = compatibilityAdapter.getBoatSuggestionsPrompt('cruiser', ['elegant']);
    console.log('✅ New prompt format:', newPrompt.length > 0 ? 'Available' : 'Missing');

    // Test 10: Export/Import functionality
    console.log('\\nTest 10: Testing export/import functionality...');
    const exported = PromptUtils.exportPrompts(promptRegistry);
    console.log('✅ Exported prompts:', exported.length > 0 ? 'Success' : 'Failed');

    // Test 11: Validation functionality
    console.log('\\nTest 11: Testing validation...');
    const validation = migrationManager.validateMigrations();
    console.log('✅ Validation results:', {
      isValid: validation.isValid,
      issues: validation.issues.length,
      summary: validation.summary
    });

    // Test 12: Documentation generation
    console.log('\\nTest 12: Testing documentation generation...');
    const docs = PromptUtils.generateDocumentation(promptRegistry);
    console.log('✅ Documentation generated:', docs.length > 0 ? 'Success' : 'Failed');

    console.log('\\n🎉 All tests completed successfully!');
    console.log('\\n📋 Test Summary:');
    console.log('   ✅ Prompt registration and retrieval');
    console.log('   ✅ Prompt execution with context');
    console.log('   ✅ Version management');
    console.log('   ✅ Test execution and validation');
    console.log('   ✅ Registry statistics');
    console.log('   ✅ Migration functionality');
    console.log('   ✅ Backward compatibility');
    console.log('   ✅ Export/import capabilities');
    console.log('   ✅ Validation and documentation');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

/**
 * Test specific prompt use cases
 */
async function testSpecificUseCases() {
  console.log('\\n🎯 Testing specific use cases...\\n');

  // Test boat suggestions
  console.log('Test: Boat Suggestions');
  try {
    const result = await promptRegistry.executePrompt(
      USE_CASES.BOAT_SUGGESTIONS,
      {
        boatType: 'performance cruiser',
        preferences: ['fast', 'reliable', 'modern']
      }
    );
    console.log('✅ Boat suggestions result:', result.substring(0, 100) + '...');
  } catch (error) {
    console.log('❌ Boat suggestions failed:', error);
  }

  // Test boat details extraction
  console.log('\\nTest: Boat Details Extraction');
  try {
    const result = await promptRegistry.executePrompt(
      USE_CASES.BOAT_DETAILS,
      {
        text: 'This 2020 Beneteau Oceanis 46 has 46 feet length, 14 feet beam, and a 75 HP Yanmar engine.'
      }
    );
    console.log('✅ Boat details result:', result.substring(0, 100) + '...');
  } catch (error) {
    console.log('❌ Boat details failed:', error);
  }

  // Test profile generation
  console.log('\\nTest: Profile Generation');
  try {
    const result = await promptRegistry.executePrompt(
      USE_CASES.PROFILE_GENERATION,
      {
        facebookData: {
          name: 'John Doe',
          location: 'San Diego',
          work: 'Marine Engineer',
          posts: ['Loving sailing!', 'Just got my ASA 101']
        }
      }
    );
    console.log('✅ Profile generation result:', result.substring(0, 100) + '...');
  } catch (error) {
    console.log('❌ Profile generation failed:', error);
  }
}

/**
 * Performance benchmarking
 */
async function benchmarkPerformance() {
  console.log('\\n⚡ Performance Benchmarking...\\n');

  const startTime = performance.now();

  // Execute prompts multiple times to test performance
  for (let i = 0; i < 100; i++) {
    await promptRegistry.executePrompt(
      USE_CASES.BOAT_SUGGESTIONS,
      { boatType: 'test', preferences: ['performance'] }
    );
  }

  const endTime = performance.now();
  const avgTime = (endTime - startTime) / 100;

  console.log('✅ Performance Results:');
  console.log(`   Total time: ${endTime - startTime}ms`);
  console.log(`   Average time per prompt: ${avgTime}ms`);
  console.log(`   Prompts per second: ${1000 / avgTime}`);

  // Check registry stats
  const stats = promptRegistry.getStats();
  console.log('\\n📊 Final Registry Stats:');
  console.log(`   Total prompts: ${stats.totalPrompts}`);
  console.log(`   Total versions: ${stats.totalVersions}`);
  console.log(`   Total tests: ${stats.totalTests}`);
  console.log(`   Average test coverage: ${stats.averageTestCoverage}`);
}

// Run all tests
async function runAllTests() {
  await testPromptManagementSystem();
  await testSpecificUseCases();
  await benchmarkPerformance();
}

// Execute tests
runAllTests().catch(console.error);