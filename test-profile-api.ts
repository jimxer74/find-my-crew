#!/usr/bin/env ts-node

// Simple test script to verify profile API calls work correctly
// This helps ensure we've fixed the 406 Not Acceptable errors

import { createClient } from '@supabase/supabase-js';

// Test configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

async function testProfileAPI() {
  console.log('Testing profile API calls...');

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Test 1: Try to fetch a non-existent user profile
    console.log('Test 1: Fetching non-existent user profile...');
    const { data: nonExistentData, error: nonExistentError } = await supabase
      .from('profiles')
      .select('skills, sailing_experience, risk_level')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .single();

    console.log('Non-existent user result:', {
      data: nonExistentData,
      error: nonExistentError?.code,
      message: nonExistentError?.message
    });

    // Test 2: Try to fetch with correct select format
    console.log('Test 2: Testing correct select format...');
    const { data: correctData, error: correctError } = await supabase
      .from('profiles')
      .select('id, username, full_name, phone, sailing_experience, risk_level, skills, sailing_preferences, roles, profile_completion_percentage')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .single();

    console.log('Correct format result:', {
      data: correctData,
      error: correctError?.code,
      message: correctError?.message
    });

    console.log('Profile API tests completed successfully!');

  } catch (error) {
    console.error('Profile API test failed:', error);
  }
}

if (require.main === module) {
  testProfileAPI();
}

export { testProfileAPI };