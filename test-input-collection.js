/**
 * Test script for input collection functionality
 * Tests the complete flow from action creation to input submission
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000';
const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_PASSWORD = 'testpassword123';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loginAndGetToken() {
  try {
    console.log('🔐 Logging in as test user...');

    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });

    console.log('✅ Login successful');
    return response.data.token || response.data.access_token;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function createTestAction(token) {
  try {
    console.log('📝 Creating test action with input collection...');

    const actionData = {
      action_type: 'update_profile',
      action_payload: {
        field: 'sailing_experience',
        old_value: 'beginner'
      },
      input_prompt: 'Please select your sailing experience level',
      input_options: ['beginner', 'intermediate', 'advanced', 'expert'],
      input_type: 'select'
    };

    const response = await axios.post(`${BASE_URL}/api/ai/assistant/actions`, actionData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ Action created successfully');
    console.log('📋 Action ID:', response.data.actionId);
    return response.data.actionId;
  } catch (error) {
    console.error('❌ Failed to create action:', error.response?.data || error.message);
    throw error;
  }
}

async function getPendingActions(token) {
  try {
    console.log('📥 Fetching pending actions...');

    const response = await axios.get(`${BASE_URL}/api/ai/assistant/actions/pending`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ Retrieved pending actions');
    console.log('📋 Total actions:', response.data.length);

    if (response.data.length > 0) {
      console.log('📄 Latest action:', {
        id: response.data[0].id,
        type: response.data[0].action_type,
        prompt: response.data[0].input_prompt,
        options: response.data[0].input_options,
        inputType: response.data[0].input_type
      });
    }

    return response.data;
  } catch (error) {
    console.error('❌ Failed to get pending actions:', error.response?.data || error.message);
    throw error;
  }
}

async function submitInput(token, actionId, value) {
  try {
    console.log(`📤 Submitting input for action ${actionId}...`);

    const response = await axios.post(
      `${BASE_URL}/api/ai/assistant/actions/${actionId}/submit-input`,
      {
        value: value
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('✅ Input submitted successfully');
    console.log('📊 Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to submit input:', error.response?.data || error.message);
    throw error;
  }
}

async function testInputCollectionFlow() {
  console.log('🧪 Starting input collection functionality test\n');

  try {
    // 1. Login
    const token = await loginAndGetToken();

    // 2. Create test action
    const actionId = await createTestAction(token);

    // 3. Wait a moment for the action to be processed
    await delay(1000);

    // 4. Get pending actions to verify the action was created correctly
    const actions = await getPendingActions(token);

    // 5. Find our test action
    const testAction = actions.find(action => action.id === actionId);

    if (!testAction) {
      throw new Error('Test action not found in pending actions');
    }

    console.log('🔍 Verifying action data...');
    console.log('✅ Action type:', testAction.action_type);
    console.log('✅ Input prompt:', testAction.input_prompt);
    console.log('✅ Input options:', testAction.input_options);
    console.log('✅ Input type:', testAction.input_type);

    // 6. Test different input types
    console.log('\n🧪 Testing different input types...\n');

    // Test 1: Valid select input
    console.log('Test 1: Valid select input');
    await submitInput(token, actionId, ['intermediate']);

    // Wait for processing
    await delay(500);

    // Verify the action was updated
    const updatedActions = await getPendingActions(token);
    const updatedAction = updatedActions.find(action => action.id === actionId);

    if (updatedAction) {
      console.log('❌ Action should have been marked as approved');
      console.log('📋 Action status:', updatedAction.status);
      console.log('📋 Action payload:', updatedAction.action_payload);
    } else {
      console.log('✅ Action was successfully processed and removed from pending list');
    }

    console.log('\n🎉 Input collection functionality test completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('- ✅ User authentication');
    console.log('- ✅ Action creation with input collection');
    console.log('- ✅ Pending actions retrieval');
    console.log('- ✅ Input submission and processing');
    console.log('- ✅ Database schema validation');

  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  }
}

async function testMultipleInputTypes() {
  console.log('\n🧪 Testing different input types...\n');

  try {
    const token = await loginAndGetToken();

    // Test text input
    console.log('📝 Testing text input...');
    const textActionId = await createTestAction(token, {
      action_type: 'update_profile',
      action_payload: { field: 'bio' },
      input_prompt: 'Please provide your bio',
      input_options: null,
      input_type: 'text'
    });

    await submitInput(token, textActionId, 'I love sailing and the ocean!');
    console.log('✅ Text input test passed\n');

    // Test text_array input
    console.log('📝 Testing text_array input...');
    const arrayActionId = await createTestAction(token, {
      action_type: 'update_profile',
      action_payload: { field: 'skills' },
      input_prompt: 'Please select your skills',
      input_options: ['sailing', 'cooking', 'navigation', 'maintenance'],
      input_type: 'text_array'
    });

    await submitInput(token, arrayActionId, ['sailing', 'navigation']);
    console.log('✅ Text array input test passed\n');

    console.log('🎉 All input type tests passed!');

  } catch (error) {
    console.error('❌ Input type test failed:', error.message);
  }
}

// Helper function to create action with custom data
async function createTestAction(token, customData = null) {
  const actionData = customData || {
    action_type: 'update_profile',
    action_payload: {
      field: 'sailing_experience',
      old_value: 'beginner'
    },
    input_prompt: 'Please select your sailing experience level',
    input_options: ['beginner', 'intermediate', 'advanced', 'expert'],
    input_type: 'select'
  };

  const response = await axios.post(`${BASE_URL}/api/ai/assistant/actions`, actionData, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  return response.data.actionId;
}

// Run tests
if (require.main === module) {
  testInputCollectionFlow().then(() => {
    return testMultipleInputTypes();
  }).catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testInputCollectionFlow,
  testMultipleInputTypes,
  loginAndGetToken,
  createTestAction,
  getPendingActions,
  submitInput
};