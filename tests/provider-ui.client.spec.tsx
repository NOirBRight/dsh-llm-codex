// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import type { SettingsScopeSnapshot } from '../src/client/settings-scope.ts'
import { CodexPluginCard } from '../src/client/CodexPluginCard.tsx'
import type { CodexAccountStatus, CodexPluginCardProps } from '../src/client/CodexPluginCard.tsx'
import { en } from '../src/client/locales.ts'
import { DEFAULT_CODEX_SETTINGS } from '../src/client-contract.ts'
import type { CodexCatalogModel, CodexSettingsView } from '../src/client-contract.ts'
import { apply, inject } from '../src/client/index.ts'
import { CODEX_AUTH_LOGOUT_ENDPOINT, CODEX_SETTINGS_NAMESPACE, CODEX_SETTINGS_READ_ENDPOINT } from '../src/client-contract.ts'

afterEach(() => { cleanup() })

const settings: CodexSettingsView = {
  ...DEFAULT_CODEX_SETTINGS,
  models: DEFAULT_CODEX_SETTINGS.models.map((model) => ({ ...model })),
}

function snapshot(overrides: Partial<SettingsScopeSnapshot<CodexSettingsView>> = {}): SettingsScopeSnapshot<CodexSettingsView> {
  return {
    status: 'ready',
    value: settings,
    base: settings,
    user: {},
    revision: 1,
    writable: true,
    mode: 'host',
    ...overrides,
  }
}

function props(overrides: Partial<CodexPluginCardProps> = {}): CodexPluginCardProps {
  const current = snapshot()
  let adopt: ((models: readonly CodexCatalogModel[]) => void) | undefined
  return {
    t: (key) => en[key],
    useCodexSettings: (selector) => selector(current),
    readAuthStatus: vi.fn(() => Promise.resolve({ status: 'signed-out' })) ,
    startAuth: vi.fn(() => Promise.resolve({ url: 'https://chatgpt.com/oauth' })),
    logout: vi.fn(() => Promise.resolve()),
    cancelAuth: vi.fn(() => Promise.resolve()),
    readAuthAttemptStatus: vi.fn(() => Promise.resolve({ status: 'pending' })),
    fetchModels: vi.fn(() => Promise.resolve([])),
    saveConfiguration: vi.fn((next) => Promise.resolve({ settings: next, revision: 2 })),
    beginModelPicker: vi.fn((_picked, onAdopt) => { adopt = onAdopt }),
    completeModelPicker: vi.fn((candidates) => { adopt?.(candidates) }),
    failModelPicker: vi.fn(),
    closeModelPicker: vi.fn(),
    ...overrides,
  } as CodexPluginCardProps
}

function expand(): void {
  fireEvent.click(screen.getAllByRole('button', { expanded: false })[0] as HTMLElement)
}

function openCatalog(): void {
  fireEvent.click(screen.getByRole('button', { name: en.models }))
}

