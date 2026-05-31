import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://pqpbliswykmlhxkdmzzl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxcGJsaXN3eWttbGh4a2RtenpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMDUxMjksImV4cCI6MjA5NTY4MTEyOX0.KwDlhJ_uv-hWg4GC3AIwyVOY1aDJCKbIFqJYD3w7RCo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

