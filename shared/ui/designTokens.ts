/**
 * Design System Tokens
 *
 * Centralized definition of design system constants including colors, typography,
 * spacing, and z-index values. This ensures consistency across the entire application
 * and makes it easier to maintain and update the design system.
 *
 * Reference: TASK-118 Design System Audit findings
 */

/**
 * Color Palette & Status Mappings
 * Extracted from audit findings: ~12 hardcoded color patterns
 */
export const COLOR_TOKENS = {
  // Feedback/Issue Type Colors
  feedback: {
    bug: {
      light: 'bg-red-100 text-red-800',
      dark: 'dark:bg-red-900/30 dark:text-red-400',
      badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    },
    feature: {
      light: 'bg-purple-100 text-purple-800',
      dark: 'dark:bg-purple-900/30 dark:text-purple-400',
      badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    },
    improvement: {
      light: 'bg-blue-100 text-blue-800',
      dark: 'dark:bg-blue-900/30 dark:text-blue-400',
      badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    },
    other: {
      light: 'bg-gray-100 text-gray-800',
      dark: 'dark:bg-gray-900/30 dark:text-gray-400',
      badge: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    },
  },

  // Risk Level Colors (Sailing Experience)
  riskLevel: {
    coastal: {
      name: 'Coastal sailing',
      badge: 'bg-green-100 text-green-800 border-green-300',
      tailwind: 'bg-green-100',
    },
    offshore: {
      name: 'Offshore sailing',
      badge: 'bg-blue-100 text-blue-800 border-blue-300',
      tailwind: 'bg-blue-100',
    },
    extreme: {
      name: 'Extreme sailing',
      badge: 'bg-red-100 text-red-800 border-red-300',
      tailwind: 'bg-red-100',
    },
  },

  // Match Score Colors (Skill Matching)
  matchScore: {
    excellent: {
      threshold: 80,
      badge: 'bg-green-300/80 border-green-500 text-green-800',
      label: 'Excellent Match',
    },
    good: {
      threshold: 50,
      badge: 'bg-yellow-300/80 border-yellow-600 text-yellow-800',
      label: 'Good Match',
    },
    moderate: {
      threshold: 25,
      badge: 'bg-orange-300/80 border-orange-600 text-orange-800',
      label: 'Moderate Match',
    },
    poor: {
      threshold: 0,
      badge: 'bg-red-500/80 border-red-600 text-red-800',
      label: 'Poor Match',
    },
  },

  // Cost Model Colors
  costModel: {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    orange: 'bg-orange-100 text-orange-800',
    purple: 'bg-purple-100 text-purple-800',
    gray: 'bg-gray-100 text-gray-800',
  },

  // Registration Status Colors
  registrationStatus: {
    pending: 'bg-yellow-500',
    approved: 'bg-green-500',
    notApproved: 'bg-red-500',
    cancelled: 'bg-gray-500',
  },

  // Utility Neutrals (used frequently)
  neutral: {
    lightGray: 'bg-gray-100',
    mediumGray: 'bg-gray-200',
    darkGray: 'text-gray-500',
    border: 'border-gray-200',
  },
};

/**
 * Z-Index Scale
 * Centralized z-index management to prevent stacking conflicts.
 * Uses semantic naming for clarity on intended layering purpose.
 *
 * Audit findings: Previous scale used 40, 50, 90, 100, 101, 110, 120, 9998, 9999 - inconsistent
 * New scale: Semantic hierarchy with clear separation
 */
export const Z_INDEX = {
  // Base layers
  base: 0,

  // Dropdown menus, popovers, tooltips
  dropdown: 10,

  // Sticky elements (headers, navigation)
  sticky: 20,

  // Bottom sheets, popups
  popover: 30,

  // Standard dialogs and modals
  modal: 1000,

  // Modal backdrop (behind modal)
  modalBackdrop: 999,

  // Main navigation header
  header: 100,

  // Side panels, sidebars (notifications, filters, assistant)
  sidebar: 110,
  sidebarBackdrop: 105,

  // Toast notifications, alerts
  toast: 120,

  // Top-level overlays (fullscreen dialogs, date pickers inside modals)
  overlay: 121,
  overlayBackdrop: 120,

  // Max layer for extreme cases (reserved for emergency overrides)
  max: 9999,
};

/**
 * Typography Scale
 * Defined font sizes and their responsive behaviors.
 * Based on audit findings: Already using consistent Tailwind scale,
 * documented here for reference and consistency.
 */
export const TYPOGRAPHY = {
  // Headings
  h1: 'text-2xl md:text-3xl font-bold',
  h2: 'text-xl md:text-2xl font-bold',
  h3: 'text-lg md:text-xl font-semibold',
  h4: 'text-base md:text-lg font-semibold',

  // Body text
  body: 'text-base',
  bodySm: 'text-sm',
  bodyXs: 'text-xs',

  // Special sizes
  caption: 'text-xs',
  small: 'text-sm',
  large: 'text-lg',

  // Modifiers
  bold: 'font-bold',
  semibold: 'font-semibold',
  medium: 'font-medium',
  normal: 'font-normal',
};

