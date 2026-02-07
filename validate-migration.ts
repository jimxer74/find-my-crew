#!/usr/bin/env tsx

/**
 * Validation script to ensure the AI configuration migration is complete and working
 */

import fs from 'fs';
import path from 'path';

async function validateMigration() {
  console.log('🔍 Validating AI Configuration Migration');
  console.log('==========================================');

  let errors: string[] = [];
  let warnings: string[] = [];

  // 1. Check if new configuration files exist
  const newFiles = [
    'app/lib/ai/config/index.ts',
    'app/lib/ai/config/dev.ts',
    'app/lib/ai/config/prod.ts',
    'app/lib/ai/config/providers/openrouter.ts',
    'app/lib/ai/config/providers/deepseek.ts',
    'app/lib/ai/config/providers/groq.ts',
    'app/lib/ai/config/providers/gemini.ts'
  ];

  console.log('📁 Checking new configuration files...');
  for (const file of newFiles) {
    if (fs.existsSync(path.join(process.cwd(), file))) {
      console.log(`  ✅ ${file}`);
    } else {
      errors.push(`Missing file: ${file}`);
      console.log(`  ❌ ${file}`);
    }
  }

  // 2. Check if old configuration file exists (should be backed up)
  const oldFile = 'app/lib/ai/config.ts';
  const backupFile = 'app/lib/ai/config.ts.backup';

  console.log('\n📁 Checking backup files...');
  if (fs.existsSync(path.join(process.cwd(), oldFile))) {
    console.log(`  ⚠️  ${oldFile} - exists (should be replaced by new system)`);
    warnings.push('Old config file still exists - consider renaming or removing after validation');
  } else {
    console.log(`  ❌ ${oldFile} - missing`);
    errors.push('Old config file not found - backup may be missing');
  }

  if (fs.existsSync(path.join(process.cwd(), backupFile))) {
    console.log(`  ✅ ${backupFile} - exists`);
  } else {
    console.log(`  ⚠️  ${backupFile} - missing (backup may not have been created)`);
    warnings.push('Backup file not found - ensure migration script was run');
  }

  // 3. Check if service file has been updated
  const serviceFile = 'app/lib/ai/service.ts';
  console.log('\n🔧 Checking service file...');
  if (fs.existsSync(path.join(process.cwd(), serviceFile))) {
    const serviceContent = fs.readFileSync(path.join(process.cwd(), serviceFile), 'utf-8');
    if (serviceContent.includes("from './config'")) {
      console.log('  ✅ Service imports from new config system');
    } else {
      errors.push('Service file not updated to use new config system');
      console.log('  ❌ Service not using new config system');
    }
  } else {
    errors.push('Service file not found');
    console.log('  ❌ Service file missing');
  }

  // 4. Check if test files exist
  const testFiles = [
    'test-ai-config.ts',
    'AI_CONFIGURATION_MIGRATION.md',
    'scripts/migrate-ai-config.ts'
  ];

  console.log('\n📝 Checking documentation and test files...');
  for (const file of testFiles) {
    if (fs.existsSync(path.join(process.cwd(), file))) {
      console.log(`  ✅ ${file}`);
    } else {
      console.log(`  ❌ ${file} - missing`);
      errors.push(`Missing file: ${file}`);
    }
  }

  // 5. Validate configuration structure
  console.log('\n⚙️  Validating configuration structure...');
  try {
    // Import and test the new configuration system
    const {
      getCurrentConfig,
      getCurrentEnvironment,
      getAPIKeys,
      hasAnyProvider
    } = await import('./app/lib/ai/config/index');

    const config = getCurrentConfig();
    console.log(`  ✅ Configuration loaded: ${config.providers.length} providers`);

    const env = getCurrentEnvironment();
    console.log(`  ✅ Environment detected: ${env}`);

    const apiKeys = getAPIKeys();
    const configuredProviders = Object.keys(apiKeys).filter(key => apiKeys[key as any]);
    console.log(`  ✅ API keys configured for: ${configuredProviders.join(', ')}`);

    console.log(`  ✅ Has providers configured: ${hasAnyProvider()}`);

  } catch (error) {
    errors.push(`Configuration validation failed: ${error}`);
    console.log(`  ❌ Configuration validation failed: ${error}`);
  }

  // 6. Summary
  console.log('\n📊 Migration Validation Summary');
  console.log('=================================');

  if (errors.length === 0) {
    console.log('🎉 Migration validation PASSED!');
    console.log('✅ All required files are in place');
    console.log('✅ Configuration system is working');
    console.log('✅ Ready for testing and deployment');
  } else {
    console.log('❌ Migration validation FAILED!');
    console.log('Errors found:');
    errors.forEach(error => console.log(`  - ${error}`));
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  // 7. Next steps
  console.log('\n🚀 Next Steps');
  console.log('============');
  console.log('1. Test the application with npm run dev');
  console.log('2. Test AI API routes: /api/ai/boat-details, /api/ai/generate-journey');
  console.log('3. Verify all existing functionality works');
  console.log('4. Update environment variables as needed');
  console.log('5. Consider removing old config file after validation');

  return errors.length === 0;
}

// Run validation
validateMigration().catch(console.error);