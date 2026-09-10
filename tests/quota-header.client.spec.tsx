// @vitest-environment jsdom
// Collapsed header quota: the mount read covers the header, expansion never refires
// the same read, and settled unavailability renders a dash, never a fabricated percent.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SettingsScopeSnapshot } from '../src/client/settings-scope.ts'
import { CodexPluginCard } from '../src/client/CodexPluginCard.tsx'
import type { CodexPluginCardProps } from '../src/client/CodexPluginCard.tsx'
import { providerUiCss } from '../src/client/provider-chrome.tsx'
import { en } from '../src/client/locales.ts'
import { clearProviderUsageCache, rememberHeadlineQuota } from 'dsh-llm-providers-ui/usage-readers'
import { DEFAULT_CODEX_SETTINGS } from '../src/client-contract.ts'
import type { CodexSettingsView } from '../src/client-contract.ts'

afterEach(() => { cleanup() })
// Each case starts with an empty shared cache: the dash cases assert "nothing was ever cached".
beforeEach(() => { clearProviderUsageCache() })

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
  it('paints the shared cached quota before any live answer arrives', async () => {
    clearProviderUsageCache()
    rememberHeadlineQuota('llm-codex', 'Codex', { label: 'Codex', remainingPercent: 64 })
    // The account read never settles: the cached value must be the only source.
    const readAuthStatus = vi.fn(() => new Promise<never>(() => undefined))
    render(<CodexPluginCard {...props({ readAuthStatus })} />)

    const meter = await screen.findByRole('meter', { name: 'Codex' })
    expect(meter.getAttribute('aria-valuenow')).toBe('64')
    clearProviderUsageCache()
  })

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

  it('emits the shared header stylesheet instead of a local header fork', () => {
    render(<CodexPluginCard {...props()} />)

    expect(document.querySelector('[data-provider-card-header]')?.getAttribute('style')).toBeNull()
    expect(document.querySelector('li[data-provider-card] > style')?.textContent).toBe(providerUiCss)
  })
})
