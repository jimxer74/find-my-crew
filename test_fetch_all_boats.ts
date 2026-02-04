import { createClient } from '@supabase/supabase-js';
import { executeTool } from './app/lib/ai/assistant/toolExecutor';

// Test configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testFetchAllBoats() {
  console.log('🧪 Testing fetch_all_boats tool implementation...\n');

  // Test 1: Owner user (should see their own boats)
  console.log('📋 Test 1: Owner User');
  try {
    const ownerResult = await executeTool(
      {
        id: 'test-owner-1',
        name: 'fetch_all_boats',
        arguments: {
          limit: 10,
          includePerformance: true,
          includeImages: true,
        }
      },
      {
        supabase,
        userId: 'owner-user-id', // Replace with actual owner user ID
        userRoles: ['owner'],
        conversationId: 'test-conversation-1'
      }
    );

    console.log('✅ Owner result:', JSON.stringify(ownerResult, null, 2));
  } catch (error) {
    console.log('❌ Owner test failed:', error);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Crew user (should see boats with published journeys)
  console.log('📋 Test 2: Crew User');
  try {
    const crewResult = await executeTool(
      {
        id: 'test-crew-1',
        name: 'fetch_all_boats',
        arguments: {
          limit: 10,
          includePerformance: true,
          includeImages: true,
        }
      },
      {
        supabase,
        userId: 'crew-user-id', // Replace with actual crew user ID
        userRoles: ['crew'],
        conversationId: 'test-conversation-1'
      }
    );

    console.log('✅ Crew result:', JSON.stringify(crewResult, null, 2));
  } catch (error) {
    console.log('❌ Crew test failed:', error);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Filter by boat type
  console.log('📋 Test 3: Filter by Boat Type');
  try {
    const filteredResult = await executeTool(
      {
        id: 'test-filter-1',
        name: 'fetch_all_boats',
        arguments: {
          limit: 5,
          includePerformance: false,
          includeImages: false,
          boatType: 'Coastal cruisers',
        }
      },
      {
        supabase,
        userId: 'crew-user-id', // Replace with actual crew user ID
        userRoles: ['crew'],
        conversationId: 'test-conversation-1'
      }
    );

    console.log('✅ Filtered result:', JSON.stringify(filteredResult, null, 2));
  } catch (error) {
    console.log('❌ Filter test failed:', error);
  }

  console.log('\n🎉 All tests completed!');
}

// Run tests
if (require.main === module) {
  testFetchAllBoats().catch(console.error);
}

export { testFetchAllBoats };