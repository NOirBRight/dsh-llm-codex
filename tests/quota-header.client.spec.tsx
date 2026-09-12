// @vitest-environment jsdom
// Collapsed header quota: the mount read covers the header, expansion never refires
// the same read, and settled unavailability renders a dash, never a fabricated percent.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SettingsScopeSnapshot } from '../src/client/settings-scope.ts'
import { CodexPluginCard } from '../src/client/CodexPluginCard.tsx'
import type { CodexPluginCardProps } from '../src/client/CodexPluginCard.tsx'
import { providerUiCss } from '../src/client/provider-chrome.tsx'
import { en } from '../src/client/locales.ts'
import { DEFAULT_CODEX_SETTINGS } from '../src/client-contract.ts'
import { clearProviderUsageCache, peekCachedUsage, rememberHeadlineQuota } from 'dsh-llm-providers-ui/usage-readers'
import type { CodexSettingsView } from '../src/client-contract.ts'

afterEach(() => { cleanup(); clearProviderUsageCache() })

const settings: CodexSettingsView = {
  ...DEFAULT_CODEX_SETTINGS,
  models: DEFAULT_CODEX_SETTINGS.models.map((model) => ({ ...model })),
}

function snapshot(): SettingsScopeSnapshot<CodexSettingsView> {
  return {
    status: 'ready',
    value: settings,
    base: settings,
    user: {},
    revision: 1,
    writable: true,
    mode: 'host',
  }
}

function props(overrides: Partial<CodexPluginCardProps> = {}): CodexPluginCardProps {
  const current = snapshot()
  return {
    t: (key) => en[key],
    useCodexSettings: (selector) => selector(current),
    readAuthStatus: vi.fn(() => Promise.resolve({ status: 'signed-out' })),
    startAuth: vi.fn(() => Promise.resolve({ url: 'https://chatgpt.com/oauth' })),
    logout: vi.fn(() => Promise.resolve()),
    cancelAuth: vi.fn(() => Promise.resolve()),
    readAuthAttemptStatus: vi.fn(() => Promise.resolve({ status: 'pending' })),
    fetchModels: vi.fn(() => Promise.resolve([])),
    saveConfiguration: vi.fn((next) => Promise.resolve({ settings: next, revision: 2 })),
    beginModelPicker: vi.fn(),
    completeModelPicker: vi.fn(),
    failModelPicker: vi.fn(),
    closeModelPicker: vi.fn(),
    ...overrides,
  } as CodexPluginCardProps
}

function expand(): void {
  fireEvent.click(screen.getAllByRole('button', { expanded: false })[0] as HTMLElement)
}

