# PERSONAL IDENTIFICATION AND CONTACT INFORMATION AUDIT

**Date:** February 6, 2026
**Scope:** Complete codebase audit for AI system personal information collection
**Method:** Comprehensive search through all source files for personal data prompts and collection points

---

## EXECUTIVE SUMMARY

This document provides a comprehensive audit of all locations within the SailSmart codebase where personal identification and contact information is prompted to, collected by, and accessed by the AI system. The audit identified 15 distinct areas where personal data is handled, ranging from database storage to AI-generated user prompts.

**Key Findings:**
- AI system has broad access to complete user profiles via `getUserProfile()` tool
- Dynamic prompting system allows AI to request specific personal information updates
- Facebook OAuth integration provides additional personal data when consent is granted
- Comprehensive consent management system with audit logging
- Behavioral analysis from social media informs AI profile generation

---

## DETAILED FINDINGS

### 1. DATABASE SCHEMA STORING PERSONAL INFORMATION

**File:** `/specs/tables.sql`

**Primary tables storing personal identification and contact data:**

#### profiles table
- `full_name` (text) - User's full name
- `username` (text) - User's chosen username
- `email` (text) - Email address (synced from auth.users)
- `phone` (text) - Phone number
- `user_description` (text) - User bio/description
- `certifications` (text) - Professional certifications
- `sailing_preferences` (text) - Sailing-related preferences
- `skills` (text array) - User skills
- `profile_image_url` (text) - Profile picture URL

#### user_consents table
- Tracks consent for: `ai_processing_consent`, `profile_sharing_consent`, `marketing_consent`
- Includes audit logging with IP address and user agent

#### ai_pending_actions table
- `input_prompt` (text) - User-facing prompt asking for information
- `profile_field` (text) - Which profile field is being updated
- `suggested_value` (text) - AI suggestion for the field
- `field_type` (text) - Type of input required

---

### 2. USER REGISTRATION AND SIGNUP FLOWS

**File:** `/app/auth/signup/page.tsx`

**Personal information collected during signup:**
- email
- password
- full_name (passed to Supabase auth.signUp() options.data)

**File:** `/app/components/SignupModal.tsx`

**Signup prompts collect:**
- email
- password
- fullName

---

### 3. LOGIN AND AUTHENTICATION

**File:** `/app/auth/login/page.tsx`

**Login collects:**
- email
- password
- Facebook OAuth login with scopes: 'email,public_profile,user_posts,user_likes'

**File:** `/app/components/LoginModal.tsx`

**Prompts for:**
- email
- password

---

### 4. FACEBOOK OAUTH INTEGRATION AND DATA IMPORT

**File:** `/app/lib/facebook/graphApi.ts`

**Fetches and imports from Facebook:**
- `id` (Facebook user ID)
- `name` (full name)
- `first_name`
- `last_name`
- `email`
- `picture` (profile image)
- Posts and likes (for profile generation analysis)

**File:** `/app/lib/facebook/types.ts`

**Defines FacebookProfile interface with personal identification fields:**
- id, name, first_name, last_name, email, picture

---

### 5. PROFILE MANAGEMENT FORMS

**File:** `/app/components/profile/sections/PersonalInfoSection.tsx`

**CRITICAL FORM COMPONENT that renders input fields for:**
- `username` (placeholder: "johndoe")
- `full_name` (placeholder: "John Doe", marked required with *)
- `email` (read-only, synced from auth)
- `phone` (placeholder: "+1 234 567 8900")
- `user_description` (textarea, "About You" section)
- certifications
- sailing_preferences
- skills

**File:** `/app/components/profile/ProfileCreationWizard.tsx`

**Collects FormData with:**
- username
- full_name
- profile_image_url
- user_description
- certifications
- sailing_preferences
- skills
- risk_level
- roles

**Fetches Facebook data** when user grants ai_processing consent.

---

### 6. CONSENT MANAGEMENT

**File:** `/app/components/auth/ConsentSetupModal.tsx`

