// @vitest-environment jsdom

import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { DEFAULT_CODEX_SETTINGS } from '../src/client-contract.ts'
import type { CodexSettingsView } from '../src/client-contract.ts'
import { apply, inject } from '../src/client/index.ts'

function scope(): SettingsScope<CodexSettingsView> {
  const snapshot: SettingsScopeSnapshot<CodexSettingsView> = {
    status: 'ready',
    value: DEFAULT_CODEX_SETTINGS,
    base: DEFAULT_CODEX_SETTINGS,
    user: {},
    revision: 1,
    writable: true,
    mode: 'host',
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    set: vi.fn(() => Promise.resolve()),
    unset: vi.fn(() => Promise.resolve()),
  }
}

interface SlotEntry {
  options: Record<string, unknown>
  inject?: () => unknown
}

class FakeSlots extends Service {
  private readonly registered: SlotEntry[] = []

  constructor(ctx: Context) { super(ctx, 'slots') }

  inject(_name: string, register: () => () => void): void { this.ctx.effect(register) }

  register(options: Record<string, unknown> & { inject?: () => unknown }, _component: unknown): () => void {
    const entry = { options, inject: options.inject }
    this.registered.push(entry)
    return () => { this.registered.splice(this.registered.indexOf(entry), 1) }
  }

  entries(name: string): readonly SlotEntry[] {
    return this.registered.filter(entry => entry.options['name'] === name)
  }
}

async function bench() {
  const ctx = new Context()
  await ctx.plugin(FakeSlots).await()
  const slots = ctx.get('slots') as FakeSlots
  ctx.provide('locale', {
    register: () => () => undefined,
    bind: () => (key: string) => key,
  } as never)
  ctx.provide('settingsScope', { bind: () => scope() } as never)
  ctx.provide('connection', { rpc: { call: async () => ({ ok: true, value: {} }) } } as never)
  return { ctx, slots }
}

describe('Codex client plugin registration', () => {
  it('declares only the client services it consumes', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection', 'settingsScope'])
  })

  it('registers the Providers section and card, then removes both with the plugin fiber', async () => {
    const { ctx, slots } = await bench()
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    expect(slots.entries('settings.section').map(e => e.options.id)).toEqual(['providers'])
    const entries = slots.entries('settings.provider.item')
    expect(entries).toHaveLength(1)
    expect(entries[0]?.options).toMatchObject({ key: 'llm-codex' })
    const face = (entries[0] as { inject?: () => unknown }).inject?.() as { hooks: Record<string, unknown> }
    expect(Object.keys(face.hooks)).toEqual(['codexSettings'])
    expect(slots.entries('settings.plugin.item')).toHaveLength(0)
    expect(slots.entries('shell.overlay')[0]?.options).toMatchObject({ id: 'codex-model-picker' })

    await fiber.dispose()

    expect(slots.entries('settings.provider.item')).toHaveLength(0)
    expect(slots.entries('settings.section')).toHaveLength(0)
    expect(slots.entries('shell.overlay')).toHaveLength(0)
    await ctx.fiber.dispose()
  })
})
