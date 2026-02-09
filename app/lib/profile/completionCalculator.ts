/**
 * Shared profile completion calculation logic.
 *
 * This is the **single source of truth** for which fields count toward profile
 * completion and how each field is evaluated.  Every client-side consumer
 * (profile page, missing-fields indicator, completion bar, etc.) should import
 * from here instead of duplicating the logic.
 *
 * NOTE: The database trigger (`update_profile_completion` in
 * migrations/002_fix_profile_completion_trigger.sql) mirrors this logic on the
 * server side.  If you add or remove a field here, update the SQL trigger too.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal shape of profile data needed for completion calculation. */
export interface ProfileDataForCompletion {
  username: string | null | undefined;
  full_name: string | null | undefined;
  phone: string | null | undefined;
  sailing_experience: number | string | null | undefined;
  risk_level: unknown[] | null | undefined;
  skills: unknown[] | null | undefined;
  sailing_preferences: string | null | undefined;
  roles: string[] | null | undefined;
}

export interface ProfileFieldStatus {
  /** Machine name – matches the DB column */
  name: string;
  /** Human-readable label */
  label: string;
  /** Which section of the profile page the field lives in */
  section: string;
  /** `true` when the field has no value / is empty */
  missing: boolean;
}

export interface ProfileCompletionResult {
  /** 0 – 100 */
  percentage: number;
  /** Number of fields that have a value */
  completedCount: number;
  /** Total number of fields evaluated */
  totalCount: number;
  /** Per-field status (all fields, including completed ones) */
  fields: ProfileFieldStatus[];
  /** Only the fields that are still missing */
  missingFields: ProfileFieldStatus[];
}

// ---------------------------------------------------------------------------
// Field definitions (order matters for display)
// ---------------------------------------------------------------------------

interface FieldDefinition {
  name: string;
  label: string;
  section: string;
  isMissing: (data: ProfileDataForCompletion) => boolean;
}

const PROFILE_FIELDS: FieldDefinition[] = [
  {
    name: 'username',
    label: 'Username',
    section: 'Basic Information',
    isMissing: (d) => !d.username || (typeof d.username === 'string' && d.username.trim() === ''),
  },
  {
    name: 'full_name',
    label: 'Full Name',
    section: 'Basic Information',
    isMissing: (d) => !d.full_name || (typeof d.full_name === 'string' && d.full_name.trim() === ''),
  },
  {
    name: 'phone',
    label: 'Phone Number',
    section: 'Basic Information',
    isMissing: (d) => !d.phone || (typeof d.phone === 'string' && d.phone.trim() === ''),
  },
  {
    name: 'sailing_experience',
    label: 'Sailing Experience Level',
    section: 'Experience',
    isMissing: (d) => d.sailing_experience === null || d.sailing_experience === undefined,
  },
  {
    name: 'risk_level',
    label: 'Risk Level Preferences',
    section: 'Experience',
    isMissing: (d) => !d.risk_level || !Array.isArray(d.risk_level) || d.risk_level.length === 0,
  },
  {
    name: 'skills',
    label: 'Skills',
    section: 'Skills',
    isMissing: (d) => !d.skills || !Array.isArray(d.skills) || d.skills.length === 0,
  },
  {
    name: 'sailing_preferences',
    label: 'Sailing Preferences',
    section: 'Preferences',
    isMissing: (d) =>
      !d.sailing_preferences ||
      (typeof d.sailing_preferences === 'string' && d.sailing_preferences.trim() === ''),
  },
  {
    name: 'roles',
    label: 'Roles (Owner/Crew)',
    section: 'Roles',
    isMissing: (d) => !d.roles || !Array.isArray(d.roles) || d.roles.length === 0,
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate profile completion from raw profile data.
 *
 * Skills rule: at least one skill present → complete; zero → miss.
 */
export function calculateProfileCompletion(
  data: ProfileDataForCompletion,
): ProfileCompletionResult {
  const fields: ProfileFieldStatus[] = PROFILE_FIELDS.map((def) => ({
    name: def.name,
    label: def.label,
    section: def.section,
    missing: def.isMissing(data),
  }));

  const missingFields = fields.filter((f) => f.missing);
  const completedCount = fields.length - missingFields.length;
  const percentage = Math.round((completedCount / fields.length) * 100);

  return {
    percentage,
    completedCount,
    totalCount: fields.length,
    fields,
    missingFields,
  };
}

/**
 * Convenience: check whether a single named field is missing.
 */
export function isProfileFieldMissing(
  fieldName: string,
  data: ProfileDataForCompletion,
): boolean {
  const def = PROFILE_FIELDS.find((f) => f.name === fieldName);
  if (!def) return false;
  return def.isMissing(data);
}

/** Total number of fields that count toward completion. */
export const PROFILE_FIELD_COUNT = PROFILE_FIELDS.length;

/** The list of field names (useful for DB queries). */
export const PROFILE_FIELD_NAMES = PROFILE_FIELDS.map((f) => f.name);
