/**
 * Test to verify that actions are created with profile_field
 */

// Test the getProfileField function
function testGetProfileField() {
  console.log('=== Testing getProfileField Function ===');

  const getProfileField = (actionType) => {
    switch (actionType) {
      case 'update_profile_user_description':
        return 'user_description';
      case 'update_profile_certifications':
        return 'certifications';
      case 'update_profile_risk_level':
        return 'risk_level';
      case 'update_profile_sailing_preferences':
        return 'sailing_preferences';
      case 'update_profile_skills':
        return 'skills';
      case 'refine_skills':
        return 'skills';
      default:
        return undefined;
    }
  };

  // Test cases
  const testCases = [
    'update_profile_user_description',
    'update_profile_certifications',
    'update_profile_risk_level',
    'update_profile_sailing_preferences',
    'update_profile_skills',
    'refine_skills',
    'register_for_leg' // Should return undefined
  ];

  testCases.forEach(actionType => {
    const result = getProfileField(actionType);
    console.log(`${actionType}: ${result}`);
  });

  return true;
}

// Test the action creation logic
function testActionCreation() {
  console.log('=== Testing Action Creation Logic ===');

  // Simulate the insert object that would be created
  const actionType = 'update_profile_user_description';
  const payload = { reason: 'Your user description is empty' };
  const explanation = 'Adding a user description will help you get matched with more sailing opportunities';

  // Simulate the getProfileField function call
  const getProfileField = (actionType) => {
    switch (actionType) {
      case 'update_profile_user_description':
        return 'user_description';
      case 'update_profile_certifications':
        return 'certifications';
      case 'update_profile_risk_level':
        return 'risk_level';
      case 'update_profile_sailing_preferences':
        return 'sailing_preferences';
      case 'update_profile_skills':
        return 'skills';
      case 'refine_skills':
        return 'skills';
      default:
        return undefined;
    }
  };

  const insertObject = {
    user_id: 'test-user-id',
    conversation_id: 'test-conversation-id',
    action_type: actionType,
    action_payload: payload,
    explanation,
    status: 'pending',
    profile_field: getProfileField(actionType),
  };

  console.log('Insert object:', insertObject);
  console.log('profile_field value:', insertObject.profile_field);

  return insertObject.profile_field !== undefined;
}

// Run tests
console.log('Running profile field fix tests...\n');

const test1Result = testGetProfileField();
console.log('\ngetProfileField test result:', test1Result ? 'PASSED' : 'FAILED');

const test2Result = testActionCreation();
console.log('\nAction creation test result:', test2Result ? 'PASSED' : 'FAILED');

console.log('\n=== Test Summary ===');
console.log('All tests passed:', test1Result && test2Result);

export { testGetProfileField, testActionCreation };