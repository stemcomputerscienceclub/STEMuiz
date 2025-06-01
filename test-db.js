// Load environment variables from .env file
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Create Supabase client manually using environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:');
  if (!supabaseUrl) console.error('- NEXT_PUBLIC_SUPABASE_URL is not set');
  if (!supabaseAnonKey) console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testJoinGame() {
  try {
    // 1. Test database connection
    console.log('Testing database connection...');
    const { data: testData, error: testError } = await supabase.from('game_sessions').select('count').limit(1);
    
    if (testError) {
      console.error('Database connection error:', testError);
      return;
    }
    
    console.log('Database connection successful');
    
    // 2. Create a test game session
    console.log('Creating test game session...');
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .insert([{
        quiz_id: '00000000-0000-0000-0000-000000000000', // Placeholder quiz ID
        host_id: '00000000-0000-0000-0000-000000000000', // Placeholder host ID
        status: 'waiting',
        pin: '123456',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (sessionError) {
      console.error('Error creating test session:', sessionError);
      return;
    }
    
    console.log('Test game session created:', session);
    
    // 3. Try to join the game session
    console.log('Attempting to join game session...');
    
    // First check if the players table exists
    const { data: tableInfo, error: tableError } = await supabase
      .from('players')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('Error accessing players table:', tableError);
      console.log('Checking if player_sessions table exists instead...');
      
      const { data: altTableInfo, error: altTableError } = await supabase
        .from('player_sessions')
        .select('*')
        .limit(1);
      
      if (altTableError) {
        console.error('Error accessing player_sessions table:', altTableError);
        console.log('Neither players nor player_sessions table seems to exist or be accessible');
      } else {
        console.log('player_sessions table exists');
        
        // Try joining using player_sessions
        const { data: player, error: playerError } = await supabase
          .from('player_sessions')
          .insert([{
            game_session_id: session.id,
            name: 'Test Player',
            score: 0,
            joined_at: new Date().toISOString()
          }])
          .select()
          .single();
        
        if (playerError) {
          console.error('Error joining game with player_sessions:', playerError);
        } else {
          console.log('Successfully joined game with player_sessions:', player);
        }
      }
    } else {
      console.log('players table exists');
      
      // Try joining using players
      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert([{
          session_id: session.id,
          name: 'Test Player',
          score: 0,
          joined_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (playerError) {
        console.error('Error joining game with players:', playerError);
      } else {
        console.log('Successfully joined game with players:', player);
      }
    }
    
    // 4. Clean up - delete the test session
    console.log('Cleaning up test data...');
    await supabase.from('game_sessions').delete().eq('id', session.id);
    console.log('Test complete');
    
  } catch (error) {
    console.error('Unexpected error during testing:', error);
  }
}

testJoinGame(); 