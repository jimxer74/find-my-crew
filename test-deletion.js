const { createClient } = require('@supabase/supabase-js');

// Test deletion functionality
async function testDeletion() {
  console.log('Testing account deletion functionality...');

  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // Test user ID (you'll need to replace this with a real test user ID)
  const testUserId = 'YOUR_TEST_USER_ID';

  console.log(`Testing deletion for user: ${testUserId}`);

  try {
    // 1. Check if profile exists
    console.log('1. Checking if profile exists...');
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', testUserId);

    if (profileError) {
      console.error('Profile check failed:', profileError);
    } else {
      console.log('Profile found:', profileData.length > 0 ? 'Yes' : 'No');
    }

    // 2. Test profile deletion
    console.log('2. Testing profile deletion...');
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', testUserId);

    if (deleteError) {
      console.error('Profile deletion failed:', deleteError);
    } else {
      console.log('Profile deletion successful');
    }

    // 3. Verify profile deletion
    console.log('3. Verifying profile deletion...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', testUserId)
      .single();

    if (verifyError && verifyError.code !== 'PGRST116') {
      console.warn('Profile verification query failed:', verifyError);
    } else if (verifyData) {
      console.error('Profile still exists after deletion attempt!');
    } else {
      console.log('Profile successfully deleted');
    }

    // 4. Test auth user deletion
    console.log('4. Testing auth user deletion...');
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(testUserId);

    if (authDeleteError) {
      console.error('Auth user deletion failed:', authDeleteError);
    } else {
      console.log('Auth user deletion successful');
    }

    // 5. Verify auth user deletion
    console.log('5. Verifying auth user deletion...');
    const { data: authVerifyData, error: authVerifyError } = await supabase
      .from('auth.users')
      .select('id')
      .eq('id', testUserId)
      .single();

    if (authVerifyError && authVerifyError.code !== 'PGRST116') {
      console.warn('Auth user verification query failed:', authVerifyError);
    } else if (authVerifyData) {
      console.error('Auth user still exists after deletion attempt!');
    } else {
      console.log('Auth user successfully deleted');
    }

  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test
testDeletion().catch(console.error);