# How to Enable AI Auto-Approvals

This guide walks you through enabling the AI-powered automated approval system for crew registrations.

## Prerequisites

### 1. Environment Variables

Ensure you have at least one AI provider API key configured in your `.env.local` file:

```bash
# At least one of these is required:
DEEPSEEK_API_KEY=your_deepseek_api_key_here
GROQ_API_KEY=your_groq_api_key_here
GOOGLE_GEMINI_API_KEY=your_gemini_api_key_here
```

**Recommended for Development:**
- **DeepSeek** (free tier available): https://platform.deepseek.com/
- **Groq** (very fast, free tier): https://console.groq.com/
- **Gemini** (Google, free tier): https://aistudio.google.com/

**Note:** The system will automatically use whichever providers you have configured, falling back to the next available provider if one fails.

### 2. Database Migration

Ensure the automated approval schema migration has been run:

```bash
# Run this SQL migration if you haven't already:
# migrations/add_automated_approval_schema.sql
```

This creates:
- `journey_requirements` table
- `registration_answers` table
- Adds `auto_approval_enabled`, `auto_approval_threshold` to `journeys`
- Adds `ai_match_score`, `ai_match_reasoning`, `auto_approved` to `registrations`

## Step-by-Step Setup

### Step 1: Create Requirements for a Journey

1. Navigate to your Journey editing page (as an owner)
2. Scroll down to the **"Automated Approval Requirements"** section
3. Click **"Add Requirement"**
4. Fill in:
   - **Question Text**: e.g., "Do you have experience with night sailing?"
   - **Question Type**: Choose from:
     - `text` - Free-form text answer
     - `yes_no` - Yes/No answer
     - `multiple_choice` - Select from predefined options
     - `rating` - 1-10 rating scale
   - **Options** (if multiple_choice): Add each option, e.g., "Yes, extensive", "Some experience", "No"
   - **Required**: Check if this question must be answered
   - **Weight** (1-10): How important this question is for matching (10 = most important)
   - **Order**: Display order (lower numbers appear first)
5. Click **"Save"**
6. Repeat for all questions you want to ask crew members

### Step 2: Enable Auto-Approval

1. In the same Journey editing page, find the **"Automated Approval"** toggle
2. Turn it **ON**
3. Set the **Approval Threshold** (0-100%):
   - **80%** (default): Crew members scoring 80% or higher are auto-approved
   - **Lower (e.g., 60%)**: More lenient, more auto-approvals
   - **Higher (e.g., 90%)**: More strict, fewer auto-approvals
4. **Important**: You must have at least one requirement before enabling auto-approval
5. Save your journey

### Step 3: Test the Flow

1. **As a Crew Member:**
   - Browse legs and find one with auto-approval enabled
   - Click "Register Interest"
   - You'll see the requirements form first
   - Answer all required questions
   - Click "Continue Registration"
   - Add optional notes
   - Submit registration

2. **What Happens:**
   - Registration is created with status "Pending approval"
   - Answers are saved
   - AI assessment runs automatically (asynchronously)
   - If AI score ≥ threshold → Status changes to "Approved" with `auto_approved: true`
   - If AI score < threshold → Remains "Pending approval" for manual review

3. **View Results:**
   - **Crew Dashboard** (`/crew/registrations`):
     - See "Auto-approved by AI" badge if approved
     - See AI match score badge (color-coded)
     - Expand "AI Assessment Details" to see reasoning
   
   - **Owner Dashboard** (`/owner/registrations`):
     - See "Auto-approved by AI" badge
     - See AI match score
     - Expand "AI Assessment Details" to review AI reasoning
     - Can still manually approve/deny if needed

## How It Works

### AI Assessment Process

1. **Data Collection**: When a crew member registers with answers:
   - Crew profile (skills, experience, risk tolerance)
   - Journey/leg requirements (skills needed, experience level, risk level)
   - Custom Q&A answers

2. **AI Prompt**: A comprehensive prompt is built including:
   - Crew member profile summary
   - Journey requirements
   - All custom questions and answers with weights

3. **AI Response**: The AI returns:
   - `match_score` (0-100): Overall compatibility score
   - `reasoning`: Detailed explanation of the assessment
   - `recommendation`: "approve", "deny", or "review"

4. **Auto-Approval Decision**:
   - If `match_score ≥ threshold` AND `recommendation !== 'deny'`:
     - Status → "Approved"
     - `auto_approved` → `true`
   - Otherwise:
     - Status → "Pending approval"
     - Owner reviews manually

### Manual Override

Owners can always:
- Manually approve registrations (even if AI scored low)
- Manually deny registrations (even if AI scored high)
- Review AI reasoning to make informed decisions

## Troubleshooting

### AI Assessment Not Running

1. **Check API Keys**: Ensure at least one AI provider key is set in `.env.local`
2. **Check Logs**: Look for errors in server console:
   ```
   AI assessment failed (non-blocking): [error details]
   ```
3. **Check Journey Settings**: Ensure:
   - `auto_approval_enabled = true`
   - At least one requirement exists
   - Answers were provided during registration

### Low Match Scores

- **Adjust Threshold**: Lower the threshold in journey settings
- **Review Requirements**: Ensure questions are relevant and not too strict
- **Check Weights**: Lower weights for less critical questions
- **Review AI Reasoning**: Expand "AI Assessment Details" to understand why scores are low

### High False Positives/Negatives

- **Refine Questions**: Make questions more specific
- **Adjust Weights**: Increase weights for critical questions
- **Review Threshold**: Adjust threshold based on results
- **Manual Review**: Always review auto-approved registrations initially

## Best Practices

1. **Start Conservative**: Begin with a higher threshold (85-90%) and lower as needed
2. **Test Thoroughly**: Register as a crew member yourself to test the flow
3. **Review Initially**: Manually review all auto-approved registrations at first
4. **Iterate**: Adjust questions, weights, and thresholds based on results
5. **Monitor**: Check AI reasoning to understand assessment quality
6. **Combine with Manual Review**: Use AI as a tool, not a replacement for judgment

## API Endpoints

### Manual Assessment Trigger

If you need to manually trigger an AI assessment:

```bash
POST /api/ai/assess-registration/[registrationId]
Authorization: Bearer [owner_token]
```

This is useful for:
- Re-assessing after requirements change
- Testing the AI assessment
- Debugging issues

## Next Steps

1. ✅ Set up API keys
2. ✅ Create requirements for a test journey
3. ✅ Enable auto-approval
4. ✅ Test registration flow
5. ✅ Review AI assessments
6. ✅ Adjust threshold and questions as needed
7. ✅ Monitor and refine

## Support

If you encounter issues:
1. Check server logs for error messages
2. Verify API keys are correct
3. Ensure database migration ran successfully
4. Test with a simple requirement first
5. Check that answers are being saved correctly
