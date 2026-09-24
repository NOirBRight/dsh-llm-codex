import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { CODEX_SAVE_ENDPOINT, CODEX_SETTINGS_ENTRY_ID, DEFAULT_CODEX_SETTINGS } from '../src/client-contract.ts'
import { createCodexManagementRpcHandler } from '../src/index.ts'

describe('Codex settings write validation', () => {
  it('rejects duplicate catalog model ids before the Host mutation', async () => {
    const mutate = vi.fn(async () => {})
    const ctx = new Context()
    ctx.provide('settings', {
      describe: () => [{ ns: CODEX_SETTINGS_ENTRY_ID, value: DEFAULT_CODEX_SETTINGS, revision: 1 }],
      mutate,
    } as never)
    const handler = createCodexManagementRpcHandler(ctx, {} as never, undefined, () => DEFAULT_CODEX_SETTINGS)

    const result = await handler(CODEX_SAVE_ENDPOINT, {
      ...DEFAULT_CODEX_SETTINGS,
      models: [DEFAULT_CODEX_SETTINGS.models[0], DEFAULT_CODEX_SETTINGS.models[0]],
      expectedRevision: 1,
    })

    expect(result.ok).toBe(false)
    expect(mutate).not.toHaveBeenCalled()
  })
})
