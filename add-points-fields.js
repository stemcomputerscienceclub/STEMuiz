require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function addPointsFields() {
  try {
    console.log('Adding points and double_points fields to questions table...');
    
    // First, execute a raw SQL query to add the columns if they don't exist
    const { error: alterError } = await supabase.rpc('execute_sql', {
      sql_query: `
        ALTER TABLE questions ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 1000;
        ALTER TABLE questions ADD COLUMN IF NOT EXISTS double_points BOOLEAN DEFAULT FALSE;
      `
    });
    
    if (alterError) {
      console.error('Error altering table:', alterError);
      return;
    }
    
    // Update all existing questions with default values where columns are NULL
    const { data: updateData, error: updateError } = await supabase
      .from('questions')
      .update({ 
        points: 1000,
        double_points: false 
      })
      .is('points', null);
    
    if (updateError) {
      console.error('Error updating questions:', updateError);
      return;
    }
    
    console.log('Updated questions with default points values');
    
    // Verify the schema now
    const { data, error } = await supabase.from('questions').select('*').limit(1);
    
    if (error) {
      console.error('Error fetching question:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('No questions found in the database');
      return;
    }
    
    console.log('Updated question schema:', Object.keys(data[0]));
    console.log('Sample question data:', data[0]);
  } catch (err) {
    console.error('Error:', err);
  }
}

addPointsFields(); 