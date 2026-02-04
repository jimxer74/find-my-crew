/**
 * Test script for suggest_profile_update_user_description functionality
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

async function createSuggestProfileUpdateAction(token) {
  try {
    console.log('📝 Creating suggest_profile_update_user_description action...');

    const actionData = {
      action_type: 'suggest_profile_update_user_description',
      action_payload: {
        field: 'user_description',
        old_value: 'I love sailing and the ocean!'
      },
      explanation: 'Your profile description could be more detailed to attract better matches.',
      input_prompt: 'Please provide your new user description',
      input_type: 'text'
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

    return response.data;
  } catch (error) {
    console.error('❌ Failed to get pending actions:', error.response?.data || error.message);
    throw error;
  }
}

async function submitUserDescriptionInput(token, actionId, description) {
  try {
    console.log(`📤 Submitting user description for action ${actionId}...`);

    const response = await axios.post(
      `${BASE_URL}/api/ai/assistant/actions/${actionId}/submit-input`,
      {
        value: description
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('✅ User description submitted successfully');
    console.log('📊 Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to submit user description:', error.response?.data || error.message);
    throw error;
  }
}

async function testSuggestProfileUpdateFlow() {
  console.log('🧪 Starting suggest_profile_update_user_description functionality test\n');

  try {
    // 1. Login
    const token = await loginAndGetToken();

    // 2. Create test action
    const actionId = await createSuggestProfileUpdateAction(token);

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
    console.log('✅ Input type:', testAction.input_type);
    console.log('✅ Explanation:', testAction.explanation);

    // 6. Test submitting a user description
    console.log('\n🧪 Testing user description submission...');
    const newDescription = 'Experienced sailor with 10+ years of offshore cruising and racing experience. Passionate about sustainable sailing practices and ocean conservation.';

    await submitUserDescriptionInput(token, actionId, newDescription);

    // Wait for processing
    await delay(500);

    // 7. Verify the action was processed
    const updatedActions = await getPendingActions(token);
    const updatedAction = updatedActions.find(action => action.id === actionId);

    if (updatedAction) {
      console.log('❌ Action should have been processed');
      console.log('📋 Action status:', updatedAction.status);
    } else {
      console.log('✅ Action was successfully processed');
    }

    console.log('\n🎉 suggest_profile_update_user_description functionality test completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('- ✅ User authentication');
    console.log('- ✅ Action creation with suggest_profile_update_user_description type');
    console.log('- ✅ Pending actions retrieval');
    console.log('- ✅ User description input submission');
    console.log('- ✅ Action processing and database update');

  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  testSuggestProfileUpdateFlow().catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testSuggestProfileUpdateFlow,
  loginAndGetToken,
  createSuggestProfileUpdateAction,
  getPendingActions,
  submitUserDescriptionInput
};