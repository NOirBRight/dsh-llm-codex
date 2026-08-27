import { describe, expect, it } from 'vitest'
import {
  decodeCodexAuthLoginReply,
  decodeCodexAuthAttemptStatus,
  decodeCodexAuthLogoutReply,
  decodeCodexAuthStatus,
  decodeCodexSaveRequest,
} from '../src/client-contract.ts'

const usage = {
  rateLimits: [{
    id: 'codex',
    name: 'Codex',
    windows: [{ remainingPercent: 43, windowSeconds: 18_000 }],
  }],
}

describe('decodeCodexAuthStatus', () => {
  it('accepts signed-out and signed-in snapshots', () => {
    expect(decodeCodexAuthStatus({ status: 'signed-out' })).toEqual({ status: 'signed-out' })
    expect(decodeCodexAuthStatus({ status: 'signed-in', usage })).toEqual({
      status: 'signed-in',
      usage,
    })
  })

  it('rejects token-shaped fields and malformed usage', () => {
    expect(decodeCodexAuthStatus({
      status: 'signed-in',
      usage,
      accessToken: 'secret',
    })).toBeUndefined()
    expect(decodeCodexAuthStatus({ status: 'signed-in' })).toBeUndefined()
    expect(decodeCodexAuthStatus({ status: 'loading' })).toBeUndefined()
  })
})

describe('decodeCodexAuthLoginReply', () => {
  it('accepts an http(s) popup URL and rejects secrets', () => {
    expect(decodeCodexAuthLoginReply({ url: 'https://chatgpt.com/oauth' })).toEqual({
      url: 'https://chatgpt.com/oauth',
    })
    expect(decodeCodexAuthLoginReply({ url: 'javascript:alert(1)' })).toBeUndefined()
    expect(decodeCodexAuthLoginReply({
      url: 'https://chatgpt.com/oauth',
      refresh_token: 'secret',
    })).toBeUndefined()
  })
})

describe('decodeCodexAuthAttemptStatus', () => {
  it('accepts terminal states and rejects secrets', () => {
    expect(decodeCodexAuthAttemptStatus({ status: 'pending' })).toEqual({ status: 'pending' })
    expect(decodeCodexAuthAttemptStatus({ status: 'missing' })).toEqual({ status: 'missing' })
    expect(decodeCodexAuthAttemptStatus({ status: 'succeeded', accessToken: 'secret' })).toBeUndefined()
  })
})

describe('decodeCodexAuthLogoutReply', () => {
  it('accepts ok and rejects token fields', () => {
    expect(decodeCodexAuthLogoutReply({ ok: true })).toEqual({ ok: true })
    expect(decodeCodexAuthLogoutReply({ ok: true, access_token: 'secret' })).toBeUndefined()
  })
})

describe('decodeCodexSaveRequest', () => {
  it('rejects a save payload that carries token fields', () => {
    expect(decodeCodexSaveRequest({
      models: [{ id: 'gpt-5.6-sol' }],
      expectedRevision: 1,
      accessToken: 'nope',
    })).toBeUndefined()
  })
})
