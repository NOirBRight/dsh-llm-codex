import { describe, expect, it } from 'vitest'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm'
import { applyCodexDefaultReasoningMetadata, classifyCodexTransientError, narrowCodexEscalationSchemas, streamWithAuthRetry } from '../src/adapter.ts'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import { resolveAdapterOptions } from '../src/index.ts'

function resolved(efforts: readonly string[]): LlmResolvedModelInfo {
  return {
    reasoning: {
      efforts: efforts.map(value => ({ id: ReasoningEffortId(value), name: value })),
    },
  } as LlmResolvedModelInfo
}


describe('narrowCodexEscalationSchemas', () => {
  const options = (mode: string) => ({
    provider: 'codex',
    model: 'gpt-5.6-sol',
    messages: [],
    system: 'Current DSH file policy: ' + mode + '.',
    tools: [{
      name: 'write',
      description: 'write',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
          sandbox_permissions: { type: 'string', enum: ['workspace-write', 'danger-full-access'] },
          justification: { type: 'string' },
        },
        required: ['file_path'],
      },
    }],
  })

  it('prefers the latest context injection over a stale system policy', () => {
    const request = options('workspace-write')
    request.messages = [{
      role: 'user',
      content: [{ type: 'text', text: 'Current DSH file policy: danger-full-access.' }],
    }] as never
    const narrowed = narrowCodexEscalationSchemas(request as never)
    const properties = (narrowed.tools?.[0]?.parameters as any).properties
    expect(properties.sandbox_permissions).toBeUndefined()
    expect(properties.justification).toBeUndefined()
  })

  it('reads the current mode from a DSH context-injection message', () => {
    const request = options('unknown')
    request.system = 'You are a coding agent.'
    request.messages = [{
      role: 'user',
      content: [{ type: 'text', text: 'Current DSH file policy: workspace-write. Writes are confined.' }],
    }] as never
    const narrowed = narrowCodexEscalationSchemas(request as never)
    expect((narrowed.tools?.[0]?.parameters as any).properties.sandbox_permissions.enum).toEqual(['danger-full-access'])
  })

  it('offers only strictly wider modes to a workspace-write session', () => {
    const original = options('workspace-write')
    const narrowed = narrowCodexEscalationSchemas(original as never)
    expect((narrowed.tools?.[0]?.parameters as any).properties.sandbox_permissions.enum).toEqual(['danger-full-access'])
    expect((narrowed.tools?.[0]?.parameters as any).properties.justification).toBeDefined()
    expect((original.tools[0]?.parameters as any).properties.sandbox_permissions.enum).toEqual(['workspace-write', 'danger-full-access'])
  })

  it('removes impossible escalation fields from a danger-full-access session', () => {
    const narrowed = narrowCodexEscalationSchemas(options('danger-full-access') as never)
    const parameters = narrowed.tools?.[0]?.parameters as any
    expect(parameters.properties.sandbox_permissions).toBeUndefined()
    expect(parameters.properties.justification).toBeUndefined()
    expect(parameters.required).toEqual(['file_path'])
  })

  it('keeps both wider modes available to a read-only session', () => {
    const narrowed = narrowCodexEscalationSchemas(options('read-only') as never)
    expect((narrowed.tools?.[0]?.parameters as any).properties.sandbox_permissions.enum)
      .toEqual(['workspace-write', 'danger-full-access'])
  })
})

describe('Codex retry policy', () => {
  it('resolves the host default and an explicit eight-retry provider policy', () => {
    expect(resolveAdapterOptions({}).retryPolicy).toMatchObject({ mode: 'normal', maxRetries: 2 })
    expect(resolveAdapterOptions({
      retryPolicy: { mode: 'normal', maxRetries: 8 },
    }).retryPolicy).toMatchObject({
      mode: 'normal',
      maxRetries: 8,
      retryableCodes: expect.arrayContaining(['AUTH']),
    })
  })
})