**Collects consent for:**
- privacy_policy_accepted_at
- terms_accepted_at
- ai_processing_consent (critical for Facebook data access)
- profile_sharing_consent
- marketing_consent

**Stores in user_consents table** with audit logging (ip_address, user_agent).

---

### 7. AI SYSTEM PROMPTS FOR PERSONAL INFORMATION

**File:** `/app/lib/ai/prompts/use-cases/profile-generation.ts`

**AI System Prompts that explicitly instruct the AI to extract and analyze personal information:**

#### Profile Generation Prompt extracts:
- Name
- Location
- Contact information (if available)
- Professional background
- Sailing experience
- Interests and hobbies
- Personal characteristics

#### Enhanced Profile Generation Prompt analyzes:
- Name, location, contact details
- Personal information from Facebook
- Behavioral traits from Facebook posts
- Communication style
- Risk tolerance and decision-making patterns

**The prompt explicitly instructs the AI to:**
```
1. **Personal Information**:
   - Extract name, location, and contact details
   - Identify any sailing-related profile information
```

---

### 8. AI ASSISTANT TOOL ACCESS TO PERSONAL DATA

**File:** `/app/lib/ai/assistant/toolExecutor.ts`

**The AI assistant has a `getUserProfile()` tool** that returns ALL personal profile data:

```typescript
// Returns from profiles table:
{
  username,
  full_name,
  email,
  phone,
  user_description,
  certifications,
  sailing_preferences,
  skills,
  roles,
  sailing_experience,
  risk_level,
  profile_image_url
}
```

**This tool is available to the AI during conversations** and allows the AI to access complete personal profile data.

---

### 9. AI-GENERATED PROMPTS FOR USER INPUT

**File:** `/app/lib/ai/assistant/toolExecutor.ts`

**Functions `getInputPrompt()`, `getInputType()`, and `getInputOptions()` define how the AI prompts users for personal information:**

#### User-Facing AI Prompts:

1. **update_profile_user_description**
   - Prompt: "What would you like your new user description to be?"
   - Input type: text
   - Minimum: 10 characters

2. **update_profile_certifications**
   - Prompt: "What certifications would you like to add or update?"
   - Input type: text
   - Minimum: 3 characters

3. **update_profile_sailing_preferences**
   - Prompt: "What sailing preferences would you like to update?"
   - Input type: text
   - Minimum: 5 characters

4. **update_profile_risk_level**
   - Prompt: "Which risk levels would you like to select?"
   - Input type: select
   - Options: ['Beginner', 'Intermediate', 'Advanced', 'Expert']

5. **update_profile_skills**
   - Prompt: "Which skills would you like to add or update?"
   - Input type: select
   - Options: Navigation, Sailing, Engine Maintenance, Electronics, Cooking, First Aid, Photography, Teaching

---

### 10. AI PENDING ACTIONS UI COMPONENT

**File:** `/app/components/ai/TextInputModal.tsx`

**Modal component that displays AI prompts to users and collects input:**
- Shows `action.input_prompt` field to user
- Collects textarea input for profile updates
- Validates based on field type:
  - user_description: minimum 10 characters
  - certifications: minimum 3 characters
  - sailing_preferences: minimum 5 characters

---

### 11. AI ACTION TYPE DEFINITIONS

**File:** `/app/lib/ai/assistant/types.ts`

**AIPendingAction interface includes fields for prompting users:**
- `input_prompt?: string` - User-facing prompt question
- `input_type?: 'text' | 'text_array' | 'select'` - Type of input needed
- `input_options?: string[]` - Available options for select inputs
- `profile_field?: string` - Which profile field is being updated
- `suggested_value?: string` - AI suggestion for the field

**Action types that prompt for personal information:**
- 'update_profile_user_description'
- 'update_profile_certifications'
- 'update_profile_risk_level'
- 'update_profile_sailing_preferences'
- 'update_profile_skills'

---

### 12. API ENDPOINTS HANDLING PERSONAL DATA

**File:** `/app/api/ai/generate-profile/route.ts`

- Takes Facebook data (includes first_name, last_name, email)
- Uses AI to suggest username, fullName, userDescription, certifications, sailingPreferences
- Calls AI with profile generation prompt (see section 7)

