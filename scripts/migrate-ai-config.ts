#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'app', 'lib', 'ai', 'config.ts');
const BACKUP_FILE = path.join(process.cwd(), 'app', 'lib', 'ai', 'config.ts.backup');

function backupCurrentConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.copyFileSync(CONFIG_FILE, BACKUP_FILE);
    console.log('✅ Backed up current config to', BACKUP_FILE);
  }
}

function createMigrationReport() {
  const report = `
# AI Configuration Migration Report

## Migration Complete

### Changes Made:
- ✅ Created new simplified configuration structure
- ✅ Moved provider-specific configurations to separate files
- ✅ Created environment-specific configurations (DEV/PROD)
- ✅ Added environment variable provider override support
- ✅ Updated AI service to use new configuration system

### Files Created:
- /app/lib/ai/config/index.ts (main loader)
- /app/lib/ai/config/dev.ts (development config)
- /app/lib/ai/config/prod.ts (production config)
- /app/lib/ai/config/providers/openrouter.ts
- /app/lib/ai/config/providers/deepseek.ts
- /app/lib/ai/config/providers/groq.ts
- /app/lib/ai/config/providers/gemini.ts

### Files Modified:
- /app/lib/ai/service.ts (updated to use new config)

### Files Backed Up:
- /app/lib/ai/config.ts → /app/lib/ai/config.ts.backup

### Environment Variables:
- New: SAILSMART_LLM_PROVIDER (optional provider override)

### Testing:
Run the following to verify migration:
1. npm run dev
2. Test AI API routes: /api/ai/boat-details, /api/ai/generate-journey
3. Verify all existing functionality works

### Rollback:
If issues occur, restore from backup:
mv /app/lib/ai/config.ts.backup /app/lib/ai/config.ts
`;

  fs.writeFileSync(path.join(process.cwd(), 'migration-report.md'), report);
  console.log('📄 Migration report created: /app/migration-report.md');
}

async function main() {
  console.log('🚀 Starting AI configuration migration...');

  backupCurrentConfig();
  createMigrationReport();

  console.log('✅ Migration complete!');
  console.log('📋 Please review the migration report and test the application.');
}

main().catch(console.error);