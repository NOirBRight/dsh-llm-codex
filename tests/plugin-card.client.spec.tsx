// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { CodexPluginCard } from '../src/client/CodexPluginCard.tsx'
import type { CodexAccountStatus, CodexPluginCardProps } from '../src/client/CodexPluginCard.tsx'
import { en } from '../src/client/locales.ts'
import {
  DEFAULT_CODEX_SEARCH_MODEL,
  DEFAULT_CODEX_SETTINGS,
} from '../src/client-contract.ts'
import type { CodexCatalogModel, CodexSettingsView } from '../src/client-contract.ts'

afterEach(() => { cleanup() })

const settings: CodexSettingsView = {
  ...DEFAULT_CODEX_SETTINGS,
  models: DEFAULT_CODEX_SETTINGS.models.map(model => ({ ...model })),
}

function snapshot(
  overrides: Partial<SettingsScopeSnapshot<CodexSettingsView>> = {},
): SettingsScopeSnapshot<CodexSettingsView> {
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
    t: key => en[key],
    useCodexSettings: selector => selector(current),
    readAuthStatus: vi.fn(() => Promise.resolve({ status: 'signed-out' } satisfies CodexAccountStatus)),
    startAuth: vi.fn(() => Promise.resolve({ url: 'https://chatgpt.com/oauth' })),
    logout: vi.fn(() => Promise.resolve()),
    fetchModels: vi.fn(() => Promise.resolve([])),
    saveConfiguration: vi.fn(next => Promise.resolve({ settings: next, revision: 2 })),
    beginModelPicker: vi.fn((_picked, onAdopt) => { adopt = onAdopt }),
    completeModelPicker: vi.fn(candidates => { adopt?.(candidates) }),
    failModelPicker: vi.fn(),
    closeModelPicker: vi.fn(),
    ...overrides,
  } as CodexPluginCardProps
}

function expand(): void {
  fireEvent.click(screen.getAllByRole('button', { expanded: false })[0]!)
}

function openCatalog(): void {
  fireEvent.click(screen.getByRole('button', { name: en.models }))
}

describe('CodexPluginCard', () => {
  it('keeps the model catalog and row details collapsed by default', async () => {
    render(<CodexPluginCard {...props()} />)
    expand()
    await waitFor(() => { expect(screen.getByText(en.signedOut)).toBeTruthy() })

    expect(document.querySelector('[data-model-row="gpt-5.6-sol"]')).toBeNull()
    openCatalog()
    expect(document.querySelector('[data-model-row="gpt-5.6-sol"]')).toBeTruthy()
    expect(screen.queryByLabelText(en.thinking)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en.modelDetails + ': gpt-5.6-sol' }))
    expect(screen.getByLabelText(en.thinking)).toBeTruthy()
    expect(screen.getByLabelText(en.vision)).toBeTruthy()
    expect(screen.getByLabelText(en.defaultEffort)).toBeTruthy()
    expect(screen.getByLabelText(en.contextWindow)).toBeTruthy()
    expect(screen.queryByLabelText(en.tools)).toBeNull()
    expect(screen.queryByLabelText('Fast')).toBeNull()
  })

  it('rereads usage when the card opens and when refresh is pressed', async () => {
    const readAuthStatus = vi.fn(async (): Promise<CodexAccountStatus> => ({
      status: 'signed-in',
      usage: { rateLimits: [] },
    }))
    render(<CodexPluginCard {...props({ readAuthStatus })} />)
    expand()
    await waitFor(() => { expect(readAuthStatus.mock.calls.length).toBeGreaterThanOrEqual(2) })
    fireEvent.click(screen.getByRole('button', { name: en.usageRefresh }))
    await waitFor(() => { expect(readAuthStatus.mock.calls.length).toBeGreaterThanOrEqual(3) })
  })

  it('does not offer sign-in while the host is still reading auth status', () => {
    const readAuthStatus = vi.fn(() => new Promise<CodexAccountStatus>(() => undefined))
    render(<CodexPluginCard {...props({ readAuthStatus })} />)
    expand()

    expect(screen.getByText(en.authLoading)).toBeTruthy()
    expect(screen.queryByRole('button', { name: en.signIn })).toBeNull()
  })

  it('lets the user cancel an abandoned host sign-in and try again', async () => {
    const readAuthStatus = vi.fn(async (): Promise<CodexAccountStatus> => ({ status: 'signing-in' }))
    const logout = vi.fn(async () => undefined)
    render(<CodexPluginCard {...props({ readAuthStatus, logout })} />)
    expand()

    await waitFor(() => { expect(screen.getByText(en.signingIn)).toBeTruthy() })
    expect(screen.queryByRole('button', { name: en.signIn })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en.cancel }))
    await waitFor(() => { expect(logout).toHaveBeenCalledTimes(1) })
    await waitFor(() => { expect(screen.getByRole('button', { name: en.signIn })).toBeTruthy() })
  })

  it('uses official non-Fast models in the search dropdown and defaults to Luna', async () => {
    render(<CodexPluginCard {...props({
      useCodexSettings: selector => selector(snapshot({
        value: { ...settings, enableSearch: true },
      })),
    })} />)
    expand()
    await waitFor(() => { expect(screen.getByText(en.signedOut)).toBeTruthy() })

    const select = screen.getByLabelText(en.searchModel) as HTMLSelectElement
    expect(select.value).toBe(DEFAULT_CODEX_SEARCH_MODEL)
    expect(DEFAULT_CODEX_SEARCH_MODEL).toBe('gpt-5.6-luna')
    const optionValues = [...select.options].map(option => option.value)
    expect(optionValues).toContain('gpt-5.6-luna')
    expect(optionValues).not.toContain('gpt-5.6-luna-fast')
  })
})
