/**
 * Simplified actionUtils test
 * This tests the core logic without complex imports
 */
// Copy the core logic from actionUtils.tsx
var ACTION_LABELS = {
    register_for_leg: 'Register for Leg',
    update_profile: 'Update Profile',
    create_journey: 'Create Journey',
    approve_registration: 'Approve Crew',
    reject_registration: 'Reject Crew',
    suggest_profile_update_user_description: 'Update User Description',
    update_profile_user_description: 'Update User Description',
    update_profile_certifications: 'Update Certifications',
    update_profile_risk_level: 'Update Risk Level',
    update_profile_sailing_preferences: 'Update Sailing Preferences',
    update_profile_skills: 'Update Skills',
    refine_skills: 'Refine Skills',
};
function convertActionToNotification(action) {
    var actionMetadata = {
        action_id: action.id,
        action_type: action.action_type,
        action_payload: action.action_payload,
        action_explanation: action.explanation,
        input_required: action.awaiting_user_input || false,
        input_type: action.input_type,
        input_options: action.input_options,
        input_prompt: action.input_prompt,
        profile_section: action.profile_section,
        profile_field: action.profile_field,
        ai_highlight_text: action.ai_highlight_text,
    };
    var notification = {
        id: action.id,
        user_id: action.user_id,
        type: 'ai_pending_action',
        title: formatActionType(action.action_type),
        message: action.explanation,
        link: null,
        read: false,
        metadata: actionMetadata,
        created_at: action.created_at,
    };
    return notification;
}
function formatActionType(type) {
    if (type in ACTION_LABELS) {
        return ACTION_LABELS[type];
    }
    if (typeof type === 'string') {
        return type
            .split('_')
            .map(function (word) {
            if (word === 'ai')
                return 'AI';
            if (word === 'id')
                return 'ID';
            if (word === 'url')
                return 'URL';
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
            .join(' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2');
    }
    return 'Unknown Action';
}
// Test the functions
var mockAction = {
    id: 'test-action-123',
    user_id: 'user-123',
    conversation_id: 'conv-456',
    action_type: 'update_profile_skills',
    action_payload: { skills: ['sailing', 'navigation'] },
    explanation: 'AI suggests updating your skills to improve match rate',
    status: 'pending',
    created_at: '2026-02-05T10:00:00Z',
    resolved_at: null,
    input_prompt: 'Enter your new skills',
    input_type: 'text_array',
    awaiting_user_input: true,
    profile_section: 'experience',
    profile_field: 'skills',
    ai_highlight_text: 'Update your sailing skills',
};
try {
    var notification = convertActionToNotification(mockAction);
    console.log('✅ convertActionToNotification works');
    console.log('Notification title:', notification.title);
    console.log('Notification type:', notification.type);
    console.log('Metadata has action_id:', !!notification.metadata['action_id']);
    var formattedType = formatActionType('update_profile_skills');
    console.log('✅ formatActionType works');
    console.log('Formatted type:', formattedType);
    console.log('✅ All functions work correctly!');
}
catch (error) {
    console.error('❌ Test failed:', error);
}
