// Test script to diagnose the delete account API
const fetch = require('node-fetch');

async function testDeleteAccountAPI() {
  console.log('Testing delete account API...');

  // Test user ID (replace with a real test user)
  const testUserId = 'YOUR_TEST_USER_ID';

  // You would need to get a valid session token for the test user
  // This is a simplified test - in reality you'd need proper authentication
  const response = await fetch('http://localhost:3000/api/user/delete-account', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      // You'd need to add proper authorization headers here
    },
    body: JSON.stringify({
      confirmation: 'DELETE MY ACCOUNT'
    })
  });

  const result = await response.json();
  console.log('API Response:', JSON.stringify(result, null, 2));

  // Check the results
  if (result.deletionSummary) {
    console.log('\nDeletion Summary:');
    console.log(`Total operations: ${result.deletionSummary.total}`);
    console.log(`Successful: ${result.deletionSummary.successful}`);
    console.log(`Failed: ${result.deletionSummary.failed}`);

    result.deletionSummary.results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.table} (${result.operation}): ${result.success ? 'SUCCESS' : 'FAILED'}`);
      if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
  }

  if (result.verification) {
    console.log('\nVerification Results:');
    console.log(`Has remaining data: ${result.verification.hasRemainingData}`);

    if (result.verification.verificationResults) {
      result.verification.verificationResults.forEach((verification, index) => {
        console.log(`${index + 1}. ${verification.table}: ${verification.status}${verification.count ? ` (${verification.count})` : ''}`);
        if (verification.status === 'remaining') {
          console.log(`   WARNING: Data still exists in ${verification.table}`);
        } else if (verification.status === 'error') {
          console.log(`   ERROR: Verification failed for ${verification.table}`);
        }
      });
    }
  }
}

testDeleteAccountAPI().catch(console.error);