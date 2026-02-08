/**
 * Common selectors for SailSmart application
 * Centralized selector definitions to maintain consistency across tests
 */

export const selectors = {
  // Navigation
  header: 'header',
  navLinks: {
    home: 'nav a[href="/"]',
    browseCrews: 'nav a[href="/browse"]',
    myCrews: 'nav a[href="/mycrews"]',
    profile: 'nav a[href="/profile"]',
    messages: 'nav a[href="/messages"]',
  },

  // Authentication
  auth: {
    loginButton: '[data-testid="login-button"]',
    logoutButton: '[data-testid="logout-button"]',
    emailInput: '[data-testid="email-input"]',
    passwordInput: '[data-testid="password-input"]',
    submitButton: '[data-testid="submit-button"]',
    signupButton: '[data-testid="signup-button"]',
  },

  // Home page
  home: {
    heroTitle: '[data-testid="hero-title"]',
    heroSubtitle: '[data-testid="hero-subtitle"]',
    browseButton: '[data-testid="browse-button"]',
    joinButton: '[data-testid="join-button"]',
    features: {
      search: '[data-testid="feature-search"]',
      match: '[data-testid="feature-match"]',
      communicate: '[data-testid="feature-communicate"]',
      join: '[data-testid="feature-join"]',
    },
  },

  // Browse page
  browse: {
    searchInput: '[data-testid="search-input"]',
    locationFilter: '[data-testid="location-filter"]',
    skillsFilter: '[data-testid="skills-filter"]',
    availabilityFilter: '[data-testid="availability-filter"]',
    crewCard: '[data-testid="crew-card"]',
    crewCardTitle: '[data-testid="crew-card-title"]',
    crewCardDescription: '[data-testid="crew-card-description"]',
    joinCrewButton: '[data-testid="join-crew-button"]',
    createCrewButton: '[data-testid="create-crew-button"]',
  },

  // Crew management
  crew: {
    nameInput: '[data-testid="crew-name-input"]',
    descriptionInput: '[data-testid="crew-description-input"]',
    locationInput: '[data-testid="crew-location-input"]',
    skillsInput: '[data-testid="crew-skills-input"]',
    availabilityInput: '[data-testid="crew-availability-input"]',
    createButton: '[data-testid="create-crew-submit"]',
    editButton: '[data-testid="edit-crew-button"]',
    deleteButton: '[data-testid="delete-crew-button"]',
    memberList: '[data-testid="member-list"]',
    inviteButton: '[data-testid="invite-member-button"]',
  },

  // Profile page
  profile: {
    avatar: '[data-testid="user-avatar"]',
    name: '[data-testid="user-name"]',
    email: '[data-testid="user-email"]',
    skills: '[data-testid="user-skills"]',
    availability: '[data-testid="user-availability"]',
    editProfileButton: '[data-testid="edit-profile-button"]',
    saveProfileButton: '[data-testid="save-profile-button"]',
  },

  // Messages
  messages: {
    conversationList: '[data-testid="conversation-list"]',
    messageInput: '[data-testid="message-input"]',
    sendMessageButton: '[data-testid="send-message-button"]',
    messageBubble: '[data-testid="message-bubble"]',
  },

  // UI Components
  ui: {
    loadingSpinner: '[data-testid="loading-spinner"]',
    toast: '[data-testid="toast"]',
    modal: '[data-testid="modal"]',
    modalClose: '[data-testid="modal-close"]',
    button: 'button',
    input: 'input',
    select: 'select',
  },

  // Error states
  errors: {
    genericError: '[data-testid="error-message"]',
    validationError: '[data-testid="validation-error"]',
    networkError: '[data-testid="network-error"]',
  },
};