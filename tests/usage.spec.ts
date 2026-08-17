import { describe, expect, it } from 'vitest'
import { parseCodexUsage } from '../src/usage.ts'

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
})
