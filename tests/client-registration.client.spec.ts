// @vitest-environment jsdom

import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { apply, inject } from '../src/client/index.ts'
import { clearProviderUsageCache, peekCachedUsage, rememberHeadlineQuota } from 'dsh-llm-providers-ui/usage-readers'
import { CODEX_AUTH_ATTEMPT_STATUS_ENDPOINT, CODEX_AUTH_LOGOUT_ENDPOINT, CODEX_AUTH_STATUS_ENDPOINT, CODEX_MODELS_FETCH_ENDPOINT, CODEX_RPC_ENDPOINT, DEFAULT_CODEX_SETTINGS } from '../src/client-contract.ts'

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
  ctx.provide('configForms', {
    get: () => ({
      getSnapshot: () => ({
        status: 'ready',
        value: DEFAULT_CODEX_SETTINGS,
        base: {},
        user: {},
        revision: 1,
        writable: true,
        mode: 'host',
      }),
      subscribe: () => () => undefined,
    }),
  } as never)
  ctx.provide('connection', { rpc } as never)
  return { ctx, slots }
}

function endpointOfCall(args: readonly unknown[]): string | undefined {
  const wrapper = args[2]
  if (typeof wrapper !== 'object' || wrapper === null) return undefined
  const endpoint = (wrapper as Record<string, unknown>)['endpoint']
  return typeof endpoint === 'string' ? endpoint : undefined
}

