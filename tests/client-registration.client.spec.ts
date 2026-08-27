// @vitest-environment jsdom

import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { apply, inject } from '../src/client/index.ts'

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
