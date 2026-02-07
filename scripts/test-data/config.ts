/**
 * Configuration and presets for test data generation
 */

export interface DataConfig {
  /** Random seed for deterministic generation */
  seed: number;

  /** Number of profiles to create */
  profileCount: number;

  /** Ratio of profiles that should be owners (0-1) */
  ownerRatio: number;

  /** Boats per owner */
  boatsPerOwner: number | { min: number; max: number };

  /** Journeys per boat */
  journeysPerBoat: number | { min: number; max: number };

  /** Legs per journey */
  legsPerJourney: number | { min: number; max: number };

  /** Total number of registrations to create */
  registrationsCount: number;

  /** Notifications per user */
  notificationsPerUser: number | { min: number; max: number };

  /** Clear existing test data before generating */
  clearExisting: boolean;

  /** Export generated data to JSON file */
  exportPath?: string;
}

export type PresetName = 'minimal' | 'standard' | 'full';

/**
 * Preset configurations for common scenarios
 */
export const PRESETS: Record<PresetName, Omit<DataConfig, 'seed' | 'clearExisting' | 'exportPath'>> = {
  /**
   * Minimal preset - for quick testing
   * ~3 profiles, 1 boat, 1 journey, 2 legs
   */
  minimal: {
    profileCount: 3,
    ownerRatio: 0.34, // 1 owner out of 3
    boatsPerOwner: 1,
    journeysPerBoat: 1,
    legsPerJourney: 2,
    registrationsCount: 2,
    notificationsPerUser: { min: 0, max: 2 },
  },

  /**
   * Standard preset - for development
   * ~10 profiles, 4 boats, 6 journeys, 15 legs
   */
  standard: {
    profileCount: 10,
    ownerRatio: 0.3, // 3 owners
    boatsPerOwner: { min: 1, max: 2 },
    journeysPerBoat: { min: 1, max: 2 },
    legsPerJourney: { min: 2, max: 4 },
    registrationsCount: 20,
    notificationsPerUser: { min: 1, max: 5 },
  },

  /**
   * Full preset - for load testing
   * ~50 profiles, 15 boats, 30 journeys, 100 legs
   */
  full: {
    profileCount: 50,
    ownerRatio: 0.3, // 15 owners
    boatsPerOwner: { min: 1, max: 2 },
    journeysPerBoat: { min: 1, max: 3 },
    legsPerJourney: { min: 2, max: 5 },
    registrationsCount: 150,
    notificationsPerUser: { min: 2, max: 8 },
  },
};

/**
 * Get a preset configuration with seed and options
 */
export function getPresetConfig(
  preset: PresetName,
  options: {
    seed?: number;
    clearExisting?: boolean;
    exportPath?: string;
  } = {}
): DataConfig {
  const presetConfig = PRESETS[preset];

  return {
    ...presetConfig,
    seed: options.seed ?? Date.now(),
    clearExisting: options.clearExisting ?? false,
    exportPath: options.exportPath,
  };
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: DataConfig = {
  ...PRESETS.standard,
  seed: Date.now(),
  clearExisting: false,
};

/**
 * Parse CLI arguments into a DataConfig
 */
export function parseCliArgs(args: string[]): Partial<DataConfig> & { preset?: PresetName; help?: boolean } {
  const result: Partial<DataConfig> & { preset?: PresetName; help?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--help':
      case '-h':
        result.help = true;
        break;

      case '--preset':
      case '-p':
        if (nextArg && ['minimal', 'standard', 'full'].includes(nextArg)) {
          result.preset = nextArg as PresetName;
          i++;
        }
        break;

      case '--seed':
      case '-s':
        if (nextArg) {
          result.seed = parseInt(nextArg, 10);
          i++;
        }
        break;

      case '--clear':
      case '-c':
        result.clearExisting = true;
        break;

      case '--export':
      case '-e':
        if (nextArg) {
          result.exportPath = nextArg;
          i++;
        }
        break;

      case '--profiles':
        if (nextArg) {
          result.profileCount = parseInt(nextArg, 10);
          i++;
        }
        break;

      case '--boats':
        if (nextArg) {
          result.boatsPerOwner = parseInt(nextArg, 10);
          i++;
        }
        break;

      case '--journeys':
        if (nextArg) {
          result.journeysPerBoat = parseInt(nextArg, 10);
          i++;
        }
        break;

      case '--registrations':
        if (nextArg) {
          result.registrationsCount = parseInt(nextArg, 10);
          i++;
        }
        break;
    }
  }

  return result;
}

/**
 * Print help message
 */
export function printHelp(): void {
  console.log(`
Test Data Generator for Find My Crew

Usage:
  npm run seed:test-data -- [options]

Options:
  -h, --help              Show this help message
  -p, --preset <name>     Use a preset configuration (minimal, standard, full)
  -s, --seed <number>     Random seed for deterministic generation
  -c, --clear             Clear existing test data before generating
  -e, --export <path>     Export generated data to JSON file

  --profiles <number>     Number of profiles to generate
  --boats <number>        Boats per owner
  --journeys <number>     Journeys per boat
  --registrations <num>   Total number of registrations

Presets:
  minimal   - 3 profiles, 1 boat, 1 journey (quick testing)
  standard  - 10 profiles, ~4 boats, ~6 journeys (development)
  full      - 50 profiles, ~15 boats, ~30 journeys (load testing)

Examples:
  npm run seed:test-data -- --preset standard --clear
  npm run seed:test-data -- --preset minimal --seed 12345
  npm run seed:test-data -- --preset full --export ./test-data.json
  npm run seed:test-data -- --profiles 20 --boats 2 --clear

Environment Variables:
  NEXT_PUBLIC_SUPABASE_URL    - Supabase project URL (required)
  SUPABASE_SERVICE_ROLE_KEY   - Supabase service role key (required)
`);
}
