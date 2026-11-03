
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pqpbliswykmleyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9hxkdmzzl.supabase.co';
const SUPABASE_ANON_KEY = '.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxcGJsaXN3eWttbGh4a2RtenpsIiwicm9sZsb_publishable_NhRLWYVKAkKp0Lp4_QEv1A_z3Oxy3ZKSI6ImFub24iLCJpYXQiOjE3ODAxMDUxMjksImV4cCI6MjA5NTY4MTEyOX0.KwDlhJ_uv-hWg4GC3AIwyVOY1aDJCKbIFqJYD3w7RCo';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables. Copy .env.example to .env.local and configure a development project.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
