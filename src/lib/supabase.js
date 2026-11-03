
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pqpbliswykmlhxkdmzzl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NhRLWYVKAkKp0Lp4_QEv1A_z3Oxy3ZK';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables. Copy .env.example to .env.local and configure a development project.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
