import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  CODEX_SAVE_ENDPOINT,
  CODEX_SETTINGS_NAMESPACE,
  DEFAULT_CODEX_SETTINGS,
  decodeCodexSaveResult,
} from '../src/client-contract.ts'
import { createCodexRpcHandler } from '../src/index.ts'

describe('createCodexRpcHandler', () => {
  it('rejects unknown endpoints', async () => {
    const handler = createCodexRpcHandler(new Context())
    const result = await handler('auth/status', {})
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected unknown endpoint to fail')
    expect(result.error.message).toMatch(/unknown Codex endpoint/)
  })

  it('commits only llm-codex capability fields through one revision-fenced mutation', async () => {
    const current = {
      ...DEFAULT_CODEX_SETTINGS,
      models: DEFAULT_CODEX_SETTINGS.models.map(model => ({ ...model })),
    }
    let value = current
    let revision = 1
    const mutate = vi.fn(async (
      ns: string,
      ops: readonly { op: string, path: readonly string[], value: unknown }[],
      expected: number,
    ) => {
      expect(ns).toBe(CODEX_SETTINGS_NAMESPACE)
      expect(expected).toBe(revision)
      const next = structuredClone(value) as Record<string, unknown>
      for (const op of ops) next[op.path[0] as string] = structuredClone(op.value)
      value = next as typeof current
      revision += 1
    })
    const ctx = new Context()
    ctx.provide('settings', {
      describe: () => [{ ns: CODEX_SETTINGS_NAMESPACE, value, revision }],
      mutate,
    } as never)
    const handler = createCodexRpcHandler(ctx)

    const result = await handler(CODEX_SAVE_ENDPOINT, {
      models: current.models,
      enableSearch: true,
      enableImageTool: true,
      enableImageGeneration: true,
      searchModel: 'gpt-5.6-luna',
      imageGenerationModel: 'gpt-5.6-luna',
      searchMode: 'live',
      searchContextSize: 'medium',
      searchMaxOutputTokens: 10_000,
      expectedRevision: 1,
    })

    expect(decodeCodexSaveResult(result.ok ? result.value : undefined)).toMatchObject({
      settings: {
        enableSearch: true,
        enableImageTool: true,
        enableImageGeneration: true,
        searchModel: 'gpt-5.6-luna',
        imageGenerationModel: 'gpt-5.6-luna',
        searchMode: 'live',
      },
      revision: 2,
    })
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate.mock.calls[0]?.[1]).toEqual([
      { op: 'set', path: ['enableSearch'], value: true },
      { op: 'set', path: ['enableImageTool'], value: true },
      { op: 'set', path: ['enableImageGeneration'], value: true },
      { op: 'set', path: ['searchMode'], value: 'live' },
    ])
    expect(JSON.stringify(result)).not.toMatch(/accessToken|refreshToken|Bearer/u)
  })

  it('rejects a save payload that tries to send token fields', async () => {
    const handler = createCodexRpcHandler(new Context())
    const result = await handler(CODEX_SAVE_ENDPOINT, {
      models: [{ id: 'gpt-5.6-sol' }],
      expectedRevision: 1,
      accessToken: 'nope',
    })
    expect(result.ok).toBe(false)
  })
})
