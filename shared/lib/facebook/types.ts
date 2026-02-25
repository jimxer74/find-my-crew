/**
 * Facebook Graph API Response Types
 */

// Basic profile information from /me endpoint
export interface FacebookProfile {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  picture?: {
    data: {
      url: string;
      width?: number;
      height?: number;
      is_silhouette?: boolean;
    };
  };
}

// Post from /me/posts endpoint
export interface FacebookPost {
  id: string;
  message?: string;
  story?: string;
  created_time: string;
  full_picture?: string;
  type?: string;
  permalink_url?: string;
}

// Page like from /me/likes endpoint
export interface FacebookLike {
  id: string;
  name: string;
  category?: string;
  created_time?: string;
}

// Paginated response wrapper
export interface FacebookPaginatedResponse<T> {
  data: T[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
    previous?: string;
  };
}

// Aggregated user data from all Facebook endpoints
export interface FacebookUserData {
  profile: FacebookProfile | null;
  posts: FacebookPost[];
  likes: FacebookLike[];
  profilePictureUrl: string | null;
  errors: string[]; // Track any permission errors
}

// Profile suggestion generated from Facebook data
export interface ProfileSuggestion {
  username: string;
  usernameAlternatives: string[];
  fullName: string;
  profileImageUrl: string | null;
  sailingExperience: number | null; // 1-4 scale
  userDescription: string | null; // Free-text description of the user
  certifications: string | null;
  sailingPreferences: string | null;
  
  skills: { skill: 
    'safety_and_mob' | 
    'heavy_weather'|
    'night_sailing'|
    'watch_keeping'|
    'navigation'|
    'sailing_experience'|
    'certifications'|
    'physical_fitness'|
    'technical_skills'|
    '|first_aid'|
    'seasickness_management'; description: string }[];

  riskLevel: string[];
  confidence: {
    sailingExperience: 'high' | 'medium' | 'low' | 'none';
    overall: 'high' | 'medium' | 'low' | 'none';
  };
  reasoning: string; // AI's explanation of how suggestions were derived
}
