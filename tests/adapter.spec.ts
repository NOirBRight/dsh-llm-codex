import { describe, expect, it } from 'vitest'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm'
import { applyCodexDefaultReasoningMetadata, classifyCodexTransientError } from '../src/adapter.ts'
import { resolveAdapterOptions } from '../src/index.ts'

function resolved(efforts: readonly string[]): LlmResolvedModelInfo {
  return {
    reasoning: {
      efforts: efforts.map(value => ({ id: ReasoningEffortId(value), name: value })),
    },
  } as LlmResolvedModelInfo
}

describe('Codex retry policy', () => {
  it('accepts an eight-retry provider policy', () => {
    expect(resolveAdapterOptions({
      retryPolicy: { mode: 'normal', maxRetries: 8 },
    }).retryPolicy).toMatchObject({ mode: 'normal', maxRetries: 8 })
  })
})

describe('classifyCodexTransientError', () => {
  it.each([
    'WebSocket closed',
    'WebSocket closed 1006',
    'WebSocket error',
    'WebSocket stream closed before response.completed',
  ])(
    'classifies %s as TRANSPORT',
    (message) => {
      const chunk: StreamChunk = {
        type: 'finish',
        reason: { kind: 'error', failure: { code: 'PI_AI_ERROR', message } },
      }

      expect(classifyCodexTransientError(chunk)).toMatchObject({
        type: 'finish',
        reason: { kind: 'error', failure: { code: 'TRANSPORT', message } },
      })
    },
  )

  it.each(['overloaded', 'Service unavailable'])(
    'classifies %s as SERVER',
    (message) => {
      const chunk: StreamChunk = {
        type: 'finish',
        reason: { kind: 'error', failure: { code: 'PI_AI_ERROR', message } },
      }

      expect(classifyCodexTransientError(chunk)).toMatchObject({
        type: 'finish',
        reason: { kind: 'error', failure: { code: 'SERVER', message } },
      })
    },
  )

  it.each(['WebSocket closed 1009', 'unknown provider failure', 'You have hit your ChatGPT usage limit']) (
    'leaves non-transient or ambiguous %s unchanged',
    (message) => {
      const chunk: StreamChunk = {
        type: 'finish',
        reason: { kind: 'error', failure: { code: 'PI_AI_ERROR', message } },
      }

      expect(classifyCodexTransientError(chunk)).toBe(chunk)
    },
  )
})

describe('applyCodexDefaultReasoningMetadata', () => {
  it('exposes the configured defaults only when the model supports them', () => {
    expect(applyCodexDefaultReasoningMetadata(resolved(['high', 'xhigh', 'max']), 'gpt-5.6-luna')
      .reasoning?.defaultEffort).toBe(ReasoningEffortId('max'))
    expect(applyCodexDefaultReasoningMetadata(resolved(['high', 'xhigh']), 'gpt-5.6-terra-fast')
      .reasoning?.defaultEffort).toBe(ReasoningEffortId('xhigh'))
    expect(applyCodexDefaultReasoningMetadata(resolved(['high', 'xhigh']), 'gpt-5.6-sol')
      .reasoning?.defaultEffort).toBe(ReasoningEffortId('high'))
    expect(applyCodexDefaultReasoningMetadata(resolved(['low', 'high', 'xhigh']), 'gpt-5.6-sol', 'low')
      .reasoning?.defaultEffort).toBe(ReasoningEffortId('low'))
  })

  it('does not advertise an unsupported custom-model default', () => {
    const info = resolved(['high'])
    expect(applyCodexDefaultReasoningMetadata(info, 'custom-model')).toBe(info)
  })
})
