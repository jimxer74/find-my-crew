/**
 * AI Assistant Action Executor
 *
 * Executes approved pending actions.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { AIPendingAction, ActionType } from './types';

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[Action Executor] ${message}`, data !== undefined ? data : '');
  }
};

interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
}

interface ActionContext {
  supabase: SupabaseClient;
  userId: string;
}

/**
 * Execute an approved action
 */
export async function executeAction(
  action: AIPendingAction,
  context: ActionContext
): Promise<ActionResult> {
  log('--- executeAction started ---', { actionId: action.id, actionType: action.action_type });
  const { supabase, userId } = context;

  // Verify the action belongs to this user
  if (action.user_id !== userId) {
    log('Authorization failed: action belongs to different user');
    return {
      success: false,
      message: 'Not authorized to execute this action',
      error: 'UNAUTHORIZED',
    };
  }

  // Verify action is pending
  if (action.status !== 'pending') {
    log(`Invalid status: action is ${action.status}`);
    return {
      success: false,
      message: `Action is already ${action.status}`,
      error: 'INVALID_STATUS',
    };
  }

  try {
    let result: ActionResult;
    log(`Executing action type: ${action.action_type}`);

    switch (action.action_type) {
      case 'register_for_leg':
        result = await executeRegisterForLeg(action, context);
        break;

      case 'update_profile_user_description':
        result = await executeUpdateProfileUserDescription(action, context);
        break;

      case 'suggest_profile_update_user_description':
        result = await executeSuggestProfileUpdateUserDescription(action, context);
        break;

      case 'update_profile_certifications':
        result = await executeUpdateProfileCertifications(action, context);
        break;

      case 'update_profile_risk_level':
        result = await executeUpdateProfileRiskLevel(action, context);
        break;

      case 'update_profile_sailing_preferences':
        result = await executeUpdateProfileSailingPreferences(action, context);
        break;

      case 'update_profile_skills':
        result = await executeUpdateProfileSkills(action, context);
        break;

      case 'refine_skills':
        result = await executeRefineSkills(action, context);
        break;

      case 'approve_registration':
        result = await executeApproveRegistration(action, context);
        break;

      case 'reject_registration':
        result = await executeRejectRegistration(action, context);
        break;

      default:
        result = {
          success: false,
          message: `Unknown action type: ${action.action_type}`,
          error: 'UNKNOWN_ACTION',
        };
    }

    // Update action status
    if (result.success) {
      log('Action succeeded, updating status to approved');
      await supabase
        .from('ai_pending_actions')
        .update({
          status: 'approved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', action.id);
    } else {
      log('Action failed:', result.error);
    }

    log('--- executeAction completed ---', { success: result.success });
    return result;
  } catch (error: any) {
    log('Action execution error:', error.message);
    return {
      success: false,
      message: error.message || 'Action execution failed',
      error: 'EXECUTION_ERROR',
    };
  }
}

/**
 * Reject a pending action
 */
export async function rejectAction(
  actionId: string,
  context: ActionContext
): Promise<ActionResult> {
  log('--- rejectAction started ---', { actionId });
  const { supabase, userId } = context;

  const { data: action, error: fetchError } = await supabase
    .from('ai_pending_actions')
    .select('*')
    .eq('id', actionId)
    .single();

  if (fetchError || !action) {
    return {
      success: false,
      message: 'Action not found',
      error: 'NOT_FOUND',
    };
  }

  if (action.user_id !== userId) {
    return {
      success: false,
      message: 'Not authorized to reject this action',
      error: 'UNAUTHORIZED',
    };
  }

  if (action.status !== 'pending') {
    return {
      success: false,
      message: `Action is already ${action.status}`,
      error: 'INVALID_STATUS',
    };
  }

  const { error: updateError } = await supabase
    .from('ai_pending_actions')
    .update({
      status: 'rejected',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', actionId);

  if (updateError) {
    log('Failed to update action status:', updateError);
    return {
      success: false,
      message: 'Failed to reject action',
      error: 'UPDATE_ERROR',
    };
  }

  log('Action rejected successfully');
  return {
    success: true,
    message: 'Action rejected',
  };
}

/**
 * Cleanup expired actions (redirected actions older than 7 days)
 */
export async function cleanupExpiredActions(supabase: SupabaseClient, userId: string) {
  try {
    // Mark redirected actions older than 7 days as expired
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { error } = await supabase
      .from('ai_pending_actions')
      .update({
        status: 'expired',
        resolved_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('status', 'redirected')
      .lt('created_at', sevenDaysAgo.toISOString());

    if (error) {
      log('Error cleaning up expired actions:', error);
    }
  } catch (error) {
    log('Error in cleanupExpiredActions:', error);
  }
}

// ============================================================================
// Action Implementations
// ============================================================================

async function executeRegisterForLeg(
  action: AIPendingAction,
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, userId } = context;
  const { legId } = action.action_payload as { legId: string };

  // Check if journey has requirements - if so, reject and guide to UI
  const { data: legForRequirements } = await supabase
    .from('legs')
    .select('journey_id')
    .eq('id', legId)
    .single();

  if (legForRequirements) {
    const { count: requirementCount } = await supabase
      .from('journey_requirements')
      .select('*', { count: 'exact', head: true })
      .eq('journey_id', legForRequirements.journey_id);

    if (requirementCount && requirementCount > 0) {
      return {
        success: false,
        message: 'This leg requires answering registration questions. Please complete registration through the leg details page where you can fill out the required form.',
        error: 'REQUIRES_FORM_REGISTRATION',
      };
    }
  }

  // Check if already registered
  const { data: existing } = await supabase
    .from('registrations')
    .select('id')
    .eq('leg_id', legId)
    .eq('user_id', userId)
    .single();

  if (existing) {
    return {
      success: false,
      message: 'You are already registered for this leg',
      error: 'ALREADY_REGISTERED',
    };
  }

  // Get leg details to verify it exists and is open
  const { data: leg } = await supabase
    .from('legs')
    .select(`
      id,
      name,
      crew_needed,
      journeys!inner (
        state
      )
    `)
    .eq('id', legId)
    .single();

  if (!leg) {
    return {
      success: false,
      message: 'Leg not found',
      error: 'NOT_FOUND',
    };
  }

  if ((leg as any).journeys.state !== 'Published') {
    return {
      success: false,
      message: 'This journey is not currently accepting registrations',
      error: 'NOT_PUBLISHED',
    };
  }

  // Create registration
  const { data: registration, error } = await supabase
    .from('registrations')
    .insert({
      leg_id: legId,
      user_id: userId,
      status: 'Pending approval',
    })
    .select()
    .single();

  if (error) {
    return {
      success: false,
      message: 'Failed to create registration',
      error: error.message,
    };
  }

  return {
    success: true,
    message: `Successfully registered for ${leg.name}. Your registration is pending approval.`,
    data: registration,
  };
}

async function executeUpdateProfile(
  action: AIPendingAction,
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, userId } = context;
  const { updates } = action.action_payload as { updates: Record<string, unknown> };

  // Whitelist of allowed fields to update (excluding restricted fields)
  const allowedFields = [
    'user_description',
    'certifications',
    'sailing_preferences',
    'skills',
    'risk_level',
  ];

  // Filter to only allowed fields
  const sanitizedUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      sanitizedUpdates[key] = value;
    }
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    return {
      success: false,
      message: 'No valid fields to update',
      error: 'NO_VALID_FIELDS',
    };
  }

  const { error } = await supabase
    .from('profiles')
    .update(sanitizedUpdates)
    .eq('id', userId);

  if (error) {
    return {
      success: false,
      message: 'Failed to update profile',
      error: error.message,
    };
  }

  return {
    success: true,
    message: `Profile updated: ${Object.keys(sanitizedUpdates).join(', ')}`,
    data: sanitizedUpdates,
  };
}

async function executeApproveRegistration(
  action: AIPendingAction,
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, userId } = context;
  const { registrationId } = action.action_payload as { registrationId: string };

  // Verify ownership
  const { data: registration } = await supabase
    .from('registrations')
    .select(`
      id,
      status,
      user_id,
      legs!inner (
        name,
        journeys!inner (
          boats!inner (
            owner_id
          )
        )
      )
    `)
    .eq('id', registrationId)
    .single();

  if (!registration) {
    return {
      success: false,
      message: 'Registration not found',
      error: 'NOT_FOUND',
    };
  }

  if ((registration as any).legs.journeys.boats.owner_id !== userId) {
    return {
      success: false,
      message: 'Not authorized to approve this registration',
      error: 'UNAUTHORIZED',
    };
  }

  if (registration.status !== 'Pending approval') {
    return {
      success: false,
      message: `Registration is already ${registration.status}`,
      error: 'INVALID_STATUS',
    };
  }

  // Update registration status
  const { error } = await supabase
    .from('registrations')
    .update({ status: 'Approved' })
    .eq('id', registrationId);

  if (error) {
    return {
      success: false,
      message: 'Failed to approve registration',
      error: error.message,
    };
  }

  return {
    success: true,
    message: `Registration approved for ${(registration as any).legs.name}`,
    data: { registrationId, status: 'Approved' },
  };
}