describe('CodexPluginCard collapsed quota', () => {
  it('shows header quota while collapsed and does not reload on expansion', async () => {
    const readAuthStatus = vi.fn(() => Promise.resolve({
      status: 'signed-in',
      usage: { rateLimits: [{ id: 'primary', windows: [{ remainingPercent: 76, windowSeconds: 18000 }] }] },
    }))
    render(<CodexPluginCard {...props({ readAuthStatus })} />)

    const meter = await screen.findByRole('meter', { name: en.fiveHourLimit })
    expect(meter.getAttribute('aria-valuenow')).toBe('76')
    expect(readAuthStatus).toHaveBeenCalledTimes(1)

    expand()
    await waitFor(() => { expect(screen.getByRole('button', { name: en.usageRefresh })).toBeTruthy() })
    expect(readAuthStatus).toHaveBeenCalledTimes(1)
  })

  it('renders a collapsed unavailable dash when the quota query settles without usable windows', async () => {
    const readAuthStatus = vi.fn(() => Promise.resolve({
      status: 'signed-in',
      usage: { rateLimits: [] },
      quotaError: 'quota down',
    }))
    render(<CodexPluginCard {...props({ readAuthStatus })} />)

    await waitFor(() => { expect(document.querySelector('[data-provider-quota-mini] [data-provider-quota-missing]')).not.toBeNull() })
    expect(screen.queryByRole('meter')).toBeNull()
  })

  it('ignores seeded cache when the account has no usable quota surface', async () => {
    rememberHeadlineQuota('llm-codex', 'Codex', { remainingPercent: 76, label: 'seeded' })
    const readAuthStatus = vi.fn(() => Promise.resolve({
      status: 'signed-in',
      usage: { rateLimits: [] },
    }))
    render(<CodexPluginCard {...props({ readAuthStatus })} />)

    await waitFor(() => { expect(document.querySelector('[data-provider-quota-mini] [data-provider-quota-missing]')).not.toBeNull() })
    expect(screen.queryByRole('meter')).toBeNull()
  })

  it('paints the cached quota in the loading branch before the settings snapshot is ready', async () => {
    rememberHeadlineQuota('llm-codex', 'Codex', { remainingPercent: 64, label: 'W' })
    const useCodexSettings = (selector: (value: unknown) => unknown): unknown =>
      selector({ status: 'loading', value: undefined, base: {}, user: {}, revision: 0, writable: true, mode: 'host' })
    render(<CodexPluginCard {...props({
      readAuthStatus: vi.fn(() => new Promise<never>(() => {})),
      useCodexSettings,
    })} />)

    const meter = await screen.findByRole('meter')
    expect(meter.getAttribute('aria-valuenow')).toBe('64')
    expect(document.querySelector('[data-provider-quota-missing]')).toBeNull()
  })

  it('clears local usage on sign-out so a later failing reauth cannot resurrect it', async () => {
    const authed = (): Promise<unknown> => Promise.resolve({
      status: 'signed-in',
      usage: { rateLimits: [{ id: 'primary', windows: [{ remainingPercent: 76, windowSeconds: 18000 }] }] },
    })
    const view = render(<CodexPluginCard {...props({ readAuthStatus: vi.fn(authed) })} />)
    expect((await screen.findByRole('meter', { name: en.fiveHourLimit })).getAttribute('aria-valuenow')).toBe('76')
    view.rerender(<CodexPluginCard {...props({ readAuthStatus: vi.fn(() => Promise.resolve({ status: 'signed-out' })) })} />)
    await waitFor(() => { expect(screen.queryByRole('meter')).toBeNull() })
    view.rerender(<CodexPluginCard {...props({
      readAuthStatus: vi.fn(() => Promise.resolve({
        status: 'signed-in',
        usage: { rateLimits: [] },
        quotaError: 'quota down',
      })),
    })} />)
    await waitFor(() => { expect(document.querySelector('[data-provider-quota-mini] [data-provider-quota-missing]')).not.toBeNull() })
    expect(screen.queryByRole('meter')).toBeNull()
  })

  it('drops a superseded read after sign-out without resurrecting its account', async () => {
    const usageA = {
      status: 'signed-in',
      usage: { rateLimits: [{ id: 'primary', windows: [{ remainingPercent: 76, windowSeconds: 18000 }] }] },
    }
    const usageB = {
      status: 'signed-in',
      usage: { rateLimits: [{ id: 'other', windows: [{ remainingPercent: 10, windowSeconds: 18000 }] }] },
    }
    let resolveSecond!: (value: unknown) => void
    const second = new Promise<unknown>(value => {
      resolveSecond = value
    })
    const readAuthStatus = vi.fn().mockResolvedValueOnce(usageA).mockReturnValueOnce(second)
    render(<CodexPluginCard {...props({ readAuthStatus })} />)
    expect((await screen.findByRole('meter', { name: en.fiveHourLimit })).getAttribute('aria-valuenow')).toBe('76')
    fireEvent.click(screen.getAllByRole('button', { expanded: false })[0] as HTMLElement)
    fireEvent.click(await screen.findByRole('button', { name: en.usageRefresh }))
    expect(readAuthStatus).toHaveBeenCalledTimes(2)
    fireEvent.click(await screen.findByRole('button', { name: en.signOut }))
    resolveSecond(usageB)
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(screen.queryByRole('meter')).toBeNull()
  })

  it('drops a late read after unmount without caching it', async () => {
    expect(peekCachedUsage('llm-codex')).toBeUndefined()
    let resolveRead!: (value: unknown) => void
    const gate = new Promise<unknown>(value => {
      resolveRead = value
    })
    const readAuthStatus = vi.fn(() => gate)
    const view = render(<CodexPluginCard {...props({ readAuthStatus })} />)
    await waitFor(() => { expect(readAuthStatus).toHaveBeenCalledTimes(1) })
    view.unmount()
    resolveRead({
      status: 'signed-in',
      usage: { rateLimits: [{ id: 'primary', windows: [{ remainingPercent: 76, windowSeconds: 18000 }] }] },
    })
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(peekCachedUsage('llm-codex')).toBeUndefined()
  })

  it('labels unknown auth as loading with no fake count instead of not-signed-in', async () => {
    const readAuthStatus = vi.fn(() => new Promise<never>(() => {}))
    const useCodexSettings = (selector: (value: unknown) => unknown): unknown =>
      selector({ status: 'loading', value: undefined, base: {}, user: {}, revision: 0, writable: true, mode: 'host' })
    render(<CodexPluginCard {...props({ readAuthStatus, useCodexSettings })} />)
    await waitFor(() => { expect(readAuthStatus).toHaveBeenCalledTimes(1) })
    expect(document.querySelector('[data-provider-header-status]')?.textContent).toBe(en.authLoading)
    expect(document.querySelector('[data-provider-header-status]')?.textContent).not.toBe(en.summaryOff)
    expect(document.querySelector('[data-provider-header-summary]')?.textContent).toBe('')
  })

  it('emits the shared header stylesheet instead of a local header fork', () => {
    render(<CodexPluginCard {...props()} />)

    expect(document.querySelector('[data-provider-card-header]')?.getAttribute('style')).toBeNull()
    expect(document.querySelector('li[data-provider-card] > style')?.textContent).toBe(providerUiCss)
  })
})
