// Script to run SQL migration for the players table in Supabase
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Get Supabase credentials from env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nPlease add them to your .env file and try again.');
  process.exit(1);
}

// Create Supabase client with admin privileges
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Connecting to Supabase...');
    
    // Check database connection
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
      
    if (tablesError) {
      console.error('Error connecting to Supabase:', tablesError);
      return;
    }
    
    console.log(`Connected to Supabase. Found ${tables.length} tables in public schema.`);
    console.log('Tables:', tables.map(t => t.table_name).join(', '));
    
    // Check if players table exists
    const playersTableExists = tables.some(t => t.table_name === 'players');
    console.log(`Players table exists: ${playersTableExists}`);
    
    if (!playersTableExists) {
      console.log('Creating players table...');
      
      // Read SQL from file
      const sqlPath = path.join(__dirname, 'create-players-table.sql');
      
      if (!fs.existsSync(sqlPath)) {
        console.error(`SQL file not found: ${sqlPath}`);
        return;
      }
      
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log('Running SQL migration...');
      
      // Try to run SQL using rpc first
      try {
        const { error } = await supabase.rpc('exec_sql', { sql });
        
        if (error) {
          throw error;
        }
        
        console.log('Players table created successfully using RPC!');
      } catch (rpcError) {
        console.log('RPC approach failed, trying direct SQL method...');
        console.error('RPC error details:', rpcError);
        
        // Fall back to direct SQL if RPC fails
        try {
          const { error } = await supabase.sql(sql);
          
          if (error) {
            throw error;
          }
          
          console.log('Players table created successfully using SQL method!');
        } catch (sqlError) {
          console.error('SQL approach also failed:', sqlError);
          console.log('\nSUGGESTIONS:');
          console.log('1. Check that your SUPABASE_SERVICE_ROLE_KEY has full database access');
          console.log('2. Try running the SQL directly in the Supabase dashboard SQL editor');
          console.log('3. Verify that your database has the game_sessions table already created');
          return;
        }
      }
    }
    
    // Verify that the players table was created
    const { data: updatedTables, error: updatedTablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
      
    if (updatedTablesError) {
      console.error('Error checking tables after migration:', updatedTablesError);
      return;
    }
    
    const playersTableCreated = updatedTables.some(t => t.table_name === 'players');
    
    if (playersTableCreated) {
      console.log('\n✅ Players table now exists in the database!');
    } else {
      console.log('\n❌ Failed to create players table. Please check the error messages above.');
    }
    
    console.log('\nTables after migration:', updatedTables.map(t => t.table_name).join(', '));
    
  } catch (err) {
    console.error('Unexpected error during migration:', err);
  }
}

// Run the migration
console.log('🔄 Starting database migration...');
runMigration().then(() => {
  console.log('Migration process completed.');
});