describe('Codex client plugin registration', () => {
  it('declares the client services it consumes', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection', 'configForms'])
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
    const rpc = { call: vi.fn(async () => ({
      ok: true,
      value: { status: 'signed-out' },
    })) }
    const { ctx, slots } = await bench(rpc)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const face = slots.entries('settings.provider.item')[0]!.inject!() as { readAuthStatus: () => Promise<unknown> }

    await face.readAuthStatus()
    expect(rpc.call).toHaveBeenCalledWith('/api', CODEX_RPC_ENDPOINT, { endpoint: CODEX_AUTH_STATUS_ENDPOINT, payload: { refresh: true } }, undefined)

    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('fetches the model catalog through Host RPC', async () => {
    const rpc = { call: vi.fn(async (_channel: string, _method: string, wrapper: { endpoint: string }) => ({
      ok: true,
      value: wrapper.endpoint === CODEX_MODELS_FETCH_ENDPOINT
        ? [{ id: 'gpt-6-astra' }]
        : { status: 'signed-out' },
    })) }
    const { ctx, slots } = await bench(rpc)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const face = slots.entries('settings.provider.item')[0]!.inject!() as { fetchModels: () => Promise<unknown> }

    await expect(face.fetchModels()).resolves.toEqual([expect.objectContaining({ id: 'gpt-6-astra' })])
    expect(rpc.call).toHaveBeenCalledWith('/api', CODEX_RPC_ENDPOINT, { endpoint: CODEX_MODELS_FETCH_ENDPOINT, payload: {} }, undefined)

    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('falls back to the static catalog during a client-first rolling update', async () => {
    const rpc = { call: vi.fn(async (...args: unknown[]) => endpointOfCall(args) === CODEX_MODELS_FETCH_ENDPOINT
      ? { ok: false, error: { message: 'unknown Codex endpoint: models/fetch' } }
      : { ok: true, value: { status: 'signed-out' } }) }
    const { ctx, slots } = await bench(rpc)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const face = slots.entries('settings.provider.item')[0]!.inject!() as { fetchModels: () => Promise<readonly { id: string }[]> }

    await expect(face.fetchModels()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'gpt-5.6-sol' })]))

    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('keeps the static catalog when Host returns a malformed discovery reply', async () => {
    const rpc = { call: vi.fn(async (_channel: string, _method: string, wrapper: { endpoint: string }) => ({
      ok: true,
      value: wrapper.endpoint === CODEX_MODELS_FETCH_ENDPOINT
        ? { models: 'malformed' }
        : { status: 'signed-out' },
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

  it('purges persisted quota on logout without a provider directory', async () => {
    rememberHeadlineQuota('llm-codex', 'Codex', { label: 'W', remainingPercent: 72 })
    const { ctx, slots } = await bench({ call: async (...args: unknown[]) => endpointOfCall(args) === CODEX_AUTH_LOGOUT_ENDPOINT
      ? { ok: true, value: { ok: true } }
      : { ok: true, value: {} } })
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const face = slots.entries('settings.provider.item')[0]!.inject!() as { logout: () => Promise<unknown> }
    await face.logout()
    expect(peekCachedUsage('llm-codex')).toBeUndefined()
    clearProviderUsageCache()
    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('purges seeded quota on an authoritative signed-out status', async () => {
    const { ctx, slots } = await bench({ call: async () => ({ ok: true, value: { status: 'signed-out' } }) })
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    rememberHeadlineQuota('llm-codex', 'Codex', { label: 'W', remainingPercent: 72 })
    const face = slots.entries('settings.provider.item')[0]!.inject!() as { readAuthStatus: () => Promise<unknown> }
    await face.readAuthStatus()
    expect(peekCachedUsage('llm-codex')).toBeUndefined()
    clearProviderUsageCache()
    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('ignores a stale signed-out status that resolves after a new login', async () => {
    let resolveOld: ((value: unknown) => void) | undefined
    let statusCalls = 0
    const { ctx, slots } = await bench({ call: async (...args: unknown[]) => {
      if (endpointOfCall(args) === CODEX_AUTH_STATUS_ENDPOINT) {
        statusCalls += 1
        if (statusCalls === 2) return new Promise<unknown>(resolve => { resolveOld = resolve })
        return { ok: true, value: { status: 'signed-in' } }
      }
      if (endpointOfCall(args) === CODEX_AUTH_ATTEMPT_STATUS_ENDPOINT) return { ok: true, value: { status: 'succeeded' } }
      return { ok: true, value: {} }
    } })
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const face = slots.entries('settings.provider.item')[0]!.inject!() as {
      readAuthStatus: () => Promise<unknown>
      readAuthAttemptStatus: (attemptId: string) => Promise<unknown>
    }
    const old = face.readAuthStatus()
    await face.readAuthAttemptStatus('attempt-1')
    rememberHeadlineQuota('llm-codex', 'Codex', { label: 'W', remainingPercent: 73 })
    resolveOld?.({ ok: true, value: { status: 'signed-out' } })
    await expect(old).resolves.toEqual({ status: 'signed-out' })
    expect(peekCachedUsage('llm-codex')?.windows[0]?.remainingPercent).toBe(73)
    clearProviderUsageCache()
    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('purges persisted quota when a sign-in attempt succeeds', async () => {
    const { ctx, slots } = await bench({ call: async (...args: unknown[]) => endpointOfCall(args) === CODEX_AUTH_ATTEMPT_STATUS_ENDPOINT
      ? { ok: true, value: { status: 'succeeded' } }
      : { ok: true, value: {} } })
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    rememberHeadlineQuota('llm-codex', 'Codex', { label: 'W', remainingPercent: 72 })
    const face = slots.entries('settings.provider.item')[0]!.inject!() as { readAuthAttemptStatus: (attemptId: string) => Promise<unknown> }
    await face.readAuthAttemptStatus('attempt-1')
    expect(peekCachedUsage('llm-codex')).toBeUndefined()
    clearProviderUsageCache()
    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('does not publish a stale signed-out account after a later login', async () => {
    let resolveOld: ((value: unknown) => void) | undefined
    let statusCalls = 0
    let account = (): { state: string } => ({ state: 'unknown' })
    const { ctx, slots } = await bench({ call: async (...args: unknown[]) => {
      if (endpointOfCall(args) === CODEX_AUTH_STATUS_ENDPOINT) {
        statusCalls += 1
        if (statusCalls === 1) return new Promise<unknown>(resolve => { resolveOld = resolve })
        return { ok: true, value: { status: 'signed-in' } }
      }
      if (endpointOfCall(args) === CODEX_AUTH_ATTEMPT_STATUS_ENDPOINT) return { ok: true, value: { status: 'succeeded' } }
      return { ok: true, value: {} }
    } })
    ctx.provide('providerDirectory', {
      register: (declaration: { account?: () => { state: string } }) => {
        if (declaration.account !== undefined) account = declaration.account
        return () => undefined
      },
      update: () => undefined,
      invalidateUsage: () => undefined,
    } as never)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const face = slots.entries('settings.provider.item')[0]!.inject!() as {
      readAuthAttemptStatus: (attemptId: string) => Promise<unknown>
    }
    await face.readAuthAttemptStatus('attempt-1')
    expect(account()).toEqual({ state: 'connected' })
    resolveOld?.({ ok: true, value: { status: 'signed-out' } })
    await Promise.resolve()
    expect(account()).toEqual({ state: 'connected' })
    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('does not restore an account when an earlier sign-in poll finishes after logout', async () => {
    let resolveAttempt: ((value: unknown) => void) | undefined
    let account = (): { state: string } => ({ state: 'unknown' })
    const { ctx, slots } = await bench({ call: async (...args: unknown[]) => {
      if (endpointOfCall(args) === CODEX_AUTH_ATTEMPT_STATUS_ENDPOINT) return new Promise<unknown>(resolve => { resolveAttempt = resolve })
      if (endpointOfCall(args) === CODEX_AUTH_LOGOUT_ENDPOINT) return { ok: true, value: { ok: true } }
      if (endpointOfCall(args) === CODEX_AUTH_STATUS_ENDPOINT) return { ok: true, value: { status: 'signed-out' } }
      return { ok: true, value: {} }
    } })
    ctx.provide('providerDirectory', {
      register: (declaration: { account?: () => { state: string } }) => {
        if (declaration.account !== undefined) account = declaration.account
        return () => undefined
      },
      update: () => undefined,
      invalidateUsage: () => undefined,
    } as never)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const face = slots.entries('settings.provider.item')[0]!.inject!() as {
      readAuthAttemptStatus: (attemptId: string) => Promise<unknown>
      logout: () => Promise<void>
    }
    const poll = face.readAuthAttemptStatus('attempt-1')
    await face.logout()
    expect(account()).toEqual({ state: 'unconnected' })
    resolveAttempt?.({ ok: true, value: { status: 'succeeded' } })
    await expect(poll).resolves.toEqual({ status: 'succeeded' })
    expect(account()).toEqual({ state: 'unconnected' })
    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('drops a startup auth reply after the client plugin unloads', async () => {
    let resolveStatus: ((value: unknown) => void) | undefined
    let account = (): { state: string } => ({ state: 'unknown' })
    const { ctx } = await bench({ call: async (...args: unknown[]) => {
      if (endpointOfCall(args) === CODEX_AUTH_STATUS_ENDPOINT) return new Promise<unknown>(resolve => { resolveStatus = resolve })
      return { ok: true, value: {} }
    } })
    ctx.provide('providerDirectory', {
      register: (declaration: { account?: () => { state: string } }) => {
        if (declaration.account !== undefined) account = declaration.account
        return () => undefined
      },
      update: () => undefined,
      invalidateUsage: () => undefined,
    } as never)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(account()).toEqual({ state: 'unknown' })
    await fiber.dispose()
    resolveStatus?.({ ok: true, value: { status: 'signed-in' } })
    await Promise.resolve()
    expect(account()).toEqual({ state: 'unknown' })
    await ctx.fiber.dispose()
  })
})
