/**
 * Profile Generation Prompt
 * Static constant for generating sailing profiles from Facebook data
 */

import { PromptUtils, USE_CASES, PROMPT_FORMATS } from '../index';

/**
 * Profile generation prompt constant
 * Migrated from: app/api/ai/generate-profile/route.ts (lines 7-57)
 */
export const profileGenerationPrompt = PromptUtils.createConstantPrompt(
  'profile-generation',
  USE_CASES.PROFILE_GENERATION,
  `Based on the following Facebook profile information, generate a comprehensive sailing profile:

{facebookData}

Please extract and organize the following information:

1. Personal Information:
   - Name
   - Location
   - Contact information (if available)

2. Professional Background:
   - Current occupation
   - Relevant skills and experience
   - Education

3. Sailing Experience:
   - Years of sailing experience
   - Types of boats sailed
   - Certifications or training
   - Notable sailing achievements

4. Interests and Hobbies:
   - Sailing-related interests
   - Other hobbies that might be relevant
   - Travel experiences

5. Personal Characteristics:
   - Personality traits that would be relevant for crew compatibility
   - Communication style
   - Teamwork preferences

Format your response as a JSON object with the structure above. If information is not available, use "Not specified" for that field.`,
  'Generate comprehensive sailing profiles from Facebook data',
  ['profile', 'facebook', 'sailing', 'compatibility', 'analysis']
);

/**
 * Enhanced profile generation prompt with additional insights
 */
