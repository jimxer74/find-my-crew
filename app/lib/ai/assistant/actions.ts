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

      case 'update_profile':
        result = await executeUpdateProfile(action, context);
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

  // Whitelist of allowed fields to update
  const allowedFields = [
    'full_name',
    'sailing_experience',
    'user_description',
    'certifications',
    'sailing_preferences',
    'skills',
    'risk_level',
    'phone',
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
