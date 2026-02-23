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
        preferred_departure_location: {
          type: 'object',
          description:
            'Preferred departure/sailing-from location. Provide name and lat/lng from your geography knowledge. If the conversation contains a Cruising Region with Bounding Box data, you MUST include isCruisingRegion and bbox to preserve the sailing area.',
          properties: {
            name: { type: 'string', description: 'Location name (e.g., "Caribbean", "Barcelona, Spain")' },
            lat: { type: 'number', description: 'Latitude' },
            lng: { type: 'number', description: 'Longitude' },
            isCruisingRegion: { type: 'boolean', description: 'True if this is a predefined cruising area' },
            bbox: {
              type: 'object',
              description: 'Bounding box for cruising regions. Include this ONLY when bbox data appears in the conversation.',
              properties: {
                minLng: { type: 'number', description: 'Western boundary (longitude)' },
                minLat: { type: 'number', description: 'Southern boundary (latitude)' },
                maxLng: { type: 'number', description: 'Eastern boundary (longitude)' },
                maxLat: { type: 'number', description: 'Northern boundary (latitude)' },
              },
              required: ['minLng', 'minLat', 'maxLng', 'maxLat'],
            },
          },
          required: ['name', 'lat', 'lng'],
        },
        preferred_arrival_location: {
          type: 'object',
          description:
            'Preferred arrival/sailing-to location. Same shape as preferred_departure_location. Provide name and lat/lng. Include bbox if cruising region data is in the conversation.',
          properties: {
            name: { type: 'string', description: 'Location name' },
            lat: { type: 'number', description: 'Latitude' },
            lng: { type: 'number', description: 'Longitude' },
            isCruisingRegion: { type: 'boolean', description: 'True if this is a predefined cruising area' },
            bbox: {
              type: 'object',
              description: 'Bounding box for cruising regions.',
              properties: {
                minLng: { type: 'number', description: 'Western boundary (longitude)' },
                minLat: { type: 'number', description: 'Southern boundary (latitude)' },
                maxLng: { type: 'number', description: 'Eastern boundary (longitude)' },
                maxLat: { type: 'number', description: 'Northern boundary (latitude)' },
              },
              required: ['minLng', 'minLat', 'maxLng', 'maxLat'],
            },
          },
          required: ['name', 'lat', 'lng'],
        },
        availability_start_date: {
          type: 'string',
          description: 'When the user is available from (ISO date YYYY-MM-DD)',
        },
        availability_end_date: {
          type: 'string',
          description: 'When the user is available until (ISO date YYYY-MM-DD)',
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
  {
    name: 'search_matching_crew',
    description:
      'Search for crew members that match specific requirements. Returns a list of qualified crew members with their profiles and match scores. Use this tool early in conversations with skippers to show them the value of the platform. Available to all users (unauthenticated users see anonymized results).',
    access: 'public',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        experienceLevel: {
          type: 'number',
          description:
            'Minimum experience level required: 1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper',
        },
        riskLevels: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'],
          },
          description:
            'Acceptable risk/comfort levels for the crew. Coastal sailing = protected waters, Offshore sailing = bluewater passages, Extreme sailing = polar expeditions',
        },
        location: {
          type: 'object',
          description: 'Location and search radius for crew availability',
          properties: {
            name: { type: 'string', description: 'Human-readable location name' },
            lat: { type: 'number', description: 'Latitude' },
            lng: { type: 'number', description: 'Longitude' },
            radius: {
              type: 'number',
              description: 'Search radius in kilometers (default 500)',
            },
          },
          required: ['lat', 'lng'],
        },
        dateRange: {
          type: 'object',
          description: 'Date range for crew availability',
          properties: {
            start: { type: 'string', description: 'Start date (ISO format YYYY-MM-DD)' },
            end: { type: 'string', description: 'End date (ISO format YYYY-MM-DD)' },
          },
        },
        skills: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Required or preferred skills. Valid skill names: safety_and_mob, heavy_weather, night_sailing, watch_keeping, navigation, sailing_experience, certifications, physical_fitness, seasickness_management, first_aid, technical_skills, cooking, survival_skills',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of matches to return (default 10, max 50)',
        },
      },
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

  // ============================================================
  // OWNER ONBOARDING TOOLS - For owner onboarding flow
  // ============================================================
  {
    name: 'fetch_boat_details_from_sailboatdata',
    description:
      'Fetch detailed boat specifications from sailboatdata.com using screenscraping. Use this when user mentions a boat make/model to automatically fill in boat details. Returns comprehensive boat specs including dimensions, performance metrics, and descriptions.',
    access: 'owner',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        make_model: {
          type: 'string',
          description: 'Boat make AND model as a single combined string (e.g., "Bavaria 46", "Hallberg-Rassy 38", "Vindö 40"). Do NOT split into separate make/model fields.',
        },
        slug: {
          type: 'string',
          description: 'Optional: URL slug from search results for more reliable lookup',
        },
      },
      required: ['make_model'],
    },
  },
  {
    name: 'generate_journey_route',
    description:
      'Generate a sailing journey route with legs and waypoints using AI. For any journey that has a start and end location (e.g. Jamaica to San Blas), use this tool with startLocation, endLocation, boatId; it creates the journey and legs in one go. Use this when user describes a route (start location, end location, waypoints, dates). You must supply approximate lat/lng for each location from your geography knowledge—never ask the user for coordinates. IMPORTANT: If the user mentioned dates anywhere in the conversation (e.g., "May 1-30" or "01/05/2026 to 30/05/2026"), convert them to ISO format (YYYY-MM-DD) and pass as startDate and endDate parameters. Returns structured journey data with legs and an AI-assessed journey risk level (Coastal sailing, Offshore sailing, or Extreme sailing) which is used when creating the journey. Can handle speed-based planning if boat speed is provided.',
    access: 'owner',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        startLocation: {
          type: 'object',
          description: 'Start location: name and lat/lng. If the user provided coordinates (e.g. "Start location: X (lat 18, lng -76)"), use those; otherwise supply from your geography knowledge. Do NOT ask the user for coordinates.',
          properties: {
            name: { type: 'string' },
            lat: { type: 'number', description: 'Approximate latitude (you supply from geography knowledge)' },
            lng: { type: 'number', description: 'Approximate longitude (you supply from geography knowledge)' },
          },
          required: ['name', 'lat', 'lng'],
        },
        endLocation: {
          type: 'object',
          description: 'End location: name and lat/lng. If the user provided coordinates (e.g. "End location: X (lat 44, lng -63)"), use those; otherwise supply from your geography knowledge. Do NOT ask the user for coordinates.',
          properties: {
            name: { type: 'string' },
            lat: { type: 'number', description: 'Approximate latitude (you supply from geography knowledge)' },
            lng: { type: 'number', description: 'Approximate longitude (you supply from geography knowledge)' },
          },
          required: ['name', 'lat', 'lng'],
        },
        intermediateWaypoints: {
          type: 'array',
          description: 'Optional intermediate waypoints. If the user provided coordinates (e.g. "Waypoints: X (lat 23, lng -76), Y (lat 39, lng -76)"), use those; otherwise supply from your knowledge. Do not ask the user for coordinates.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              lat: { type: 'number' },
              lng: { type: 'number' },
            },
            required: ['name', 'lat', 'lng'],
          },
        },
        boatId: {
          type: 'string',
          description: 'Required for speed-based planning',
        },
        startDate: {
          type: 'string',
          description: 'Journey start date in ISO format (YYYY-MM-DD). IMPORTANT: If the user mentioned a start date anywhere in the conversation (e.g., "May 1st", "01/05/2026"), convert it to ISO format and include it here.',
        },
        endDate: {
          type: 'string',
          description: 'Journey end date in ISO format (YYYY-MM-DD). IMPORTANT: If the user mentioned an end date anywhere in the conversation (e.g., "May 30th", "30/05/2026"), convert it to ISO format and include it here.',
        },
        useSpeedPlanning: {
          type: 'boolean',
          description: 'Whether to calculate leg dates based on boat speed',
        },
        boatSpeed: {
          type: 'number',
          description: 'Boat average cruising speed in knots (for speed-based planning)',
        },
        waypointDensity: {
          type: 'string',
          enum: ['minimal', 'moderate', 'detailed'],
          description: 'Control waypoint density: "minimal" for high-level planning (2 waypoints/leg - crew exchange points only), "moderate" for balanced (max 4/leg), "detailed" for comprehensive routing (max 8/leg). Defaults to "moderate".',
        },
        risk_level: {
          type: 'array',
          description: 'Optional journey risk level(s). MUST be an array of strings, e.g. ["Offshore sailing"]. Never pass a single string or JSON string.',
          items: {
            type: 'string',
            enum: ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'],
          },
        },
        skills: {
          type: 'array',
          description: 'Required crew skills for the journey. Extract from [CREW REQUIREMENTS] stored context or user messages. Valid skill names: safety_and_mob, heavy_weather, night_sailing, watch_keeping, navigation, sailing_experience, certifications, physical_fitness, seasickness_management, first_aid, technical_skills, cooking, survival_skills',
          items: {
            type: 'string',
            enum: ['safety_and_mob', 'heavy_weather', 'night_sailing', 'watch_keeping', 'navigation', 'sailing_experience', 'certifications', 'physical_fitness', 'seasickness_management', 'first_aid', 'technical_skills', 'cooking', 'survival_skills'],
          },
        },
        min_experience_level: {
          type: 'number',
          description: 'Minimum crew experience level. Extract from [CREW REQUIREMENTS] stored context or user messages. 1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper',
          minimum: 1,
          maximum: 4,
        },
        cost_model: {
          type: 'string',
          description: 'Cost sharing model for the journey. Extract from [CREW REQUIREMENTS] stored context or user messages.',
          enum: ['Shared contribution', 'Owner covers all costs', 'Crew pays a fee', 'Delivery/paid crew', 'Not defined'],
        },
        cost_info: {
          type: 'string',
          description: 'Free text about cost details for crew (e.g. shared food, fuel split, crew fee). Extract from [CREW REQUIREMENTS] stored context or user messages.',
        },
      },
      required: ['startLocation', 'endLocation', 'boatId'],
    },
  },
  {
    name: 'get_owner_boats',
    description: "Get all boats owned by the current user. Use this to check if user already has boats or to list boats for journey creation.",
    access: 'owner',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of boats to return (default 50)',
        },
      },
    },
  },
  {
    name: 'get_owner_journeys',
    description: "Get all journeys owned by the current user. Use this to check if user already has journeys or to list journeys.",
    access: 'owner',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of journeys to return (default 50)',
        },
      },
    },
  },
  {
    name: 'get_boat_completion_status',
    description: "Check if boat information is complete. Returns which fields are filled and which are missing. Use this to guide users through boat creation.",
    access: 'owner',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        boatId: {
          type: 'string',
          description: 'Optional: Check specific boat. If not provided, checks if user has any boats.',
        },
      },
    },
  },
  {
    name: 'get_journey_completion_status',
    description: "Check if journey information is complete. Returns which fields are filled and which are missing. Use this to guide users through journey creation.",
    access: 'owner',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        journeyId: {
          type: 'string',
          description: 'Optional: Check specific journey. If not provided, checks if user has any journeys.',
        },
      },
    },
  },
  {
    name: 'create_boat',
    description:
      'Create a new boat for the owner. Use this after gathering boat information from the user and confirming with them. IMPORTANT: Before calling this, use fetch_boat_details_from_sailboatdata to get detailed specs if user provided make/model.',
    access: 'owner',
    category: 'action',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Boat name',
        },
        type: {
          type: 'string',
          description: 'Sailboat category',
          enum: ['Daysailers', 'Coastal cruisers', 'Traditional offshore cruisers', 'Performance cruisers', 'Multihulls', 'Expedition sailboats'],
        },
        make_model: {
          type: 'string',
          description: 'Boat make and model (e.g., "Bavaria 46")',
        },
        capacity: {
          type: 'number',
          description: 'Number of people the boat can accommodate',
        },
        home_port: {
          type: 'string',
          description: 'Home port location',
        },
        country_flag: {
          type: 'string',
          description: 'ISO 3166-1 alpha-2 country code (e.g., US, GB, FR)',
        },
        loa_m: {
          type: 'number',
          description: 'Length overall in meters',
        },
        beam_m: {
          type: 'number',
          description: 'Beam width in meters',
        },
        max_draft_m: {
          type: 'number',
          description: 'Maximum draft in meters',
        },
        displcmt_m: {
          type: 'number',
          description: 'Displacement in kg',
        },
        average_speed_knots: {
          type: 'number',
          description: 'Average cruising speed in knots',
        },
        link_to_specs: {
          type: 'string',
          description: 'URL to boat specifications (e.g., sailboatdata.com)',
        },
        characteristics: {
          type: 'string',
          description: 'Boat characteristics description (hull design, construction, rigging, keel type)',
        },
        capabilities: {
          type: 'string',
          description: 'Boat capabilities description (sailing conditions, range, single-handed capability)',
        },
        accommodations: {
          type: 'string',
          description: 'Interior layout description (berths, galley, head, storage)',
        },
        sa_displ_ratio: {
          type: 'number',
          description: 'Sail area to displacement ratio',
        },
        ballast_displ_ratio: {
          type: 'number',
          description: 'Ballast to displacement ratio',
        },
        displ_len_ratio: {
          type: 'number',
          description: 'Displacement to length ratio',
        },
        comfort_ratio: {
          type: 'number',
          description: 'Comfort ratio',
        },
        capsize_screening: {
          type: 'number',
          description: 'Capsize screening formula value',
        },
        hull_speed_knots: {
          type: 'number',
          description: 'Hull speed in knots',
        },
        ppi_pounds_per_inch: {
          type: 'number',
          description: 'Pounds per inch immersion',
        },
      },
      required: ['name', 'type', 'make_model', 'capacity'],
    },
  },
  {
    name: 'create_journey',
    description:
      'Create a new journey for an owner\'s boat. Requires boat_id. Only for creating a journey without route/legs. For start-to-end routes, use generate_journey_route instead. IMPORTANT: Before calling this, use generate_journey_route to plan the journey with legs and waypoints if user provided route information.',
    access: 'owner',
    category: 'action',
    parameters: {
      type: 'object',
      properties: {
        boat_id: {
          type: 'string',
          description: 'UUID of the boat for this journey',
        },
        name: {
          type: 'string',
          description: 'Journey name',
        },
        start_date: {
          type: 'string',
          description: 'Journey start date (ISO format YYYY-MM-DD)',
        },
        end_date: {
          type: 'string',
          description: 'Journey end date (ISO format YYYY-MM-DD)',
        },
        description: {
          type: 'string',
          description: 'Journey description',
        },
        risk_level: {
          type: 'array',
          description: 'Array of risk levels',
          items: {
            type: 'string',
            enum: ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'],
          },
        },
        skills: {
          type: 'array',
          description: 'Required skills for this journey (array of skill names)',
          items: {
            type: 'string',
          },
        },
        min_experience_level: {
          type: 'number',
          description: 'Minimum required experience level: 1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper',
          minimum: 1,
          maximum: 4,
        },
        cost_model: {
          type: 'string',
          description: 'Cost sharing model for the journey',
          enum: ['Shared contribution', 'Owner covers all costs', 'Crew pays a fee', 'Delivery/paid crew', 'Not defined'],
        },
        cost_info: {
          type: 'string',
          description: 'Free text for owners to inform crew about costs (e.g. shared food, fuel split). No strict format.',
        },
      },
      required: ['boat_id', 'name'],
    },
  },
  {
    name: 'create_leg',
    description:
      'Create a leg within a journey. Use this after creating a journey to add individual legs with waypoints. Can be called multiple times to create multiple legs for a journey.',
    access: 'owner',
    category: 'action',
    parameters: {
      type: 'object',
      properties: {
        journey_id: {
          type: 'string',
          description: 'UUID of the journey this leg belongs to',
        },
        name: {
          type: 'string',
          description: 'Leg name',
        },
        start_date: {
          type: 'string',
          description: 'Leg start date (ISO format YYYY-MM-DD)',
        },
        end_date: {
          type: 'string',
          description: 'Leg end date (ISO format YYYY-MM-DD)',
        },
        crew_needed: {
          type: 'number',
          description: 'Number of crew members needed for this leg',
        },
        waypoints: {
          type: 'array',
          description: 'Array of waypoints for this leg',
          items: {
            type: 'object',
            properties: {
              index: {
                type: 'number',
                description: 'Waypoint index (0-based, sequential)',
              },
              name: {
                type: 'string',
                description: 'Waypoint name (port/town/city)',
              },
              geocode: {
                type: 'object',
                description: 'Waypoint coordinates',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['Point'],
                  },
                  coordinates: {
                    type: 'array',
                    description: '[longitude, latitude]',
                    items: {
                      type: 'number',
                    },
                    minItems: 2,
                    maxItems: 2,
                  },
                },
                required: ['type', 'coordinates'],
              },
            },
            required: ['index', 'name', 'geocode'],
          },
        },
      },
      required: ['journey_id', 'name', 'waypoints'],
    },
  },
];