async function executeRejectRegistration(
  action: AIPendingAction,
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, userId } = context;
  const { registrationId } = action.action_payload as { registrationId: string };

  // Verify ownership
  const { data: registration } = await supabase
    .from('registrations')
    .select(`
      id,
      status,
      user_id,
      legs!inner (
        name,
        journeys!inner (
          boats!inner (
            owner_id
          )
        )
      )
    `)
    .eq('id', registrationId)
    .single();

  if (!registration) {
    return {
      success: false,
      message: 'Registration not found',
      error: 'NOT_FOUND',
    };
  }

  if ((registration as any).legs.journeys.boats.owner_id !== userId) {
    return {
      success: false,
      message: 'Not authorized to reject this registration',
      error: 'UNAUTHORIZED',
    };
  }

  if (registration.status !== 'Pending approval') {
    return {
      success: false,
      message: `Registration is already ${registration.status}`,
      error: 'INVALID_STATUS',
    };
  }

  // Update registration status
  const { error } = await supabase
    .from('registrations')
    .update({ status: 'Not approved' })
    .eq('id', registrationId);

  if (error) {
    return {
      success: false,
      message: 'Failed to reject registration',
      error: error.message,
    };
  }

  return {
    success: true,
    message: `Registration rejected for ${(registration as any).legs.name}`,
    data: { registrationId, status: 'Not approved' },
  };
}

