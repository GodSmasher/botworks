import { isMockMode } from './supabase'
import manifests from './mock/bots.json'

const BOTS_API = process.env.BOTWORKS_API_URL ?? 'http://localhost:4000'

export const botsApiLabel = isMockMode() ? 'bundled manifests (mock mode)' : BOTS_API

/**
 * GET against the bot API. In mock mode the answers come from the manifests
 * bundled at build time, so the panel works without a running API.
 */
export async function botsApiFetch(path: '/api/bots' | '/health'): Promise<Response> {
  if (isMockMode()) {
    const body = path === '/health'
      ? { status: 'ok', timestamp: new Date().toISOString(), bots: manifests.length, version: '0.1.0' }
      : { ok: true, data: manifests }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return fetch(`${BOTS_API}${path}`, { cache: 'no-store' })
}
