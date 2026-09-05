// @vitest-environment jsdom

import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { apply, inject } from '../src/client/index.ts'
import { CODEX_AUTH_STATUS_ENDPOINT, CODEX_MODELS_FETCH_ENDPOINT, CODEX_SETTINGS_READ_ENDPOINT, DEFAULT_CODEX_SETTINGS } from '../src/client-contract.ts'

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

async function bench(rpc: { call: (...args: unknown[]) => Promise<unknown> } = { call: async () => ({ ok: true, value: {} }) }) {
  const ctx = new Context()
  await ctx.plugin(FakeSlots).await()
  const slots = ctx.get('slots') as FakeSlots
  ctx.provide('locale', {
    register: () => () => undefined,
    bind: () => (key: string) => key,
  } as never)
  ctx.provide('connection', { rpc } as never)
  return { ctx, slots }
}

describe('Codex client plugin registration', () => {
  it('declares only the client services it consumes', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection'])
  })

  it('reserves a real popup without noopener and severs opener before navigation', async () => {
    const opened = { opener: window, location: { href: 'about:blank' } }
    const open = vi.spyOn(window, 'open').mockReturnValue(opened as never)
    let resolveRpc: ((value: unknown) => void) | undefined
    const rpc = { call: vi.fn(() => new Promise(resolve => { resolveRpc = resolve })) }
    const { ctx, slots } = await bench(rpc)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const face = slots.entries('settings.provider.item')[0]!.inject!() as { startAuth: () => Promise<unknown> }
    const pending = face.startAuth()
    expect(open).toHaveBeenCalledWith('about:blank', '_blank')
    expect(opened.opener).toBeNull()
    resolveRpc!({ ok: true, value: { url: 'https://chatgpt.com/oauth' } })
    await pending
    expect(opened.location.href).toBe('https://chatgpt.com/oauth')
    open.mockRestore()
    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('requests live quota when the Codex card refreshes status', async () => {
    const rpc = { call: vi.fn(async (_channel: string, endpoint: string) => ({
      ok: true,
      value: endpoint === CODEX_SETTINGS_READ_ENDPOINT
        ? { settings: DEFAULT_CODEX_SETTINGS, revision: 1 }
        : { status: 'signed-out' },
    })) }
    const { ctx, slots } = await bench(rpc)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const face = slots.entries('settings.provider.item')[0]!.inject!() as { readAuthStatus: () => Promise<unknown> }

    await face.readAuthStatus()
    expect(rpc.call).toHaveBeenCalledWith('/codex', CODEX_AUTH_STATUS_ENDPOINT, { refresh: true }, undefined)

    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('fetches the model catalog through Host RPC', async () => {
    const rpc = { call: vi.fn(async (_channel: string, endpoint: string) => ({
      ok: true,
      value: endpoint === CODEX_SETTINGS_READ_ENDPOINT
        ? { settings: DEFAULT_CODEX_SETTINGS, revision: 1 }
        : [{ id: 'gpt-6-astra' }],
    })) }
    const { ctx, slots } = await bench(rpc)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const face = slots.entries('settings.provider.item')[0]!.inject!() as { fetchModels: () => Promise<unknown> }

    await expect(face.fetchModels()).resolves.toEqual([expect.objectContaining({ id: 'gpt-6-astra' })])
    expect(rpc.call).toHaveBeenCalledWith('/codex', CODEX_MODELS_FETCH_ENDPOINT, {})

    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('falls back to the static catalog during a client-first rolling update', async () => {
    const rpc = { call: vi.fn(async (_channel: string, endpoint: string) => endpoint === CODEX_SETTINGS_READ_ENDPOINT
      ? { ok: true, value: { settings: DEFAULT_CODEX_SETTINGS, revision: 1 } }
      : { ok: false, error: { message: 'unknown Codex endpoint: models/fetch' } }) }
    const { ctx, slots } = await bench(rpc)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const face = slots.entries('settings.provider.item')[0]!.inject!() as { fetchModels: () => Promise<readonly { id: string }[]> }

    await expect(face.fetchModels()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'gpt-5.6-sol' })]))

    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('keeps the static catalog when Host returns a malformed discovery reply', async () => {
    const rpc = { call: vi.fn(async (_channel: string, endpoint: string) => ({
      ok: true,
      value: endpoint === CODEX_SETTINGS_READ_ENDPOINT
        ? { settings: DEFAULT_CODEX_SETTINGS, revision: 1 }
        : { models: 'malformed' },
    })) }
    const { ctx, slots } = await bench(rpc)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const face = slots.entries('settings.provider.item')[0]!.inject!() as { fetchModels: () => Promise<readonly { id: string }[]> }

    await expect(face.fetchModels()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'gpt-5.6-sol' })]))

    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('registers only its provider card (Providers section owned by dsh-llm-providers-ui)', async () => {
    const { ctx, slots } = await bench()
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    expect(slots.entries('settings.section')).toHaveLength(0) // owned by dsh-llm-providers-ui
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