// ============================================================================
// Field-Specific Profile Update Actions
// ============================================================================

async function executeUpdateProfileUserDescription(
  action: AIPendingAction,
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, userId } = context;
  const { newValue } = action.action_payload as { newValue: string };

  // For suggestion tools, newValue may not be provided (user should provide it)
  // This action should prompt the user for the new value instead of auto-updating
  if (!newValue || typeof newValue !== 'string') {
    return {
      success: false,
      message: 'This action requires you to provide a new user description. Please use the profile edit form to update your description.',
      error: 'REQUIRES_USER_INPUT',
    };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ user_description: newValue })
    .eq('id', userId);

  if (error) {
    return {
      success: false,
      message: 'Failed to update user description',
      error: error.message,
    };
  }

  return {
    success: true,
    message: 'User description updated successfully',
    data: { field: 'user_description', value: newValue },
  };
}

async function executeUpdateProfileCertifications(
  action: AIPendingAction,
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, userId } = context;
  const { newValue } = action.action_payload as { newValue: string };

  // For suggestion tools, newValue may not be provided (user should provide it)
  // This action should prompt the user for the new value instead of auto-updating
  if (!newValue || typeof newValue !== 'string') {
    return {
      success: false,
      message: 'This action requires you to provide new certifications. Please use the profile edit form to update your certifications.',
      error: 'REQUIRES_USER_INPUT',
    };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ certifications: newValue })
    .eq('id', userId);

  if (error) {
    return {
      success: false,
      message: 'Failed to update certifications',
      error: error.message,
    };
  }

  return {
    success: true,
    message: 'Certifications updated successfully',
    data: { field: 'certifications', value: newValue },
  };
}

async function executeUpdateProfileRiskLevel(
  action: AIPendingAction,
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, userId } = context;
  const { newValue } = action.action_payload as { newValue: string[] };

  // For suggestion tools, newValue may not be provided (user should provide it)
  // This action should prompt the user for the new value instead of auto-updating
  if (!newValue || !Array.isArray(newValue)) {
    return {
      success: false,
      message: 'This action requires you to provide new risk level preferences. Please use the profile edit form to update your risk level.',
      error: 'REQUIRES_USER_INPUT',
    };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ risk_level: newValue })
    .eq('id', userId);

  if (error) {
    return {
      success: false,
      message: 'Failed to update risk level',
      error: error.message,
    };
  }

  return {
    success: true,
    message: 'Risk level updated successfully',
    data: { field: 'risk_level', value: newValue },
  };
}

