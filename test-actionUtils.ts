/**
 * Test file for actionUtils.tsx
 * This is a simple test to verify the functions compile and work correctly
 */

import { convertActionToNotification, formatActionType } from './app/components/notifications/helpers/actionUtils';

// Mock AIPendingAction for testing
const mockAction = {
  id: 'test-action-123',
  user_id: 'user-123',
  conversation_id: 'conv-456',
  action_type: 'update_profile_skills' as const,
  action_payload: { skills: ['sailing', 'navigation'] },
  explanation: 'AI suggests updating your skills to improve match rate',
  status: 'pending' as const,
  created_at: '2026-02-05T10:00:00Z',
  resolved_at: null,
  input_prompt: 'Enter your new skills',
  input_type: 'text_array' as const,
  input_options: undefined,
  awaiting_user_input: true,
  profile_section: 'experience' as const,
  profile_field: 'skills',
  ai_highlight_text: 'Update your sailing skills',
};

// Test the functions
try {
  const notification = convertActionToNotification(mockAction);
  console.log('✅ convertActionToNotification works');
  console.log('Notification title:', notification.title);
  console.log('Notification type:', notification.type);

  const formattedType = formatActionType('update_profile_skills');
  console.log('✅ formatActionType works');
  console.log('Formatted type:', formattedType);

  console.log('✅ All tests passed!');
} catch (error) {
  console.error('❌ Test failed:', error);
}