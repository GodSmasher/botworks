import { describe, it, expect } from 'vitest'
import { createMockClient } from './client'

type Row = Record<string, unknown>

const users: Row[] = [
  { id: 'u1', name: 'Ada', role: 'admin', last_seen_at: '2026-03-01T10:00:00Z' },
  { id: 'u2', name: 'Ben', role: 'member', last_seen_at: null },
  { id: 'u3', name: 'Cleo', role: 'member', last_seen_at: '2026-02-01T10:00:00Z' },
  { id: 'u4', name: 'Dan', role: 'viewer', last_seen_at: '2026-04-01T10:00:00Z' },
]

const client = createMockClient({ users })

describe('mock query builder', () => {
  it('returns every row of a table with select()', async () => {
    const { data, error, count } = await client.from('users').select()
    expect(error).toBeNull()
    expect(count).toBeNull()
    expect(data).toEqual(users)
  })

  it('filters with eq', async () => {
    const { data } = await client.from('users').select().eq('role', 'member')
    expect((data as Row[]).map((r) => r.id)).toEqual(['u2', 'u3'])
  })

  it('orders ascending with nulls last', async () => {
    const { data } = await client.from('users').select().order('last_seen_at', { ascending: true })
    expect((data as Row[]).map((r) => r.id)).toEqual(['u3', 'u1', 'u4', 'u2'])
  })

  it('orders descending with nulls last', async () => {
    const { data } = await client.from('users').select().order('last_seen_at', { ascending: false })
    expect((data as Row[]).map((r) => r.id)).toEqual(['u4', 'u1', 'u3', 'u2'])
  })

  it('applies limit after ordering', async () => {
    const { data } = await client.from('users').select().order('name').limit(2)
    expect((data as Row[]).map((r) => r.name)).toEqual(['Ada', 'Ben'])
  })

  it('projects the requested columns only', async () => {
    const { data } = await client.from('users').select('id, name').eq('id', 'u1')
    expect(data).toEqual([{ id: 'u1', name: 'Ada' }])
  })

  it('returns a count and null data for a head request', async () => {
    const { data, count, error } = await client.from('users').select('*', { count: 'exact', head: true }).eq('role', 'member')
    expect(error).toBeNull()
    expect(data).toBeNull()
    expect(count).toBe(2)
  })

  it('returns the row for single() with exactly one match', async () => {
    const { data, error } = await client.from('users').select().eq('id', 'u3').single()
    expect(error).toBeNull()
    expect(data).toEqual(users[2])
  })

  it('returns an error for single() with zero matches', async () => {
    const { data, error } = await client.from('users').select().eq('id', 'missing').single()
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(typeof error?.message).toBe('string')
  })

  it('filters out nulls with not(column, "is", null)', async () => {
    const { data } = await client.from('users').select().not('last_seen_at', 'is', null)
    expect((data as Row[]).map((r) => r.id)).toEqual(['u1', 'u3', 'u4'])
  })

  it('returns an error object for an unknown table', async () => {
    const { data, error } = await client.from('nope').select()
    expect(data).toBeNull()
    expect(error?.message).toMatch(/"nope" does not exist/)
  })
})
