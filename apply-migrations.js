require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Use service key for admin privileges needed for creating tables
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigrations() {
  try {
    console.log('Checking database connection...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
      
    if (tablesError) {
      console.error('Error connecting to Supabase:', tablesError);
      return;
    }
    
    console.log(`Connected to Supabase. Found ${tables.length} tables in public schema.`);
    
    // Check if players table exists
    const playersTableExists = tables.some(t => t.table_name === 'players');
    console.log(`Players table exists: ${playersTableExists}`);
    
    if (!playersTableExists) {
      console.log('Creating players table...');
      
      // Execute the players table creation SQL
      const { error } = await supabase.rpc('exec_sql', { 
        sql: `
          CREATE TABLE IF NOT EXISTS public.players (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            session_id UUID REFERENCES public.game_sessions(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            score INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
          );
          
          CREATE INDEX IF NOT EXISTS players_session_id_idx ON public.players(session_id);
        `
      });
      
      if (error) {
        console.error('Error creating players table:', error);
        
        // Try an alternative approach if RPC fails
        console.log('Trying alternative approach...');
        const { error: sqlError } = await supabase.sql(`
          CREATE TABLE IF NOT EXISTS public.players (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            session_id UUID REFERENCES public.game_sessions(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            score INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
          );
          
          CREATE INDEX IF NOT EXISTS players_session_id_idx ON public.players(session_id);
        `);
        
        if (sqlError) {
          console.error('Alternative approach failed:', sqlError);
          return;
        }
      }
      
      console.log('Players table created successfully!');
    }
    
    // Apply other migrations from the migration directory
    console.log('\nApplying migrations from supabase/migrations directory...');
    const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Apply in alphabetical order
    
    for (const file of migrationFiles) {
      console.log(`Applying migration: ${file}`);
      const migrationSql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      // Execute each migration file
      const { error } = await supabase.rpc('exec_sql', { sql: migrationSql });
      
      if (error) {
        console.error(`Error applying migration ${file}:`, error);
        // Try alternative approach
        const { error: sqlError } = await supabase.sql(migrationSql);
        if (sqlError) {
          console.error(`Alternative approach failed for ${file}:`, sqlError);
          console.log('Continuing with next migration...');
        } else {
          console.log(`Applied ${file} using alternative approach`);
        }
      } else {
        console.log(`Applied ${file} successfully`);
      }
    }
    
    console.log('\nVerifying tables after migrations...');
    const { data: updatedTables, error: updatedTablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
      
    if (updatedTablesError) {
      console.error('Error checking tables after migration:', updatedTablesError);
      return;
    }
    
    console.log('Public tables after migration:');
    updatedTables.forEach(t => console.log(`- ${t.table_name}`));
    
  } catch (err) {
    console.error('Unexpected error during migration:', err);
  }
}

applyMigrations();
