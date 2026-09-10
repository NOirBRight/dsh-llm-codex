import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { INVALID_CREDENTIAL_CODE } from '@deepseek-ai/dsh-llm'
import { CodexCredentialStore } from '../src/store.ts'
import { isCodexCredentialFailure, parseCodexUsage, readCodexRateLimits } from '../src/usage.ts'

describe('readCodexRateLimits credential resolution', () => {
  it('classifies a stored document it cannot use as a credential failure', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-llm-codex-usage-'))
    try {
      const filename = join(root, 'codex-oauth.json')
      await writeFile(filename, '{"version":1,"credential":{"type":"oauth"}}\n')
      const error: unknown = await readCodexRateLimits(new CodexCredentialStore(filename))
        .then(() => undefined, (thrown: unknown) => thrown)

      expect(error).toMatchObject({ code: INVALID_CREDENTIAL_CODE })
      expect(isCodexCredentialFailure(error)).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
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