export const profileGenerationEnhancedPrompt = PromptUtils.createTemplatePrompt(
  'profile-generation-enhanced',
  USE_CASES.PROFILE_GENERATION,
  `Analyze the following Facebook profile information and generate a comprehensive sailing profile with behavioral insights:

Facebook Profile Data:
{facebookData}

ANALYSIS REQUIREMENTS:

1. **Personal Information**:
   - Extract name, location, and contact details
   - Identify any sailing-related profile information

2. **Professional Background**:
   - Current occupation and relevant skills
   - Leadership experience and team management
   - Problem-solving abilities and technical skills

3. **Sailing Experience Assessment**:
   - Years of experience (explicit or inferred)
   - Types of boats and sailing conditions
   - Certifications, training, or formal education
   - Notable achievements or significant voyages

4. **Behavioral Analysis**:
   - Communication style based on posts and interactions
   - Risk tolerance and decision-making patterns
   - Adaptability and learning capabilities
   - Stress management and crisis response

5. **Compatibility Assessment**:
   - Teamwork style and collaboration preferences
   - Leadership vs. follower tendencies
   - Conflict resolution approach
   - Social compatibility factors

6. **Additional Insights**:
   - Hobbies and interests that complement sailing
   - Travel experience and adaptability
   - Physical fitness indicators
   - Emergency preparedness awareness

OUTPUT FORMAT:
Generate a comprehensive JSON response with the following structure:

{
  "personalInformation": {
    "name": "string",
    "location": "string",
    "contact": "string",
    "sailingRelatedInfo": "string"
  },
  "professionalBackground": {
    "occupation": "string",
    "relevantSkills": ["string"],
    "leadershipExperience": "string",
    "problemSolving": "string"
  },
  "sailingExperience": {
    "yearsExperience": "string",
    "boatTypes": ["string"],
    "certifications": ["string"],
    "achievements": ["string"],
    "experienceLevel": "beginner|intermediate|advanced|expert"
  },
  "behavioralAnalysis": {
    "communicationStyle": "string",
    "riskTolerance": "low|medium|high",
    "adaptability": "string",
    "stressManagement": "string",
    "decisionMaking": "string"
  },
  "compatibilityAssessment": {
    "teamworkStyle": "string",
    "leadershipTendency": "leader|follower|collaborator",
    "conflictResolution": "string",
    "socialCompatibility": "string",
    "crewCompatibilityScore": 1-10
  },
  "additionalInsights": {
    "complementaryInterests": ["string"],
    "travelExperience": "string",
    "fitnessIndicators": "string",
    "emergencyPreparedness": "string"
  },
  "summary": "string",
  "recommendations": ["string"]
}

CRITICAL INSTRUCTIONS:
- Be objective and data-driven in your analysis
- Note any gaps in information that would be important for sailing
- Provide specific examples from the Facebook data when possible
- Focus on traits relevant to safe and successful sailing experiences
- Include both strengths and potential concerns`,
  'Comprehensive sailing profile generation with behavioral analysis and compatibility assessment',
  ['profile', 'facebook', 'analysis', 'behavioral', 'compatibility']
);
    PromptUtils.createTestSuite(
      'Profile generation test',
      [
        PromptUtils.createTestCase(
          'Complete profile analysis',
          {
            facebookData: {
              name: 'John Doe',
              location: 'San Diego, CA',
              work: 'Marine Engineer at Ocean Tech',
              education: 'BS in Naval Architecture',
              posts: ['Just completed my ASA 101 certification!', 'Loving the sailing community in San Diego', 'Working on my boat maintenance skills']
            }
          },
          JSON.stringify({
            personalInformation: {
              name: 'John Doe',
              location: 'San Diego, CA',
              contact: 'Not specified',
              sailingRelatedInfo: 'Active in sailing community'
            },
            professionalBackground: {
              occupation: 'Marine Engineer at Ocean Tech',
              relevantSkills: ['Naval Architecture', 'Marine Engineering', 'Boat Maintenance'],
              leadershipExperience: 'Not specified',
              problemSolving: 'Engineering background indicates strong problem-solving skills'
            },
            sailingExperience: {
              yearsExperience: 'Beginner (recently certified)',
              boatTypes: ['Not specified'],
              certifications: ['ASA 101'],
              achievements: ['Recent certification achievement'],
              experienceLevel: 'beginner'
            },
            behavioralAnalysis: {
              communicationStyle: 'Enthusiastic and community-oriented',
              riskTolerance: 'medium',
              adaptability: 'High - actively learning new skills',
              stressManagement: 'Not specified',
              decisionMaking: 'Not specified'
            },
            compatibilityAssessment: {
              teamworkStyle: 'Collaborative and community-focused',
              leadershipTendency: 'collaborator',
              conflictResolution: 'Not specified',
              socialCompatibility: 'High - active community participation',
              crewCompatibilityScore: 8
            },
            additionalInsights: {
              complementaryInterests: ['Engineering', 'Boat maintenance'],
              travelExperience: 'Not specified',
              fitnessIndicators: 'Not specified',
              emergencyPreparedness: 'Not specified'
            },
            summary: 'John is a marine engineer with strong technical skills and recent sailing certification. He shows enthusiasm for learning and community involvement.',
            recommendations: ['Great candidate for crew position with technical skills', 'Would benefit from more sailing experience', 'Excellent attitude for learning and teamwork']
          })
        )
      ]
    );

/**
 * Function to create a profile generation prompt with specific Facebook data
 */
export function createProfileGenerationPrompt(facebookData: any): string {
  return `Based on the following Facebook profile information, generate a comprehensive sailing profile:

${JSON.stringify(facebookData, null, 2)}

Please extract and organize the following information:

1. Personal Information:
   - Name
   - Location
   - Contact information (if available)

2. Professional Background:
   - Current occupation
   - Relevant skills and experience
   - Education

3. Sailing Experience:
   - Years of sailing experience
   - Types of boats sailed
   - Certifications or training
   - Notable sailing achievements

4. Interests and Hobbies:
   - Sailing-related interests
   - Other hobbies that might be relevant
   - Travel experiences

5. Personal Characteristics:
   - Personality traits that would be relevant for crew compatibility
   - Communication style
   - Teamwork preferences

Format your response as a JSON object with the structure above. If information is not available, use "Not specified" for that field.`;
}

/**
 * Function to create an enhanced profile generation prompt with behavioral analysis
 */
