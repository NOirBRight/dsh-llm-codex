import { describe, expect, it } from 'vitest'
import { createCodexPiAiProfile } from '../src/pi-ai-profile.ts'

describe('Codex pi-ai profile', () => {
  it('exposes only Astra reasoning levels', () => {
    const model = {
      id: 'gpt-6-astra',
      thinking: true,
      efforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'],
      defaultEffort: 'medium',
    }
    const profile = createCodexPiAiProfile({
      models: [model],
      streamIdleTimeoutMs: 30_000,
      retryPolicy: { mode: 'normal', maxRetries: 8 },
    })

    expect(profile.piProvider.getModels()[0]?.thinkingLevelMap).toEqual({
      off: null,
      minimal: null,
      low: 'low',
      medium: 'medium',
      high: 'high',
      xhigh: 'xhigh',
      max: 'max',
    })
  })

  it('declares the official rc.2 request-image budgets', () => {
    const profile = createCodexPiAiProfile({
      models: [],
      streamIdleTimeoutMs: 30_000,
      retryPolicy: { mode: 'normal', maxRetries: 8 },
    })

    expect(profile).toMatchObject({
      requestImagePixelBudget: 2048 * 2048,
      requestImageMaxBytes: 1024 * 1024,
    })
  })
})
