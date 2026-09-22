import { describe, it, expect } from 'vitest'
import inboxTriage from '@botworks/inbox-triage'

describe('inbox-triage validate', () => {
  it('rejects an empty input object with an error string', () => {
    const error = inboxTriage.validate({})
    expect(typeof error).toBe('string')
    expect(error).not.toBe('')
  })

  it('rejects an empty emails array with an error string', () => {
    const error = inboxTriage.validate({ emails: [] })
    expect(typeof error).toBe('string')
    expect(error).not.toBe('')
  })

  it('rejects an email that is missing required fields', () => {
    const error = inboxTriage.validate({ emails: [{ id: '1', subject: 'no sender' }] })
    expect(typeof error).toBe('string')
  })

  it('accepts a minimal valid email', () => {
    const error = inboxTriage.validate({
      emails: [{ id: '1', from: 'a@example.com', to: ['b@example.com'], subject: 'Hello', body: 'World' }],
    })
    expect(error).toBeNull()
  })
})
