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

// Error handling helper (copied from lib/supabase.js)
const handleError = (error, customMessage) => {
  console.error('Database error:', error);
  
  // Handle specific Supabase errors
  if (error.code === '23505') {
    throw new Error('This item already exists.');
  }
  if (error.code === '23503') {
    throw new Error('Referenced item does not exist.');
  }
  if (error.code === '42501') {
    throw new Error('You do not have permission to perform this action.');
  }
  if (error.message?.includes('row-level security')) {
    throw new Error('You do not have permission to perform this action. Please sign in again.');
  }
  
  throw new Error(customMessage || 'An unexpected error occurred.');
};

// Test join function (similar to the one in lib/supabase.js)
async function joinGameSession({ pin, playerName }) {
  try {
    if (!pin || !playerName) {
      throw new Error('PIN and player name are required.');
    }

    console.log(`Attempting to join game with PIN: ${pin} and name: ${playerName}`);

    // Find the game session by PIN
    console.log('Looking up game session...');
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('pin', pin)
      .eq('status', 'waiting')
      .single();

    console.log('Session lookup result:', session || 'No session found');
    console.log('Session lookup error:', sessionError || 'No error');

    if (sessionError || !session) {
      throw new Error('Game not found or already started.');
    }

    // Check which table to use for players
    console.log('Checking players table...');
    const { error: playersTableError } = await supabase
      .from('players')
      .select('id')
      .limit(1);

    if (playersTableError) {
      console.log('Players table error:', playersTableError);
      console.log('Checking player_sessions table instead...');
      
      const { error: playerSessionsTableError } = await supabase
        .from('player_sessions')
        .select('id')
        .limit(1);
      
      if (playerSessionsTableError) {
        console.log('Player_sessions table error:', playerSessionsTableError);
        throw new Error('Cannot access players tables');
      }
      
      // Use player_sessions table
      console.log('Using player_sessions table');
      const { data: player, error: playerError } = await supabase
        .from('player_sessions')
        .insert([{
          game_session_id: session.id,
          name: playerName,
          score: 0,
          joined_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (playerError) {
        console.log('Error inserting into player_sessions:', playerError);
        if (playerError.code === '23505') {
          throw new Error('This name is already taken in the game.');
        }
        throw playerError;
      }
      
      console.log('Successfully joined game with player_sessions:', player);
      return {
        sessionId: session.id,
        playerId: player.id,
        pin: session.pin
      };
    } else {
      // Use players table
      console.log('Using players table');
      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert([{
          session_id: session.id,
          name: playerName,
          score: 0,
          joined_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (playerError) {
        console.log('Error inserting into players:', playerError);
        if (playerError.code === '23505') {
          throw new Error('This name is already taken in the game.');
        }
        throw playerError;
      }
      
      console.log('Successfully joined game with players:', player);
      return {
        sessionId: session.id,
        playerId: player.id,
        pin: session.pin
      };
    }
  } catch (error) {
    handleError(error, 'Failed to join game.');
  }
}

// Test with a specific PIN
async function testJoinWithPin() {
  try {
    // Check if there are any active game sessions
    console.log('Checking for active game sessions...');
    const { data: sessions, error: sessionsError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('status', 'waiting');
    
    if (sessionsError) {
      console.error('Error checking game sessions:', sessionsError);
      return;
    }
    
    console.log(`Found ${sessions?.length || 0} active game sessions`);
    
    if (sessions && sessions.length > 0) {
      // Try to join the first active session
      const testSession = sessions[0];
      console.log('Found active session with PIN:', testSession.pin);
      
      const result = await joinGameSession({
        pin: testSession.pin,
        playerName: 'TestPlayer_' + Math.floor(Math.random() * 1000)
      });
      
      console.log('Join result:', result);
    } else {
      console.log('No active game sessions found. Please create a game first.');
    }
  } catch (error) {
    console.error('Test error:', error);
  }
}

// Run the test
testJoinWithPin(); 