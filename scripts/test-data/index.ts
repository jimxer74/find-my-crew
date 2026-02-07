#!/usr/bin/env npx tsx

/**
 * Test Data Generator CLI
 *
 * Usage:
 *   npm run seed:test-data -- --preset standard --clear
 *   npm run seed:test-data -- --preset minimal --seed 12345
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(projectRoot, '.env.local') });

import {
  parseCliArgs,
  printHelp,
  getPresetConfig,
  PRESETS,
  type DataConfig,
  type PresetName,
} from './config.js';
import { initRandom } from './utils/seeded-random.js';
import { cleanupTestData } from './utils/cleanup.js';
import { exportToJson, createSummaryReport, type ExportData } from './utils/export.js';
import { generateAllData } from './generators/index.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cliOptions = parseCliArgs(args);

  // Show help if requested
  if (cliOptions.help) {
    printHelp();
    process.exit(0);
  }

  // Build configuration
  let config: DataConfig;

  if (cliOptions.preset) {
    config = getPresetConfig(cliOptions.preset, {
      seed: cliOptions.seed,
      clearExisting: cliOptions.clearExisting,
      exportPath: cliOptions.exportPath,
    });
  } else {
    // Use standard preset as base, override with CLI options
    config = getPresetConfig('standard', {
      seed: cliOptions.seed,
      clearExisting: cliOptions.clearExisting,
      exportPath: cliOptions.exportPath,
    });

    // Override with any explicit CLI options
    if (cliOptions.profileCount !== undefined) {
      config.profileCount = cliOptions.profileCount;
    }
    if (cliOptions.boatsPerOwner !== undefined) {
      config.boatsPerOwner = cliOptions.boatsPerOwner;
    }
    if (cliOptions.journeysPerBoat !== undefined) {
      config.journeysPerBoat = cliOptions.journeysPerBoat;
    }
    if (cliOptions.registrationsCount !== undefined) {
      config.registrationsCount = cliOptions.registrationsCount;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('  Find My Crew - Test Data Generator');
  console.log('='.repeat(60));
  console.log('');
  console.log('Configuration:');
  console.log(`  Preset: ${cliOptions.preset || 'custom'}`);
  console.log(`  Seed: ${config.seed}`);
  console.log(`  Clear existing: ${config.clearExisting}`);
  console.log(`  Profiles: ${config.profileCount}`);
  console.log(`  Owner ratio: ${(config.ownerRatio * 100).toFixed(0)}%`);
  console.log(`  Registrations: ${config.registrationsCount}`);
  if (config.exportPath) {
    console.log(`  Export to: ${config.exportPath}`);
  }
  console.log('');

  // Initialize random number generator with seed
  initRandom(config.seed);
  console.log(`Initialized RNG with seed: ${config.seed}`);

  // Clean up existing data if requested
  if (config.clearExisting) {
    console.log('\nClearing existing test data...');
    try {
      const { tablesCleared, usersDeleted } = await cleanupTestData({
        onProgress: console.log,
      });
      console.log(`Cleared ${tablesCleared.length} tables, deleted ${usersDeleted} test users\n`);
    } catch (error) {
      console.error('Error during cleanup:', error);
      process.exit(1);
    }
  }

  // Generate all data
  try {
    const data = await generateAllData({
      profileCount: config.profileCount,
      ownerRatio: config.ownerRatio,
      boatsPerOwner: config.boatsPerOwner,
      journeysPerBoat: config.journeysPerBoat,
      legsPerJourney: config.legsPerJourney,
      registrationsCount: config.registrationsCount,
      notificationsPerUser: config.notificationsPerUser,
      onProgress: console.log,
    });

    // Create export data structure
    const exportData: ExportData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        seed: config.seed,
        preset: cliOptions.preset,
        counts: {
          profiles: data.profiles.length,
          boats: data.boats.length,
          journeys: data.journeys.length,
          legs: data.legs.length,
          waypoints: data.waypoints.length,
          registrations: data.registrations.length,
          notifications: data.notifications.length,
          consents: data.userConsents.length,
        },
      },
      data: {
        profiles: data.profiles,
        boats: data.boats,
        journeys: data.journeys.map(j => ({ ...j, _route: undefined })), // Remove internal route reference
        legs: data.legs.map(l => ({
          ...l,
          _waypointStartIndex: undefined,
          _waypointCount: undefined,
          _journeyRoute: undefined,
        })),
        waypoints: data.waypoints,
        registrations: data.registrations,
        notifications: data.notifications,
        userConsents: data.userConsents,
      },
    };

    // Print summary
    console.log('\n' + createSummaryReport(exportData));

    // Export to JSON if requested
    if (config.exportPath) {
      const exportPath = path.isAbsolute(config.exportPath)
        ? config.exportPath
        : path.join(projectRoot, config.exportPath);
      exportToJson(exportData, exportPath);
    }

    console.log('\nTest data generation completed successfully!');
    console.log('');
    console.log('Sample test user credentials:');
    console.log('  Email: <username>@test.sailsmart.local');
    console.log('  Password: TestPassword123!');
    console.log('');

  } catch (error) {
    console.error('\nError during data generation:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
