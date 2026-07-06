import { createClient } from '@supabase/supabase-js'

// SERVER-ONLY. Uses the service role key, which bypasses RLS entirely.
// Only import this in Server Actions ('use server' files) — never in a
// Client Component, or the key would be exposed to the browser.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}