describe('Codex selected-A provider chrome', () => {
  it('renders shared header chrome with role badge and real remaining quota', async () => {
    const readAuthStatus = vi.fn(() => Promise.resolve({
      status: 'signed-in',
      usage: { rateLimits: [{ id: 'primary', windows: [{ remainingPercent: 76, windowSeconds: 18000 }] }] },
    }))
    render(<CodexPluginCard {...props({ readAuthStatus })} />)
    expect(document.querySelector('[data-provider-card]')).toBeTruthy()
    expect(document.querySelector('[data-provider-card]')?.getAttribute('data-provider-role')).toBe('llm')
    expect(document.querySelector('[data-provider-card-header]')).toBeTruthy()
    expect(document.querySelector('[data-provider-role-badge]')?.getAttribute('data-provider-role-badge')).toBe('llm')
    expand()
    await waitFor(() => { expect(screen.getAllByRole('meter', { name: en.fiveHourLimit }).length).toBe(2) })
    expect(document.querySelector('[data-provider-body]')).toBeTruthy()
    expect(screen.getAllByRole('meter', { name: en.fiveHourLimit })[0]?.getAttribute('aria-valuenow')).toBe('76')
    expect(screen.getAllByText('76%').length).toBeGreaterThan(0)
    expect(document.querySelector('[data-provider-quota-meter]')).toBeTruthy()
  })

  it('renders no quota meter when usage is missing', async () => {
    render(<CodexPluginCard {...props()} />)
    expand()
    await waitFor(() => { expect(screen.getByText(en.signedOut)).toBeTruthy() })
    expect(document.querySelector('[data-provider-quota]')).toBeNull()
    expect(screen.queryByRole('meter')).toBeNull()
  })

  it('toggles model sort mode while keeping draft inputs mounted', async () => {
    render(<CodexPluginCard {...props()} />)
    expand()
    await waitFor(() => { expect(screen.getByText(en.signedOut)).toBeTruthy() })
    openCatalog()
    const firstInput = screen.getAllByPlaceholderText(en.modelId)[0] as HTMLInputElement
    fireEvent.change(firstInput, { target: { value: 'edited-model-id' } })
    expect(firstInput.value).toBe('edited-model-id')
    expect(document.querySelector('[data-sortable-move]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en.sortModels }))
    await waitFor(() => { expect(screen.getByRole('button', { name: en.doneSorting })).toBeTruthy() })
    expect(document.querySelectorAll('[data-sortable-move]').length).toBeGreaterThan(0)
    expect((screen.getAllByPlaceholderText(en.modelId)[0] as HTMLInputElement).value).toBe('edited-model-id')
    expect(document.querySelector('[data-provider-model]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en.doneSorting }))
    await waitFor(() => { expect(screen.getByRole('button', { name: en.sortModels })).toBeTruthy() })
    expect((screen.getAllByPlaceholderText(en.modelId)[0] as HTMLInputElement).value).toBe('edited-model-id')
  })
})

describe('Codex provider directory shared header', () => {
  it('registers header shared with its usage reader', async () => {
    class FakeSlots extends Service {
      private readonly registered: Array<{ options: Record<string, unknown> }> = []
      constructor(ctx: Context) { super(ctx, 'slots') }
      inject(_name: string, register: () => () => void): void { this.ctx.effect(register) }
      register(options: Record<string, unknown>, _component: unknown): () => void {
        this.registered.push({ options })
        return () => undefined
      }
    }
    const ctx = new Context()
    await ctx.plugin(FakeSlots).await()
    const register = vi.fn(() => () => undefined)
    ctx.provide('providerDirectory', { register } as never)
    ctx.provide('locale', { register: () => () => undefined, bind: () => (key: string) => key } as never)
    const rpc = { call: async (_c: string, e: string) => ({ ok: true, value: e === CODEX_SETTINGS_READ_ENDPOINT ? { settings: DEFAULT_CODEX_SETTINGS, revision: 1 } : { status: 'signed-out' } }) }
    ctx.provide('connection', { rpc } as never)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await waitFor(() => { expect(register).toHaveBeenCalled() })
    expect(register).toHaveBeenCalledWith(expect.objectContaining({ header: 'shared' }))
    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('purges sidebar quota after sign-out', async () => {
    class FakeSlots2 extends Service {
      private readonly registered: Array<{ options: Record<string, unknown>, inject?: () => unknown }> = []
      constructor(ctx: Context) { super(ctx, 'slots') }
      inject(_name: string, register: () => () => void): void { this.ctx.effect(register) }
      register(options: Record<string, unknown> & { inject?: () => unknown }, _component: unknown): () => void {
        this.registered.push({ options, inject: options.inject })
        return () => undefined
      }
      entries(name: string): Array<{ options: Record<string, unknown>, inject?: () => unknown }> {
        return this.registered.filter((entry) => entry.options['name'] === name)
      }
    }
    const ctx = new Context()
    await ctx.plugin(FakeSlots2).await()
    const slots = ctx.get('slots') as FakeSlots2
    const register = vi.fn(() => () => undefined)
    const invalidateUsage = vi.fn()
    ctx.provide('providerDirectory', { register, invalidateUsage } as never)
    ctx.provide('locale', { register: () => () => undefined, bind: () => (key: string) => key } as never)
    const rpc = { call: vi.fn(async (_c: string, e: string) => {
      if (e === CODEX_SETTINGS_READ_ENDPOINT) return { ok: true, value: { settings: DEFAULT_CODEX_SETTINGS, revision: 1 } }
      if (e === CODEX_AUTH_LOGOUT_ENDPOINT) return { ok: true, value: { ok: true } }
      return { ok: true, value: { status: 'signed-out' } }
    }) }
    ctx.provide('connection', { rpc } as never)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const face = slots.entries('settings.provider.item')[0]?.inject?.() as { logout: () => Promise<void> }
    await face.logout()
    expect(invalidateUsage).toHaveBeenCalledWith(CODEX_SETTINGS_NAMESPACE)
    await fiber.dispose()
    await ctx.fiber.dispose()
  })
})
