import { describe, expect, it } from 'vitest'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { LlmResolvedModelInfo } from '@deepseek-ai/dsh-llm'
import { applyCodexDefaultReasoningMetadata } from '../src/adapter.ts'

function resolved(efforts: readonly string[]): LlmResolvedModelInfo {
  return {
    reasoning: {
      efforts: efforts.map(value => ({ id: ReasoningEffortId(value), name: value })),
    },
  } as LlmResolvedModelInfo
}

describe('applyCodexDefaultReasoningMetadata', () => {
  it('exposes the configured defaults only when the model supports them', () => {
    expect(applyCodexDefaultReasoningMetadata(resolved(['high', 'xhigh', 'max']), 'gpt-5.6-luna')
      .reasoning?.defaultEffort).toBe(ReasoningEffortId('max'))
    expect(applyCodexDefaultReasoningMetadata(resolved(['high', 'xhigh']), 'gpt-5.6-terra-fast')
      .reasoning?.defaultEffort).toBe(ReasoningEffortId('xhigh'))
    expect(applyCodexDefaultReasoningMetadata(resolved(['high', 'xhigh']), 'gpt-5.6-sol')
      .reasoning?.defaultEffort).toBe(ReasoningEffortId('high'))
  })

  it('does not advertise an unsupported custom-model default', () => {
    const info = resolved(['high'])
    expect(applyCodexDefaultReasoningMetadata(info, 'custom-model')).toBe(info)
  })
})
