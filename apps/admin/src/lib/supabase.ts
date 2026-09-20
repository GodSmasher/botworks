import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createMockClient } from './mock/client'
import { mockTables } from './mock/db'

/**
 * Mock mode is the default: the panel reads invented fixture tables through an
 * in-memory client with the same query interface. Set BOTWORKS_MOCK=false plus
 * the Supabase env vars to run against a real database.
 */
export function isMockMode(): boolean {
  return process.env.BOTWORKS_MOCK !== 'false'
}

// Service-role client for server-side queries (bypasses RLS)
export function createServiceClient(): SupabaseClient {
  if (isMockMode()) return createMockClient(mockTables) as unknown as SupabaseClient
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
