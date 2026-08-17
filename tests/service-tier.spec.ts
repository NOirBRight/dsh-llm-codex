import { describe, expect, it } from 'vitest'
import { applyCodexCatalogWire } from '../src/service-tier.ts'

describe('applyCodexCatalogWire', () => {
  it('rewrites Fast rows to the official model and service_tier', () => {
    expect(applyCodexCatalogWire({
      model: 'gpt-5.6-sol-fast',
      input: [],
    }, 'gpt-5.6-sol-fast')).toEqual({
      model: 'gpt-5.6-sol',
      input: [],
      service_tier: 'priority',
    })
  })

  it('applies after an existing onPayload rewrite the same way chat does', () => {
    const onPayload = (payload: unknown) => applyCodexCatalogWire(payload, 'gpt-5.6-luna-fast')
    expect(onPayload({
      model: 'gpt-5.6-luna-fast',
      input: [{ role: 'user', content: 'hi' }],
    })).toEqual({
      model: 'gpt-5.6-luna',
      input: [{ role: 'user', content: 'hi' }],
      service_tier: 'priority',
    })
  })

  it('leaves a normal row without a service tier', () => {
    expect(applyCodexCatalogWire({
      model: 'gpt-5.6-terra',
    }, 'gpt-5.6-terra')).toEqual({
      model: 'gpt-5.6-terra',
    })
  })
})
