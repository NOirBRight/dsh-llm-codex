import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import { SettingsProvider } from '@deepseek-ai/dsh-settings'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import * as Plugin from '../src/index.ts'
import { CODEX_PROVIDER, CODEX_SETTINGS_NAMESPACE } from '../src/client-contract.ts'

class MemorySettings extends SettingsProvider {
  readonly writable = true
  readonly writes: Record<string, unknown>[] = []
  protected async load(): Promise<Record<string, unknown>> {
    return {}
  }
  protected async persist(_ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.writes.push(structuredClone(section))
  }
}

let context: Context | undefined
let home: string | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (home !== undefined) await rm(home, { recursive: true, force: true })
  home = undefined
  vi.unstubAllEnvs()
})

async function boot(config: { models: { id: string }[] } = { models: [{ id: 'kept-model' }] }) {
  home = await mkdtemp(join(tmpdir(), 'dsh-settings-validate-'))
  vi.stubEnv('DSH_HOME', home)
  const ctx = new Context()
  context = ctx
  await ctx.plugin(MemorySettings).await()
  await ctx.plugin(LlmRuntime).await()
  await ctx.plugin(Plugin, config).await()
  return { ctx, settings: ctx.reflect.get('settings') as MemorySettings }
}

describe('settings mutate validation', () => {
  it('rejects duplicate catalog model ids and leaves saved and runtime state unchanged', async () => {
    const { ctx, settings } = await boot()
    const before = ctx.settings.describe().find(item => item.ns === CODEX_SETTINGS_NAMESPACE)
    expect(before).toBeDefined()
    const ids = (await ctx.llm.listModels(CODEX_PROVIDER)).map(model => model.id)
    expect(ids).toContain('kept-model')

    await expect(ctx.settings.mutate(CODEX_SETTINGS_NAMESPACE, [
      { op: 'set', path: ['models'], value: [{ id: 'kept-model' }, { id: 'kept-model' }] },
    ])).rejects.toThrow(/duplicate/)

    const after = ctx.settings.describe().find(item => item.ns === CODEX_SETTINGS_NAMESPACE)
    expect(after?.revision).toBe(before?.revision)
    expect(after?.value).toEqual(before?.value)
    expect(settings.writes).toHaveLength(0)
    expect((await ctx.llm.listModels(CODEX_PROVIDER)).map(model => model.id)).toEqual(ids)
  })
})