async function executeUpdateProfileSailingPreferences(
  action: AIPendingAction,
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, userId } = context;
  const { newValue } = action.action_payload as { newValue: string };

  // For suggestion tools, newValue may not be provided (user should provide it)
  // This action should prompt the user for the new value instead of auto-updating
  if (!newValue || typeof newValue !== 'string') {
    return {
      success: false,
      message: 'This action requires you to provide new sailing preferences. Please use the profile edit form to update your sailing preferences.',
      error: 'REQUIRES_USER_INPUT',
    };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ sailing_preferences: newValue })
    .eq('id', userId);

  if (error) {
    return {
      success: false,
      message: 'Failed to update sailing preferences',
      error: error.message,
    };
  }

  return {
    success: true,
    message: 'Sailing preferences updated successfully',
    data: { field: 'sailing_preferences', value: newValue },
  };
}

async function executeUpdateProfileSkills(
  action: AIPendingAction,
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, userId } = context;
  const { newValue } = action.action_payload as { newValue: string[] };

  // For suggestion tools, newValue may not be provided (user should provide it)
  // This action should prompt the user for the new value instead of auto-updating
  if (!newValue || !Array.isArray(newValue)) {
    return {
      success: false,
      message: 'This action requires you to provide new skills. Please use the profile edit form to update your skills.',
      error: 'REQUIRES_USER_INPUT',
    };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ skills: newValue })
    .eq('id', userId);

  if (error) {
    return {
      success: false,
      message: 'Failed to update skills',
      error: error.message,
    };
  }

  return {
    success: true,
    message: 'Skills updated successfully',
    data: { field: 'skills', value: newValue },
  };
}

async function executeRefineSkills(
  action: AIPendingAction,
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, userId } = context;
  const { targetSkills, userProvidedDescriptions } = action.action_payload as {
    targetSkills: string[];
    userProvidedDescriptions?: Record<string, string>;
  };

  if (!targetSkills || !Array.isArray(targetSkills) || targetSkills.length === 0) {
    return {
      success: false,
      message: 'Invalid target skills',
      error: 'INVALID_TARGET_SKILLS',
    };
  }

  // Get current skills
  const { data: profile } = await supabase
    .from('profiles')
    .select('skills')
    .eq('id', userId)
    .single();

  if (!profile) {
    return {
      success: false,
      message: 'Profile not found',
      error: 'PROFILE_NOT_FOUND',
    };
  }

  const currentSkills = profile.skills || [];

  // If user provided descriptions, update the skills
  if (userProvidedDescriptions && Object.keys(userProvidedDescriptions).length > 0) {
    // Convert descriptions to skills format (assuming skills are stored as strings)
    // For now, we'll store the descriptions as skills, but this might need refinement
    // based on how skills are actually structured in the database

    const updatedSkills = [...new Set([
      ...currentSkills.filter((skill: string) => !targetSkills.includes(skill)),
      ...Object.keys(userProvidedDescriptions)
    ])];

    const { error } = await supabase
      .from('profiles')
      .update({ skills: updatedSkills })
      .eq('id', userId);

    if (error) {
      return {
        success: false,
        message: 'Failed to update skills',
        error: error.message,
      };
    }

    return {
      success: true,
      message: 'Skills refined successfully',
      data: {
        field: 'skills',
        updatedSkills: updatedSkills,
        refinedSkills: Object.keys(userProvidedDescriptions),
      },
    };
  }

  // If no user descriptions provided, just validate and provide feedback
  const missingSkills = targetSkills.filter(skill => !currentSkills.includes(skill));

  return {
    success: true,
    message: `Skills refinement requested. ${missingSkills.length > 0 ? `Missing skills: ${missingSkills.join(', ')}. ` : ''}Please provide descriptions for: ${targetSkills.join(', ')}.`,
    data: {
      field: 'skills',
      targetSkills: targetSkills,
      currentSkills: currentSkills,
      missingSkills: missingSkills,
      action: 'refine'
    },
  };
}

async function executeSuggestProfileUpdateUserDescription(
  action: AIPendingAction,
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, userId } = context;
  const { newValue } = action.action_payload as { newValue: string };

  // Validate that newValue is provided (should come from user input)
  if (!newValue || typeof newValue !== 'string' || !newValue.trim()) {
    return {
      success: false,
      message: 'No description provided. Please provide a new user description.',
      error: 'NO_DESCRIPTION_PROVIDED',
    };
  }

  // Update the user's profile with the new description
  const { error } = await supabase
    .from('profiles')
    .update({ user_description: newValue.trim() })
    .eq('id', userId);

  if (error) {
    return {
      success: false,
      message: 'Failed to update user description',
      error: error.message,
    };
  }

  return {
    success: true,
    message: 'User description updated successfully',
    data: { field: 'user_description', value: newValue.trim() },
  };
}
