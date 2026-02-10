/**
 * Unified Tool Definitions
 *
 * Single source of truth for all AI assistant tools.
 * Each tool has an access level that determines who can use it.
 */

import { ToolDefinition } from './types';

/**
 * All tool definitions with access control
 */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // ============================================================
  // PUBLIC TOOLS - Available to unauthenticated prospect users
  // ============================================================
  {
    name: 'search_legs',
    description:
      'Search for sailing opportunities or sailing legs or passages. Use this for general searches without specific location requirements. For location-based searches (e.g., "from Barcelona", "to Caribbean"), use search_legs_by_location instead. Supports filtering by journey, dates, skills, boat type, and boat make/model.',
    access: 'public',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        journeyId: {
          type: 'string',
          description: 'Filter legs by journey ID',
        },
        startDate: {
          type: 'string',
          description: 'Filter legs starting after this date (ISO format)',
        },
        endDate: {
          type: 'string',
          description: 'Filter legs ending before this date (ISO format)',
        },
        skillsRequired: {
          type: 'string',
          description: 'Comma-separated list of required skills to filter by',
        },
        crewNeeded: {
          type: 'boolean',
          description: 'Only show legs that still need crew (default true)',
        },
        boatType: {
          type: 'string',
          description: 'Filter by boat type/category',
          enum: [
            'Daysailers',
            'Coastal cruisers',
            'Traditional offshore cruisers',
            'Performance cruisers',
            'Multihulls',
            'Expedition sailboats',
          ],
        },
        makeModel: {
          type: 'string',
          description:
            'Filter by boat make and model (e.g., "Bavaria 46", "Beneteau Oceanis", "Hallberg-Rassy") - case-insensitive partial matching',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 10)',
        },
      },
    },
  },
  {
    name: 'search_legs_by_location',
    description:
      'Search for sailing legs by geographic location using bounding box coordinates. Use this when user mentions specific places, regions, or areas for departure or arrival. YOU must determine the appropriate bounding box coordinates for the location. Supports filtering by date range, risk level, boat type, and boat make/model. IMPORTANT: Use nested departureBbox/arrivalBbox objects with numeric coordinates.',
    access: 'public',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        departureBbox: {
          type: 'object',
          description:
            'Bounding box for departure/start area. Provide coordinates that encompass the region the user is referring to. Add reasonable margins (~50-100km for cities, larger for regions).',
          properties: {
            minLng: { type: 'number', description: 'Western boundary (longitude)' },
            minLat: { type: 'number', description: 'Southern boundary (latitude)' },
            maxLng: { type: 'number', description: 'Eastern boundary (longitude)' },
            maxLat: { type: 'number', description: 'Northern boundary (latitude)' },
          },
          required: ['minLng', 'minLat', 'maxLng', 'maxLat'],
        },
        departureDescription: {
          type: 'string',
          description:
            'Human-readable description of the departure area being searched (e.g., "Barcelona and surrounding area", "Southern coast of Spain from Málaga to Almería")',
        },
        arrivalBbox: {
          type: 'object',
          description:
            'Bounding box for arrival/destination area. Provide coordinates that encompass the region the user is referring to.',
          properties: {
            minLng: { type: 'number', description: 'Western boundary (longitude)' },
            minLat: { type: 'number', description: 'Southern boundary (latitude)' },
            maxLng: { type: 'number', description: 'Eastern boundary (longitude)' },
            maxLat: { type: 'number', description: 'Northern boundary (latitude)' },
          },
          required: ['minLng', 'minLat', 'maxLng', 'maxLat'],
        },
        arrivalDescription: {
          type: 'string',
          description:
            'Human-readable description of the arrival area being searched (e.g., "Canary Islands", "Western Caribbean including Jamaica and Cayman Islands")',
        },
        startDate: {
          type: 'string',
          description: 'Filter legs starting after this date (ISO format YYYY-MM-DD)',
        },
        endDate: {
          type: 'string',
          description: 'Filter legs ending before this date (ISO format YYYY-MM-DD)',
        },
        skillsRequired: {
          type: 'string',
          description: 'Comma-separated list of required skills to filter by',
        },
        riskLevels: {
          type: 'string',
          description: 'Comma-separated risk levels to filter by (Coastal sailing, Offshore sailing, Extreme sailing)',
        },
        minExperienceLevel: {
          type: 'number',
          description:
            'User experience level for matching: 1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper. Only returns legs where user qualifies.',
        },
        crewNeeded: {
          type: 'boolean',
          description: 'Only show legs that still need crew (default true)',
        },
        boatType: {
          type: 'string',
          description: 'Filter by boat type/category',
          enum: [
            'Daysailers',
            'Coastal cruisers',
            'Traditional offshore cruisers',
            'Performance cruisers',
            'Multihulls',
            'Expedition sailboats',
          ],
        },
        makeModel: {
          type: 'string',
          description:
            'Filter by boat make and model (e.g., "Bavaria 46", "Beneteau Oceanis", "Hallberg-Rassy") - case-insensitive partial matching',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 10)',
        },
      },
    },
  },
  {
    name: 'search_journeys',
    description:
      'Search for published sailing journeys or voyages. Use this when user wants to find long sailing journeys that span multiple legs, typically taking several weeks or months to complete. Supports filtering by date range, risk level, boat type, and boat make/model.',
    access: 'public',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        startDate: {
          type: 'string',
          description: 'Filter journeys starting after this date (ISO format YYYY-MM-DD)',
        },
        endDate: {
          type: 'string',
          description: 'Filter journeys ending before this date (ISO format YYYY-MM-DD)',
        },
        riskLevel: {
          type: 'string',
          description: 'Filter by risk level',
          enum: ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'],
        },
        boatType: {
          type: 'string',
          description: 'Filter by boat type/category',
          enum: [
            'Daysailers',
            'Coastal cruisers',
            'Traditional offshore cruisers',
            'Performance cruisers',
            'Multihulls',
            'Expedition sailboats',
          ],
        },
        makeModel: {
          type: 'string',
          description:
            'Filter by boat make and model (e.g., "Bavaria 46", "Beneteau Oceanis", "Hallberg-Rassy") - case-insensitive partial matching',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 10)',
        },
      },
    },
  },
  {
    name: 'get_leg_details',
    description:
      'Get detailed information about a specific leg including waypoints, requirements, and current registrations.',
    access: 'public',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        legId: {
          type: 'string',
          description: 'The ID of the leg to get details for',
        },
      },
      required: ['legId'],
    },
  },
  {
    name: 'get_journey_details',
    description: 'Get detailed information about a journey including all its legs and the boat.',
    access: 'public',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        journeyId: {
          type: 'string',
          description: 'The ID of the journey to get details for',
        },
      },
      required: ['journeyId'],
    },
  },
  {
    name: 'get_boat_details',
    description: 'Get detailed information about a specific boat.',
    access: 'public',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        boatId: {
          type: 'string',
          description: 'The ID of the boat to get details for',
        },
      },
      required: ['boatId'],
    },
  },

  // ============================================================
  // AUTHENTICATED TOOLS - Available to any authenticated user
  // ============================================================
  {
    name: 'get_user_profile',
    description: "Get the current user's profile information including skills, experience, and preferences.",
    access: 'authenticated',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_experience_level_definitions',
    description:
      'Get definitions and descriptions for sailing experience levels (1-4). Use this to explain what each level means when helping users set their experience level.',
    access: 'public',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_risk_level_definitions',
    description:
      'Get definitions and descriptions for sailing risk levels (Coastal, Offshore, Extreme). Use this to explain what each risk level means when helping users set their comfort zone.',
    access: 'public',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_skills_definitions',
    description:
      'Get the list of available sailing skills that users can add to their profile. Use this when helping users identify and select their skills.',
    access: 'public',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'update_user_profile',
    description:
      "Update fields in the current user's profile. Only available for authenticated users. Use this during profile completion to save gathered preferences. Only update fields the user has confirmed.",
    access: 'authenticated',
    category: 'action',
    parameters: {
      type: 'object',
      properties: {
        full_name: {
          type: 'string',
          description: "User's full name",
        },
        user_description: {
          type: 'string',
          description: "User's bio or description of their sailing background and goals",
        },
        sailing_experience: {
          type: 'number',
          description: 'Experience level: 1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper',
          minimum: 1,
          maximum: 4,
        },
        risk_level: {
          type: 'array',
          description: 'Array of risk levels the user is comfortable with',
          items: {
            type: 'string',
            enum: ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'],
          },
        },
        skills: {
          type: 'array',
          description: 'Array of sailing skills the user has',
          items: {
            type: 'string',
          },
        },
        sailing_preferences: {
          type: 'string',
          description: "User's sailing preferences and goals (free text)",
        },
        certifications: {
          type: 'string',
          description: "User's sailing certifications (free text)",
        },
        phone: {
          type: 'string',
          description: "User's phone number (if known from signup/OAuth)",
        },
        profile_image_url: {
          type: 'string',
          description: "User's profile image URL (if known from OAuth provider)",
        },
      },
    },
  },
  {
    name: 'get_profile_completion_status',
    description:
      "Get the current user's profile completion status including which fields are filled and which are missing. Use this to guide users through completing their profile.",
    access: 'authenticated',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_user_registrations',
    description: "Get the current user's registration history for sailing legs.",
    access: 'authenticated',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by registration status',
          enum: ['Pending approval', 'Approved', 'Not approved', 'Cancelled'],
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 10)',
        },
      },
    },
  },
  {
    name: 'analyze_leg_match',
    description:
      "Analyze how well the current user's profile matches a specific leg's requirements. Returns match percentage and explanation.",
    access: 'authenticated',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        legId: {
          type: 'string',
          description: 'The ID of the leg to analyze match for',
        },
      },
      required: ['legId'],
    },
  },
  {
    name: 'fetch_all_boats',
    description:
      'Fetch boats available to the current user. For owners: returns their own boats. For crew: returns all boats with published journeys. Includes comprehensive boat information including performance metrics and images.',
    access: 'authenticated',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of boats to return (default 50)',
        },
        includePerformance: {
          type: 'boolean',
          description: 'Include detailed performance metrics and calculations',
        },
        boatType: {
          type: 'string',
          description: 'Filter by boat type/category',
          enum: [
            'Daysailers',
            'Coastal cruisers',
            'Traditional offshore cruisers',
            'Performance cruisers',
            'Multihulls',
            'Expedition sailboats',
          ],
        },
        homePort: {
          type: 'string',
          description: 'Filter by home port location',
        },
        makeModel: {
          type: 'string',
          description:
            'Filter by boat make and model (e.g., "Bavaria 46", "Beneteau Oceanis", "Hallberg-Rassy") - case-insensitive partial matching',
        },
        includeImages: {
          type: 'boolean',
          description: 'Include boat image URLs',
        },
      },
    },
  },
  {
    name: 'get_leg_registration_info',
    description:
      'Get registration requirements and auto-approval settings for a leg. Call this BEFORE suggesting registration. Response includes requirements[] (each with id, question_text, question_type) and requirementIds (array of UUIDs). When calling submit_leg_registration later, you MUST use those exact requirementIds (or each requirement.id) as requirement_id in each answer—never use invented IDs like "req_sailing_skills_001". If hasRequirements is true, ask the user each question and then call submit_leg_registration with answers using the exact UUIDs from this response.',
    access: 'authenticated',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        legId: {
          type: 'string',
          description: 'The ID of the leg to check registration info for',
        },
      },
      required: ['legId'],
    },
  },

  // ============================================================
  // CREW-ONLY TOOLS - Available only to users with crew role
  // ============================================================
  {
    name: 'suggest_register_for_leg',
    description:
      'Suggest that the user register for a specific sailing leg. Creates a pending action that the user must approve. IMPORTANT: Before calling this, use get_leg_registration_info to check if the leg has registration requirements. If hasRequirements is true, do NOT use this tool - instead direct the user to complete registration via the leg details page in the UI. Only use this tool for legs WITHOUT requirements. Both legId and reason parameters are REQUIRED.',
    access: 'crew',
    category: 'action',
    disabled: false,
    parameters: {
      type: 'object',
      properties: {
        legId: {
          type: 'string',
          description: 'REQUIRED: The UUID of the leg to register for',
        },
        reason: {
          type: 'string',
          description:
            'REQUIRED: A detailed explanation of why this leg is a good match for the user (e.g., experience match, location preference, timing)',
        },
      },
      required: ['legId', 'reason'],
    },
  },
  {
    name: 'suggest_profile_update_user_description',
    description:
      "Suggest updating the user description field in the user's profile. Creates a pending action that the user must approve. AI should identify that user description could be improved but must NOT create content - only suggest the field and ask user for the new description.",
    access: 'crew',
    category: 'action',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'REQUIRED: Explanation of why the user description should be updated and how it will benefit the user',
        },
        suggestedField: {
          type: 'string',
          description: 'REQUIRED: Must be "user_description". This field is fixed for this tool.',
          enum: ['user_description'],
        },
      },
      required: ['reason', 'suggestedField'],
    },
  },
  {
    name: 'suggest_profile_update_certifications',
    description:
      "Suggest updating the certifications field in the user's profile. Creates a pending action that the user must approve. AI should identify that certifications could be improved but must NOT create content - only suggest the field and ask user for the new description.",
    access: 'crew',
    category: 'action',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description:
            'REQUIRED: Explanation of why the certifications field should be updated and how it will benefit the user',
        },
        suggestedField: {
          type: 'string',
          description: 'REQUIRED: Must be "certifications". This field is fixed for this tool.',
          enum: ['certifications'],
        },
      },
      required: ['reason', 'suggestedField'],
    },
  },
  {
    name: 'suggest_profile_update_risk_level',
    description:
      "Suggest updating the risk level field in the user's profile. Creates a pending action that the user must approve. AI should identify that risk level could be improved but must NOT create content - only suggest the field and ask user for the new description.",
    access: 'crew',
    category: 'action',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description:
            'REQUIRED: Explanation of why the risk level field should be updated and how it will benefit the user',
        },
        suggestedField: {
          type: 'string',
          description: 'REQUIRED: Must be "risk_level". This field is fixed for this tool.',
          enum: ['risk_level'],
        },
      },
      required: ['reason', 'suggestedField'],
    },
  },
  {
    name: 'suggest_profile_update_sailing_preferences',
    description:
      "Suggest updating the sailing preferences field in the user's profile. Creates a pending action that the user must approve. AI should identify that sailing preferences could be improved but must NOT create content - only suggest the field and ask user for the new description.",
    access: 'crew',
    category: 'action',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description:
            'REQUIRED: Explanation of why the sailing preferences field should be updated and how it will benefit the user',
        },
        suggestedField: {
          type: 'string',
          description: 'REQUIRED: Must be "sailing_preferences". This field is fixed for this tool.',
          enum: ['sailing_preferences'],
        },
      },
      required: ['reason', 'suggestedField'],
    },
  },
  {
    name: 'suggest_skills_refinement',
    description:
      "Suggest iterative refinement for specific skills in the user's profile. Creates a pending action that the user must approve. AI should identify specific skills that could be improved and suggest asking the user for better descriptions.",
    access: 'crew',
    category: 'action',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description:
            'REQUIRED: Explanation of why these specific skills should be refined and how it will benefit the user',
        },
        suggestedField: {
          type: 'string',
          description: 'REQUIRED: Must be "skills". This field is fixed for this tool.',
          enum: ['skills'],
        },
        targetSkills: {
          type: 'array',
          description: 'REQUIRED: Array of specific skill names that should be refined',
          items: {
            type: 'string',
            description: 'Name of a specific skill to refine',
          },
        },
      },
      required: ['reason', 'suggestedField', 'targetSkills'],
    },
  },
  {
    name: 'submit_leg_registration',
    description:
      'Submit a registration for a sailing leg after collecting all required answers. You MUST call this tool when submitting—do not only tell the user "registration submitted" in text without calling this tool, or no database record is created. Use ONLY after you have collected answers for ALL registration questions from get_leg_registration_info. Calling this creates a pending action; the user then clicks Register to finalize.',
    access: 'crew',
    category: 'action',
    parameters: {
      type: 'object',
      properties: {
        legId: {
          type: 'string',
          description: 'REQUIRED: The UUID of the leg to register for',
        },
        answers: {
          type: 'array',
          description: 'REQUIRED: Array of answers to registration questions. Each answer must include requirement_id (the exact UUID from get_leg_registration_info) and either answer_text or answer_json based on question type. Never use placeholders like "requirement_id_placeholder".',
          items: {
            type: 'object',
            properties: {
              requirement_id: {
                type: 'string',
                description: 'REQUIRED: The exact UUID from get_leg_registration_info response—use requirementIds[i] or requirements[i].id. Must be a real UUID (e.g. "a1b2c3d4-e5f6-4789-a012-3456789abcde"). Never use invented values like "req_sailing_skills_001" or "requirement_id_placeholder".',
              },
              answer_text: {
                type: 'string',
                description: 'Text answer for text or yes_no question types',
              },
              answer_json: {
                type: 'object',
                description: 'JSON answer for multiple_choice or rating question types',
              },
            },
            required: ['requirement_id'],
          },
        },
        notes: {
          type: 'string',
          description: 'Optional additional notes from the user about why they want to join this leg',
        },
      },
      required: ['legId', 'answers'],
    },
  },

  // ============================================================
  // OWNER-ONLY TOOLS - Available only to users with owner role
  // ============================================================
  {
    name: 'get_owner_boats',
    description: 'Get all boats owned by the current user. Only available for users with owner role.',
    access: 'owner',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_owner_journeys',
    description: 'Get all journeys for boats owned by the current user. Only available for users with owner role.',
    access: 'owner',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        boatId: {
          type: 'string',
          description: 'Filter journeys by boat ID',
        },
        state: {
          type: 'string',
          description: 'Filter by journey state',
          enum: ['In planning', 'Published', 'Archived'],
        },
      },
    },
  },
  {
    name: 'get_leg_registrations',
    description: 'Get all registrations for a specific leg. Only available for the journey owner.',
    access: 'owner',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        legId: {
          type: 'string',
          description: 'The ID of the leg to get registrations for',
        },
      },
      required: ['legId'],
    },
  },
  {
    name: 'analyze_crew_match',
    description:
      'Analyze how well a crew member matches the requirements for a leg. Only available for journey owners.',
    access: 'owner',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        registrationId: {
          type: 'string',
          description: 'The ID of the registration to analyze',
        },
      },
      required: ['registrationId'],
    },
  },
  {
    name: 'suggest_approve_registration',
    description:
      'Suggest approving a crew registration. Only available for journey owners. Creates a pending action.',
    access: 'owner',
    category: 'action',
    parameters: {
      type: 'object',
      properties: {
        registrationId: {
          type: 'string',
          description: 'REQUIRED: The UUID of the registration to approve',
        },
        reason: {
          type: 'string',
          description:
            'REQUIRED: Detailed explanation of why this crew member should be approved (e.g., skills match, experience level)',
        },
      },
      required: ['registrationId', 'reason'],
    },
  },
  {
    name: 'suggest_reject_registration',
    description:
      'Suggest rejecting a crew registration. Only available for journey owners. Creates a pending action.',
    access: 'owner',
    category: 'action',
    parameters: {
      type: 'object',
      properties: {
        registrationId: {
          type: 'string',
          description: 'REQUIRED: The UUID of the registration to reject',
        },
        reason: {
          type: 'string',
          description:
            'REQUIRED: Explanation of why this crew member should be rejected (be constructive and professional)',
        },
      },
      required: ['registrationId', 'reason'],
    },
  },
];