/**
 * Spacing Scale
 * Based on Tailwind's 4px base unit. Used for padding, margins, and gaps.
 * Audit findings: 85% consistent usage - document standard patterns here.
 */
export const SPACING = {
  // Base unit (4px)
  xs: 'p-1',      // 4px
  sm: 'p-2',      // 8px
  md: 'p-3',      // 12px
  lg: 'p-4',      // 16px
  xl: 'p-6',      // 24px

  // Padding variants (horizontal, vertical)
  px: {
    sm: 'px-2',   // 8px sides
    md: 'px-4',   // 16px sides
    lg: 'px-6',   // 24px sides
  },
  py: {
    sm: 'py-2',   // 8px top/bottom
    md: 'py-3',   // 12px top/bottom
    lg: 'py-4',   // 16px top/bottom
  },

  // Gap (for flexbox/grid)
  gap: {
    xs: 'gap-1',  // 4px
    sm: 'gap-2',  // 8px
    md: 'gap-3',  // 12px
    lg: 'gap-4',  // 16px
    xl: 'gap-6',  // 24px
  },

  // Margin variants
  m: {
    xs: 'm-1',
    sm: 'm-2',
    md: 'm-3',
    lg: 'm-4',
  },
  mt: {
    sm: 'mt-1',
    md: 'mt-2',
    lg: 'mt-4',
  },
  mb: {
    sm: 'mb-2',
    md: 'mb-3',
    lg: 'mb-4',
  },

  // Section spacing (vertical rhythm)
  sectionGap: 'gap-4',        // 16px between sections
  subsectionGap: 'gap-2',     // 8px between subsections
  itemGap: 'gap-1',           // 4px between items

  // Touch target minimum (44px recommended)
  touchTarget: 'min-h-[44px] min-w-[44px]',
};

/**
 * Component Size Constants
 */
export const COMPONENT_SIZES = {
  // Button sizes (height)
  button: {
    sm: 'h-8 px-2',
    md: 'h-9 px-3',
    lg: 'h-10 px-4',
    touchTarget: 'min-h-[44px] min-w-[44px]',
  },

  // Input sizes
  input: {
    default: 'h-9 px-3',
    touchTarget: 'min-h-[44px] px-3',
  },

  // Badge sizes
  badge: {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  },

  // Avatar sizes
  avatar: {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  },
};

/**
 * Breakpoints
 * Standard Tailwind breakpoints for responsive design
 */
export const BREAKPOINTS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

/**
 * Accessibility Constants
 */
export const ACCESSIBILITY = {
  // Color contrast ratios (WCAG standards)
  contrastRatios: {
    wcagAANormalText: 4.5,    // 4.5:1 for normal text
    wcagAALargeText: 3,       // 3:1 for large text (18pt+)
    wcagAAANormalText: 7,     // 7:1 for AAA level
    wcagAAALargeText: 4.5,    // 4.5:1 for AAA large text
  },

  // Focus visible utilities
  focusRing: 'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary',

  // Touch target minimum size
  minTouchTarget: 44, // pixels
};

/**
 * Utility Functions
 */

/**
 * Get color badge classes for feedback type
 */
export function getFeedbackColorClasses(type: 'bug' | 'feature' | 'improvement' | 'other') {
  return COLOR_TOKENS.feedback[type];
}

/**
 * Get color badge classes for risk level
 */
export function getRiskLevelColorClasses(riskLevel: string) {
  const normalized = riskLevel.toLowerCase();
  if (normalized.includes('coastal')) return COLOR_TOKENS.riskLevel.coastal;
  if (normalized.includes('offshore')) return COLOR_TOKENS.riskLevel.offshore;
  if (normalized.includes('extreme')) return COLOR_TOKENS.riskLevel.extreme;
  return COLOR_TOKENS.riskLevel.coastal; // default
}

/**
 * Get match score color and label based on percentage
 */
export function getMatchScoreColor(percentage: number) {
  if (percentage >= COLOR_TOKENS.matchScore.excellent.threshold) {
    return COLOR_TOKENS.matchScore.excellent;
  }
  if (percentage >= COLOR_TOKENS.matchScore.good.threshold) {
    return COLOR_TOKENS.matchScore.good;
  }
  if (percentage >= COLOR_TOKENS.matchScore.moderate.threshold) {
    return COLOR_TOKENS.matchScore.moderate;
  }
  return COLOR_TOKENS.matchScore.poor;
}

/**
 * Get registration status color
 */
export function getRegistrationStatusColor(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'approved') return COLOR_TOKENS.registrationStatus.approved;
  if (normalized === 'notapproved' || normalized === 'not_approved') return COLOR_TOKENS.registrationStatus.notApproved;
  if (normalized === 'cancelled') return COLOR_TOKENS.registrationStatus.cancelled;
  return COLOR_TOKENS.registrationStatus.pending; // default
}

export default {
  COLOR_TOKENS,
  Z_INDEX,
  TYPOGRAPHY,
  SPACING,
  COMPONENT_SIZES,
  BREAKPOINTS,
  ACCESSIBILITY,
};
