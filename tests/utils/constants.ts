/**
 * Test constants and configuration for SailSmart Playwright tests
 */

export const TEST_CONFIG = {
  baseURL: process.env.BASE_URL || 'http://localhost:3000',
  timeout: 30000,
  slowMo: process.env.CI ? 0 : 0, // Add delay in non-CI environments for debugging
  viewport: {
    desktop: { width: 1280, height: 720 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 375, height: 812 }
  }
};

export const SELECTORS = {
  // Common selectors
  loading: '[data-testid="loading-spinner"]',
  error: '[data-testid="error-message"]',
  toast: '[data-testid="toast"]',
  modal: '[data-testid="modal"]',
  button: 'button',
  input: 'input',
  form: 'form',

  // Navigation
  nav: 'nav',
  navLinks: {
    home: '[data-testid="nav-home"]',
    browse: '[data-testid="nav-browse"]',
    myCrews: '[data-testid="nav-mycrews"]',
    profile: '[data-testid="nav-profile"]',
    messages: '[data-testid="nav-messages"]'
  },

  // Authentication
  auth: {
    login: '[data-testid="auth-login"]',
    signup: '[data-testid="auth-signup"]',
    email: '[data-testid="auth-email"]',
    password: '[data-testid="auth-password"]',
    submit: '[data-testid="auth-submit"]',
    logout: '[data-testid="auth-logout"]'
  },

  // Home page
  home: {
    hero: {
      title: '[data-testid="hero-title"]',
      subtitle: '[data-testid="hero-subtitle"]',
      browse: '[data-testid="hero-browse"]',
      join: '[data-testid="hero-join"]'
    },
    features: '[data-testid="features"]',
    cta: '[data-testid="cta-section"]'
  },

  // Browse page
  browse: {
    search: '[data-testid="browse-search"]',
    filters: '[data-testid="browse-filters"]',
    results: '[data-testid="browse-results"]',
    crewCard: '[data-testid="crew-card"]',
    createCrew: '[data-testid="browse-create-crew"]'
  },

  // Crew page
  crew: {
    name: '[data-testid="crew-name"]',
    description: '[data-testid="crew-description"]',
    members: '[data-testid="crew-members"]',
    skills: '[data-testid="crew-skills"]',
    location: '[data-testid="crew-location"]',
    join: '[data-testid="crew-join"]',
    leave: '[data-testid="crew-leave"]',
    edit: '[data-testid="crew-edit"]',
    delete: '[data-testid="crew-delete"]'
  },

  // Profile page
  profile: {
    avatar: '[data-testid="profile-avatar"]',
    name: '[data-testid="profile-name"]',
    email: '[data-testid="profile-email"]',
    skills: '[data-testid="profile-skills"]',
    availability: '[data-testid="profile-availability"]',
    location: '[data-testid="profile-location"]',
    edit: '[data-testid="profile-edit"]',
    save: '[data-testid="profile-save"]'
  },

  // Messages
  messages: {
    list: '[data-testid="messages-list"]',
    input: '[data-testid="messages-input"]',
    send: '[data-testid="messages-send"]',
    message: '[data-testid="message"]'
  }
};

export const TEST_DATA = {
  validUser: {
    email: 'test@example.com',
    password: 'TestPassword123!',
    name: 'Test User'
  },
  invalidUser: {
    email: 'invalid-email',
    password: 'short'
  }
};

export const WAIT_TIMES = {
  short: 1000,
  medium: 3000,
  long: 5000,
  veryLong: 10000
};

export const SCREENSHOT_OPTIONS = {
  fullPage: true,
  animations: 'disabled'
};