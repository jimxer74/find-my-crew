import * as fs from 'fs';
import * as path from 'path';

export interface ExportMetadata {
  generatedAt: string;
  seed: number;
  preset?: string;
  counts: {
    profiles: number;
    boats: number;
    journeys: number;
    legs: number;
    waypoints: number;
    registrations: number;
    notifications: number;
    consents: number;
  };
}

export interface ExportData {
  metadata: ExportMetadata;
  data: {
    profiles: unknown[];
    boats: unknown[];
    journeys: unknown[];
    legs: unknown[];
    waypoints: unknown[];
    registrations: unknown[];
    notifications: unknown[];
    userConsents: unknown[];
  };
}

/**
 * Export generated test data to a JSON file
 */
export function exportToJson(
  data: ExportData,
  filePath: string
): void {
  const dir = path.dirname(filePath);

  // Create directory if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const jsonContent = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, jsonContent, 'utf-8');

  console.log(`Exported test data to: ${filePath}`);
  console.log(`  Total size: ${(Buffer.byteLength(jsonContent, 'utf-8') / 1024).toFixed(2)} KB`);
}

/**
 * Import test data from a JSON file
 */
export function importFromJson(filePath: string): ExportData {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Import file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content) as ExportData;

  // Validate structure
  if (!data.metadata || !data.data) {
    throw new Error('Invalid export file format: missing metadata or data');
  }

  console.log(`Imported test data from: ${filePath}`);
  console.log(`  Generated at: ${data.metadata.generatedAt}`);
  console.log(`  Seed: ${data.metadata.seed}`);
  console.log(`  Preset: ${data.metadata.preset || 'custom'}`);

  return data;
}

/**
 * Create a summary report of generated data
 */
export function createSummaryReport(data: ExportData): string {
  const lines: string[] = [
    '='.repeat(60),
    'Test Data Generation Summary',
    '='.repeat(60),
    '',
    `Generated at: ${data.metadata.generatedAt}`,
    `Seed: ${data.metadata.seed}`,
    `Preset: ${data.metadata.preset || 'custom'}`,
    '',
    'Counts:',
    '-'.repeat(30),
  ];

  const counts = data.metadata.counts;
  lines.push(`  Profiles:      ${counts.profiles}`);
  lines.push(`  Boats:         ${counts.boats}`);
  lines.push(`  Journeys:      ${counts.journeys}`);
  lines.push(`  Legs:          ${counts.legs}`);
  lines.push(`  Waypoints:     ${counts.waypoints}`);
  lines.push(`  Registrations: ${counts.registrations}`);
  lines.push(`  Notifications: ${counts.notifications}`);
  lines.push(`  Consents:      ${counts.consents}`);
  lines.push('');
  lines.push('='.repeat(60));

  return lines.join('\n');
}

/**
 * Generate a default export filename based on seed and timestamp
 */
export function generateExportFilename(seed: number, preset?: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const presetPart = preset ? `-${preset}` : '';
  return `test-data-seed${seed}${presetPart}-${timestamp}.json`;
}