**File:** `/app/api/facebook/fetch-data/route.ts`

- Fetches Facebook profile data
- Used when user has granted ai_processing_consent

**File:** `/app/api/registrations/route.ts`

- Handles registration creation
- Stores user responses and answers
- Calls AI assessment (assessRegistrationWithAI)

**File:** `/app/api/registrations/[registrationId]/answers/route.ts`

- GET: Retrieves all answers for a registration
- POST: Stores registration answers
- Includes user_id references

---

### 13. USER CONTEXT PROVIDED TO AI

**File:** `/app/lib/ai/assistant/types.ts` - UserContext interface

**The AI receives comprehensive user profile context:**

```typescript
{
  userId: string;
  profile: {
    username: string;
    fullName: string | null;
    roles: string[];
    sailingExperience: number | null;
    userDescription: string | null;
    certifications: string | null;
    skills: string[];
    riskLevel: string[];
    sailingPreferences: string | null;
  };
  boats?: []; // With boat names and details
  recentRegistrations?: [];
}
```

**This context is passed to the AI for every conversation.**

---

### 14. DATA FLOW SUMMARY

```
User Registration
    ↓
Collects: email, password, full_name
    ↓
Stores in: auth.users & profiles table
    ↓
AI System Initialization
    ↓
AI Accesses: getUserProfile() tool
    ↓
AI Receives: Complete UserContext with all personal data
    ↓
AI Can: Create pending actions with input_prompt fields
    ↓
AI Prompts User: "What would you like your new user description to be?"
    ↓
User Submits: Response via TextInputModal
    ↓
Stores in: profiles table
    ↓
Cycle Repeats: AI can access and suggest updates to any profile field
```

---

### 15. CRITICAL FINDINGS

**Personal Information Accessible to AI:**

1. **Full name** (via userProfile tool and UserContext)
2. **Username** (via userProfile tool and UserContext)
3. **Email** (via userProfile tool and UserContext)
4. **Phone number** (via userProfile tool)
5. **User description/bio** (via userProfile tool)
6. **Certifications** (via userProfile tool)
7. **Sailing preferences** (via userProfile tool)
8. **Skills** (via userProfile tool)
9. **Facebook profile data:** name, first_name, last_name, email (via Facebook OAuth)
10. **Behavioral analysis** from Facebook posts (via AI prompts)

**AI Prompting Mechanism:**
- AI can suggest profile updates through AIPendingAction records
- AI generates input_prompt fields asking users for specific information
- Prompts are customizable and field-specific
- Users respond via TextInputModal component

**Consent Requirements:**
- ai_processing_consent required for Facebook data access
- profile_sharing_consent for sharing profiles
- Tracked in user_consents table with audit logging

---

## RECOMMENDATIONS

### Privacy and Security Considerations

1. **Review AI Access Controls**
   - Consider implementing more granular access controls for the `getUserProfile()` tool
   - Audit when and why AI needs access to complete profile data

2. **Consent Management**
   - Ensure clear, informed consent for Facebook data access
   - Consider separate consent for different types of personal data

3. **Data Minimization**
   - Review whether all collected personal data is necessary for system functionality
   - Consider anonymization options for AI training data

4. **User Awareness**
   - Clearly inform users when AI is accessing their personal data
   - Provide transparency about how personal information is used in AI prompts

5. **Input Validation**
   - Ensure robust validation for user responses to AI prompts
   - Consider character limits and content filtering

6. **Audit Logging**
   - Extend audit logging to track AI access to personal data
   - Log when AI creates pending actions requesting personal information

---

## CONTACT

For questions about this audit or concerns regarding personal data handling:
- Review the consent management system in `/app/components/auth/ConsentSetupModal.tsx`
- Check the AI prompting system in `/app/lib/ai/assistant/toolExecutor.ts`
- Examine the profile management components in `/app/components/profile/`

**Audit completed:** February 6, 2026
**Method:** Comprehensive codebase search and analysis
**Scope:** All files containing personal identification and contact information prompts