require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  try {
    console.log('Checking questions table schema...');
    const { data, error } = await supabase.from('questions').select('*').limit(1);
    
    if (error) {
      console.error('Error fetching question:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('No questions found in the database');
      return;
    }
    
    console.log('Question schema:', Object.keys(data[0]));
    console.log('Sample question data:', data[0]);
  } catch (err) {
    console.error('Error:', err);
  }
}

checkSchema(); 