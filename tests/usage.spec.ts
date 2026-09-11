import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OAuthCredential } from '@earendil-works/pi-ai'
import { INVALID_CREDENTIAL_CODE } from '@deepseek-ai/dsh-llm'
import { CodexCredentialStore } from '../src/store.ts'
import { isCodexCredentialFailure, parseCodexUsage, readCodexRateLimits } from '../src/usage.ts'

afterEach(() => { vi.unstubAllGlobals() })

let root: string | undefined
afterEach(async () => {
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

async function storeWith(credential: OAuthCredential | string): Promise<CodexCredentialStore> {
  root = await mkdtemp(join(tmpdir(), 'dsh-llm-codex-usage-'))
  const filename = join(root, 'codex-oauth.json')
  // Owner-only, or the store rejects the file mode before it reads the document.
  await writeFile(
    filename,
    typeof credential === 'string' ? credential : JSON.stringify({ version: 1, credential }),
    { mode: 0o600 },
  )
  return new CodexCredentialStore(filename)
}

/** The stored credential shape that resolves without a token refresh. */
function liveCredential(): OAuthCredential {
  return {
    type: 'oauth',
    access: 'access-token',
    refresh: 'refresh-token',
    accountId: 'account-id',
    expires: Date.now() + 3_600_000,
  }
}

async function credentialFailure(thrown: Promise<unknown>): Promise<unknown> {
  return await thrown.then(() => undefined, (error: unknown) => error)
}

describe('readCodexRateLimits credential resolution', () => {
  it('classifies a stored document it cannot use as a credential failure', async () => {
    const store = await storeWith('{"version":1,"credential":{"type":"oauth"}}\n')
    const error = await credentialFailure(readCodexRateLimits(store))

    expect(error).toMatchObject({ code: INVALID_CREDENTIAL_CODE })
    expect(isCodexCredentialFailure(error)).toBe(true)
  })

  it('leaves a refresh that fails on the network unresolved instead of logging the account out', async () => {
    // Inside the five-minute validity window, so resolving the credential refreshes it.
    const store = await storeWith({ ...liveCredential(), expires: Date.now() + 1_000 })
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('fetch failed'))))

    const error = await credentialFailure(readCodexRateLimits(store))

    expect(error).toBeInstanceOf(Error)
    expect((error as { code?: string }).code).not.toBe(INVALID_CREDENTIAL_CODE)
    expect(isCodexCredentialFailure(error)).toBe(false)
  })

  it('leaves a store that cannot be read unresolved instead of logging the account out', async () => {
    // A directory at the credential path fails the read with a plain I/O error, not a
    // verdict about the credential, so the caller keeps the last good quota.
    root = await mkdtemp(join(tmpdir(), 'dsh-llm-codex-usage-'))
    const filename = join(root, 'codex-oauth.json')
    await mkdir(filename, { mode: 0o700 })
    const store = new CodexCredentialStore(filename)

    const error = await credentialFailure(readCodexRateLimits(store))

    expect(error).toBeInstanceOf(Error)
    expect((error as { code?: string }).code).not.toBe(INVALID_CREDENTIAL_CODE)
    expect(isCodexCredentialFailure(error)).toBe(false)
  })

  it('classifies a credential the store refuses as a credential failure', async () => {
    const store = await storeWith(liveCredential())
    await rm(store.filename)
    await mkdir(store.filename, { mode: 0o755 })

    const error = await credentialFailure(readCodexRateLimits(store))

    expect(error).toMatchObject({ code: INVALID_CREDENTIAL_CODE })
    expect(isCodexCredentialFailure(error)).toBe(true)
  })
})

describe('parseCodexUsage', () => {
  it('projects remaining capacity from the official usage payload', () => {
    expect(parseCodexUsage({
      rate_limit: {
        primary_window: { used_percent: 25, limit_window_seconds: 18_000 },
        secondary_window: { used_percent: 10, limit_window_seconds: 604_800 },
      },
      additional_rate_limits: [
        {
          metered_feature: 'codex_other',
          limit_name: 'Other',
          rate_limit: {
            primary_window: { used_percent: 0, limit_window_seconds: 18_000 },
          },
        },
      ],
      credits: { has_credits: true, unlimited: false, balance: '12.5' },
      spend_control: {
        individual_limit: {
          limit: '100',
          used: '20',
          remaining: '80',
          remaining_percent: 80,
        },
      },
    })).toEqual({
      rateLimits: [
        {
          id: 'codex',
          name: 'Codex',
          windows: [
            { remainingPercent: 75, windowSeconds: 18_000 },
            { remainingPercent: 90, windowSeconds: 604_800 },
          ],
        },
        {
          id: 'codex_other',
          name: 'Other',
          windows: [{ remainingPercent: 100, windowSeconds: 18_000 }],
        },
      ],
      credits: { unlimited: false, balance: '12.5' },
      individualLimit: {
        limit: '100',
        used: '20',
        remaining: '80',
        remainingPercent: 80,
      },
    })
  })

  it('projects official reset_at and reset_after_seconds onto each window', () => {
    const now = Date.parse('2026-08-19T00:00:00.000Z')
    expect(parseCodexUsage({
      rate_limit: {
        primary_window: {
          used_percent: 25,
          limit_window_seconds: 18_000,
          reset_after_seconds: 3_600,
        },
        secondary_window: {
          used_percent: 10,
          limit_window_seconds: 604_800,
          reset_at: 1_787_270_400,
        },
      },
    }, now)).toEqual({
      rateLimits: [
        {
          id: 'codex',
          name: 'Codex',
          windows: [
            { remainingPercent: 75, windowSeconds: 18_000, resetsAt: '2026-08-19T01:00:00.000Z' },
            { remainingPercent: 90, windowSeconds: 604_800, resetsAt: '2026-08-21T00:00:00.000Z' },
          ],
        },
      ],
    })
  })

  it('merges multiple windows for the same additional metered feature', () => {
    expect(parseCodexUsage({
      additional_rate_limits: [
        {
          metered_feature: 'codex_bengalfox',
          limit_name: 'GPT-5.3-Codex-Spark',
          rate_limit: {
            primary_window: { used_percent: 0, limit_window_seconds: 18_000 },
          },
        },
        {
          metered_feature: 'codex_bengalfox',
          limit_name: 'GPT-5.3-Codex-Spark',
          rate_limit: {
            primary_window: { used_percent: 0, limit_window_seconds: 604_800 },
          },
        },
      ],
    })).toEqual({
      rateLimits: [
        {
          id: 'codex_bengalfox',
          name: 'GPT-5.3-Codex-Spark',
          windows: [
            { remainingPercent: 100, windowSeconds: 18_000 },
            { remainingPercent: 100, windowSeconds: 604_800 },
          ],
        },
      ],
    })
  })
})
