// Test script to diagnose game session creation issues
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with your project URL and anon key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testCreateGameSession() {
  try {
    console.log('Starting test: Create game session');

    // First, authenticate
    console.log('Testing with email signin...');
    const email = process.argv[2];
    const password = process.argv[3];
    
    if (!email || !password) {
      console.error('Usage: node test-create-session.js <email> <password>');
      process.exit(1);
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      console.error('Authentication error:', authError);
      return;
    }

    console.log('Successfully authenticated as:', authData.user.email);
    const userId = authData.user.id;

    // Step 1: Check if we can access game_sessions table
    console.log('Checking access to game_sessions table...');
    const { data: checkData, error: checkError } = await supabase
      .from('game_sessions')
      .select('id')
      .limit(1);

    if (checkError) {
      console.error('Cannot access game_sessions table:', checkError);
    } else {
      console.log('Successfully accessed game_sessions table');
    }

    // Step 2: Get one of the user's quizzes to use for testing
    console.log('Getting a quiz for testing...');
    const { data: quizzes, error: quizError } = await supabase
      .from('quizzes')
      .select('id, title')
      .eq('owner_id', userId)
      .limit(1);

    if (quizError) {
      console.error('Error getting quizzes:', quizError);
      return;
    }

    if (!quizzes || quizzes.length === 0) {
      console.error('No quizzes found for this user. Please create a quiz first.');
      return;
    }

    const quizId = quizzes[0].id;
    console.log(`Using quiz: ${quizzes[0].title} (${quizId})`);

    // Step 3: Generate a PIN
    const generatePin = () => Math.floor(100000 + Math.random() * 900000).toString();
    const pin = generatePin();
    console.log(`Generated PIN: ${pin}`);

    // Step 4: Try to create a game session
    console.log('Attempting to create game session...');
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .insert([{
        quiz_id: quizId,
        host_id: userId,
        pin,
        status: 'waiting',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating game session:', sessionError);
      
      // Check if it's an RLS policy error
      if (sessionError.message.includes('policy')) {
        console.log('This appears to be an RLS policy error.');
        console.log('Checking policies on game_sessions table...');
        
        const { data: policies, error: policyError } = await supabase
          .rpc('get_policies_for_table', { table_name: 'game_sessions' });
        
        if (policyError) {
          console.error('Could not check policies:', policyError);
        } else {
          console.log('Policies on game_sessions table:', policies);
        }
      }
      
      return;
    }

    console.log('Game session created successfully:', session);

    // Step 5: Clean up - delete the session
    console.log('Cleaning up - deleting test session...');
    const { error: deleteError } = await supabase
      .from('game_sessions')
      .delete()
      .eq('id', session.id);

    if (deleteError) {
      console.error('Error deleting test session:', deleteError);
    } else {
      console.log('Test session deleted successfully');
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testCreateGameSession(); 