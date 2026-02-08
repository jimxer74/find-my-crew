/**
 * Test user data for Playwright tests
 * Contains mock user data for consistent testing
 */

export const testUsers = {
  validUser: {
    email: 'test@example.com',
    password: 'TestPassword123!',
    name: 'Test User',
    skills: ['JavaScript', 'React', 'Node.js'],
    availability: 'full-time',
    location: 'San Francisco, CA'
  },

  newUser: {
    email: 'newuser@example.com',
    password: 'NewPassword123!',
    name: 'New User',
    skills: ['Python', 'Django', 'PostgreSQL'],
    availability: 'part-time',
    location: 'New York, NY'
  },

  invalidUser: {
    email: 'invalid-email',
    password: 'short',
    name: '',
    skills: [],
    availability: 'invalid',
    location: ''
  },

  existingUser: {
    email: 'existing@example.com',
    password: 'ExistingPassword123!',
    name: 'Existing User',
    skills: ['TypeScript', 'Next.js', 'Tailwind CSS'],
    availability: 'contract',
    location: 'Austin, TX'
  }
};

export const testCrews = {
  techCrew: {
    name: 'Tech Enthusiasts',
    description: 'A crew for technology enthusiasts and developers',
    location: 'Remote',
    skills: ['JavaScript', 'Python', 'React', 'Node.js'],
    availability: 'flexible'
  },

  designCrew: {
    name: 'Creative Designers',
    description: 'Design-focused crew for UI/UX designers and creatives',
    location: 'Los Angeles, CA',
    skills: ['Figma', 'Adobe XD', 'Sketch', 'CSS'],
    availability: 'full-time'
  },

  startupCrew: {
    name: 'Startup Founders',
    description: 'Crew for startup founders and entrepreneurs',
    location: 'San Francisco, CA',
    skills: ['Product Management', 'Marketing', 'Business Development'],
    availability: 'full-time'
  }
};

export const testMessages = {
  welcomeMessage: {
    content: 'Welcome to our crew! We\'re excited to have you here.',
    timestamp: new Date().toISOString()
  },

  projectUpdate: {
    content: 'Just completed the initial project setup. Ready to start development!',
    timestamp: new Date().toISOString()
  },

  question: {
    content: 'Does anyone have experience with TypeScript configuration?',
    timestamp: new Date().toISOString()
  }
};