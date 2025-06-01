// This file re-exports from supabaseClient.js for backward compatibility
// All new code should import directly from supabaseClient.js
import { supabase, db } from './supabaseClient';

export { supabase, db }; 