describe('streamWithAuthRetry', () => {
  const options = { provider: 'codex', model: 'gpt-5.6', messages: [] } as GenerateOptions
  const identity = (chunk: StreamChunk) => chunk

  it('refreshes and retries a usage-only AUTH finish', async () => {
    let calls = 0
    let refreshes = 0
    const stream = async function* (): AsyncGenerator<StreamChunk> {
      calls += 1
      if (calls === 1) {
        yield { type: 'usage', usage: { inputTokens: 1, outputTokens: 0 } }
        yield { type: 'finish', reason: { kind: 'error', failure: { code: 'AUTH', message: '401' } } }
        return
      }
      yield { type: 'text-delta', index: 0, text: 'ok' }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
    const chunks: StreamChunk[] = []
    for await (const chunk of streamWithAuthRetry(stream, options, identity, async () => {
      refreshes += 1
      return 'next'
    })) {
      chunks.push(chunk)
    }
    expect(calls).toBe(2)
    expect(refreshes).toBe(1)
    expect(chunks.some(chunk => chunk.type === 'usage')).toBe(false)
    expect(chunks).toMatchObject([
      { type: 'text-delta', text: 'ok' },
      { type: 'finish', reason: { kind: 'stop' } },
    ])
  })

  it('does not retry AUTH after model content', async () => {
    let calls = 0
    const stream = async function* (): AsyncGenerator<StreamChunk> {
      calls += 1
      yield { type: 'text-delta', index: 0, text: 'partial' }
      yield { type: 'finish', reason: { kind: 'error', failure: { code: 'AUTH', message: '401' } } }
    }
    const chunks: StreamChunk[] = []
    for await (const chunk of streamWithAuthRetry(stream, options, identity, async () => 'next')) {
      chunks.push(chunk)
    }
    expect(calls).toBe(1)
    expect(chunks).toMatchObject([
      { type: 'text-delta', text: 'partial' },
      { type: 'finish', reason: { kind: 'error', failure: { code: 'AUTH' } } },
    ])
  })

  it('rethrows abort during AUTH refresh instead of yielding AUTH', async () => {
    const stream = async function* (): AsyncGenerator<StreamChunk> {
      yield { type: 'finish', reason: { kind: 'error', failure: { code: 'AUTH', message: '401' } } }
    }
    const run = streamWithAuthRetry(stream, options, identity, async () => {
      throw Object.assign(new Error('stopped'), { name: 'AbortError' })
    })
    await expect(async () => {
      for await (const _chunk of run) { /* drain */ }
    }).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('classifyCodexTransientError', () => {
  it.each([
    'WebSocket closed',
    'WebSocket closed 1006',
    'WebSocket closed 1006 abnormal closure',
    'WebSocket closed 1011 internal error',
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

  it.each(['overloaded', 'Service unavailable', 'Codex error: websocket_connection_limit_reached'])(
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

  it.each([
    'Failed to extract accountId from token',
    'Invalid token',
    'No account ID in token',
    'OpenAI Codex token refresh failed',
  ])('classifies %s as AUTH', (message) => {
    const chunk: StreamChunk = {
      type: 'finish',
      reason: { kind: 'error', failure: { code: 'PI_AI_ERROR', message } },
    }

    expect(classifyCodexTransientError(chunk)).toMatchObject({
      type: 'finish',
      reason: { kind: 'error', failure: { code: 'AUTH', message } },
    })
  })

  it.each(['WebSocket closed 1009', 'WebSocket closed 1009 message too big', 'unknown provider failure', 'You have hit your ChatGPT usage limit']) (
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

describe('CodexAdapter.imageRequestPricing', () => {
  it('declares neutral request-image pricing', async () => {
    const { CodexAdapter } = await import('../src/adapter.ts')
    expect(Object.hasOwn(CodexAdapter.prototype, 'imageRequestPricing')).toBe(true)
    const adapter = new CodexAdapter({
      options: () => resolveAdapterOptions({}),
      resolveApiKey: () => Promise.resolve('test-key'),
    })
    expect(adapter.imageRequestPricing('codex', 'any-model')).toBeUndefined()
  })
})