export function createEnhancedProfileGenerationPrompt(facebookData: any): string {
  return `Analyze the following Facebook profile information and generate a comprehensive sailing profile with behavioral insights:

Facebook Profile Data:
${JSON.stringify(facebookData, null, 2)}

ANALYSIS REQUIREMENTS:

1. **Personal Information**:
   - Extract name, location, and contact details
   - Identify any sailing-related profile information

2. **Professional Background**:
   - Current occupation and relevant skills
   - Leadership experience and team management
   - Problem-solving abilities and technical skills

3. **Sailing Experience Assessment**:
   - Years of experience (explicit or inferred)
   - Types of boats and sailing conditions
   - Certifications, training, or formal education
   - Notable achievements or significant voyages

4. **Behavioral Analysis**:
   - Communication style based on posts and interactions
   - Risk tolerance and decision-making patterns
   - Adaptability and learning capabilities
   - Stress management and crisis response

5. **Compatibility Assessment**:
   - Teamwork style and collaboration preferences
   - Leadership vs. follower tendencies
   - Conflict resolution approach
   - Social compatibility factors

6. **Additional Insights**:
   - Hobbies and interests that complement sailing
   - Travel experience and adaptability
   - Physical fitness indicators
   - Emergency preparedness awareness

OUTPUT FORMAT:
Generate a comprehensive JSON response with the following structure:

{
  "personalInformation": {
    "name": "string",
    "location": "string",
    "contact": "string",
    "sailingRelatedInfo": "string"
  },
  "professionalBackground": {
    "occupation": "string",
    "relevantSkills": ["string"],
    "leadershipExperience": "string",
    "problemSolving": "string"
  },
  "sailingExperience": {
    "yearsExperience": "string",
    "boatTypes": ["string"],
    "certifications": ["string"],
    "achievements": ["string"],
    "experienceLevel": "beginner|intermediate|advanced|expert"
  },
  "behavioralAnalysis": {
    "communicationStyle": "string",
    "riskTolerance": "low|medium|high",
    "adaptability": "string",
    "stressManagement": "string",
    "decisionMaking": "string"
  },
  "compatibilityAssessment": {
    "teamworkStyle": "string",
    "leadershipTendency": "leader|follower|collaborator",
    "conflictResolution": "string",
    "socialCompatibility": "string",
    "crewCompatibilityScore": 1-10
  },
  "additionalInsights": {
    "complementaryInterests": ["string"],
    "travelExperience": "string",
    "fitnessIndicators": "string",
    "emergencyPreparedness": "string"
  },
  "summary": "string",
  "recommendations": ["string"]
}

CRITICAL INSTRUCTIONS:
- Be objective and data-driven in your analysis
- Note any gaps in information that would be important for sailing
- Provide specific examples from the Facebook data when possible
- Focus on traits relevant to safe and successful sailing experiences
- Include both strengths and potential concerns`;
}

/**
 * Test cases for profile generation prompt
 */
