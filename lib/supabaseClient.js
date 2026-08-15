import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
// We use the service role key for API routes to bypass RLS for writes (like ban) if needed.
// For Next.js APIs, process.env is injected automatically.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});