export const profileGenerationTests = [
  PromptUtils.createTestCase(
    'Complete professional profile',
    {
      facebookData: {
        name: 'Sarah Johnson',
        location: 'Seattle, WA',
        work: 'Professional Sailor and Yacht Captain',
        education: ['ASA Instructor Certification', 'USCG Captain License'],
        posts: ['Just captained my first charter season in the Caribbean', 'Teaching ASA 101/103 this weekend', 'Love helping new sailors gain confidence on the water']
      }
    },
    JSON.stringify({
      personalInformation: {
        name: 'Sarah Johnson',
        location: 'Seattle, WA',
        contact: 'Not specified',
        sailingRelatedInfo: 'Professional sailor and instructor'
      },
      professionalBackground: {
        occupation: 'Professional Sailor and Yacht Captain',
        relevantSkills: ['Sailing instruction', 'Yacht operation', 'Safety management'],
        leadershipExperience: 'Charter captain and instructor',
        problemSolving: 'Professional sailing experience'
      },
      sailingExperience: {
        yearsExperience: 'Extensive professional experience',
        boatTypes: ['Charter yachts', 'Sailing instruction boats'],
        certifications: ['ASA Instructor', 'USCG Captain License'],
        achievements: ['Professional charter season completion'],
        experienceLevel: 'expert'
      },
      behavioralAnalysis: {
        communicationStyle: 'Educational and encouraging',
        riskTolerance: 'medium',
        adaptability: 'High - international experience',
        stressManagement: 'Professional experience indicates good stress management',
        decisionMaking: 'Experienced decision-making in professional settings'
      },
      compatibilityAssessment: {
        teamworkStyle: 'Leadership and mentorship oriented',
        leadershipTendency: 'leader',
        conflictResolution: 'Professional approach',
        socialCompatibility: 'High - teaching and charter experience',
        crewCompatibilityScore: 10
      },
      additionalInsights: {
        complementaryInterests: ['Teaching', 'Yachting industry'],
        travelExperience: 'International charter experience',
        fitnessIndicators: 'Active professional sailing',
        emergencyPreparedness: 'Professional safety training'
      },
      summary: 'Sarah is a highly experienced professional sailor with extensive teaching and charter experience. She demonstrates strong leadership and safety awareness.',
      recommendations: ['Excellent candidate for skipper or instructor role', 'Strong safety and leadership credentials', 'Extensive professional experience beneficial for any crew']
    })
  ),
  PromptUtils.createTestCase(
    'Beginner with enthusiasm',
    {
      facebookData: {
        name: 'Mike Chen',
        location: 'Miami, FL',
        work: 'Software Developer',
        education: ['Computer Science Degree'],
        posts: ['Just started sailing lessons!', 'The ocean is so peaceful', 'Learning new skills is always exciting']
      }
    },
    JSON.stringify({
      personalInformation: {
        name: 'Mike Chen',
        location: 'Miami, FL',
        contact: 'Not specified',
        sailingRelatedInfo: 'Beginner sailor'
      },
      professionalBackground: {
        occupation: 'Software Developer',
        relevantSkills: ['Problem-solving', 'Technical aptitude', 'Learning ability'],
        leadershipExperience: 'Not specified',
        problemSolving: 'Strong analytical and problem-solving skills from software background'
      },
      sailingExperience: {
        yearsExperience: 'Beginner (just started lessons)',
        boatTypes: ['Not specified'],
        certifications: ['Not specified'],
        achievements: ['Recent start in sailing'],
        experienceLevel: 'beginner'
      },
      behavioralAnalysis: {
        communicationStyle: 'Enthusiastic and positive',
        riskTolerance: 'medium to high (trying new activities)',
        adaptability: 'High - actively learning new skills',
        stressManagement: 'Not specified',
        decisionMaking: 'Not specified'
      },
      compatibilityAssessment: {
        teamworkStyle: 'Eager learner and collaborative',
        leadershipTendency: 'collaborator',
        conflictResolution: 'Not specified',
        socialCompatibility: 'Positive attitude and learning mindset',
        crewCompatibilityScore: 7
      },
      additionalInsights: {
        complementaryInterests: ['Technology', 'Learning new skills'],
        travelExperience: 'Not specified',
        fitnessIndicators: 'Not specified',
        emergencyPreparedness: 'Not specified'
      },
      summary: 'Mike is a software developer with strong analytical skills who has recently started sailing. He shows enthusiasm for learning and positive attitude.',
      recommendations: ['Good candidate for crew position with learning mindset', 'Technical background provides analytical skills', 'Would benefit from more sailing experience']
    })
  )
];

/**
 * Comprehensive test suite for profile generation
 */
export const profileGenerationTestSuite = PromptUtils.createTestSuite(
  'Profile Generation Comprehensive Test',
  profileGenerationTests,
  0.8,
  3000,
  0.85
);

/**
 * Migration record for profile generation prompt
 */
export const profileGenerationMigration: any = {
  prompt: profileGenerationPrompt,
  fromLocation: 'app/api/ai/generate-profile/route.ts',
  toLocation: 'app/lib/ai/prompts/use-cases/profile-generation.ts',
  description: 'Migrated static prompt constant for Facebook data processing to centralized prompt registry',
  version: '1.0.0',
  date: new Date('2024-02-05'),
  notes: 'Preserved original prompt structure with template variable for Facebook data'
};