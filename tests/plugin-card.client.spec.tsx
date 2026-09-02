// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SettingsScopeSnapshot } from '../src/client/settings-scope.ts'
import { CodexPluginCard } from '../src/client/CodexPluginCard.tsx'
import type { CodexAccountStatus, CodexPluginCardProps } from '../src/client/CodexPluginCard.tsx'
import { en } from '../src/client/locales.ts'
import {
  DEFAULT_CODEX_SEARCH_MODEL,
  DEFAULT_CODEX_SETTINGS,
} from '../src/client-contract.ts'
import type { CodexCatalogModel, CodexSettingsView } from '../src/client-contract.ts'
import { catalogStyles } from '../src/client/model-catalog-ui.tsx'

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
    cancelAuth: vi.fn(() => Promise.resolve()),
    readAuthAttemptStatus: vi.fn(() => Promise.resolve({ status: 'pending' as const })),
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
  it('shows a browser challenge link when the popup is blocked', async () => {
    render(<CodexPluginCard {...props({ startAuth: vi.fn(() => Promise.resolve({ url: 'https://chatgpt.com/oauth' })) })} />)
    expand()
    await waitFor(() => { expect(screen.getByText(en.signedOut)).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: en.signIn }))
    await waitFor(() => { expect((screen.getByRole('link', { name: en.openChatGPT }) as HTMLAnchorElement).href).toBe('https://chatgpt.com/oauth') })
  })

  it('copies a device code and shows Copied', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<CodexPluginCard {...props({ startAuth: vi.fn(() => Promise.resolve({ verificationUri: 'https://chatgpt.com/device', userCode: 'ABCD-EFGH' })) })} />)
    expand()
    await waitFor(() => { expect(screen.getByText(en.signedOut)).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: en.signIn }))
    await waitFor(() => { expect(screen.getByRole('button', { name: en.copyCode })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: en.copyCode }))
    await waitFor(() => { expect(screen.getByRole('button', { name: en.copied })).toBeTruthy() })
    expect(writeText).toHaveBeenCalledWith('ABCD-EFGH')
  })

  it('clears a completed device challenge after sign-in succeeds', async () => {
    let signedIn = false
    const readAuthStatus = vi.fn(async () => signedIn
      ? { status: 'signed-in', usage: { rateLimits: [] } } satisfies CodexAccountStatus
      : { status: 'signed-out' } satisfies CodexAccountStatus)
    render(<CodexPluginCard {...props({
      readAuthStatus,
      startAuth: vi.fn(() => Promise.resolve({
        verificationUri: 'https://chatgpt.com/device',
        userCode: 'DONE-CODE',
        attemptId: 'attempt-done',
      })),
      readAuthAttemptStatus: vi.fn(async () => { signedIn = true; return { status: 'succeeded' as const } }),
    })} />)
    expand()
    await waitFor(() => { expect(screen.getByText(en.signedOut)).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: en.signIn }))
    await waitFor(() => { expect(screen.getByRole('button', { name: en.signOut })).toBeTruthy() })
    expect(screen.queryByText('DONE-CODE')).toBeNull()
    expect(screen.queryByRole('link', { name: en.openDevicePage })).toBeNull()
  })

  it('falls back to textarea copy when Clipboard API rejects', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const execCommand = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })
    render(<CodexPluginCard {...props({ startAuth: vi.fn(() => Promise.resolve({ verificationUri: 'https://chatgpt.com/device', userCode: 'REJECTED-CODE' })) })} />)
    expand()
    await waitFor(() => { expect(screen.getByText(en.signedOut)).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: en.signIn }))
    await waitFor(() => { expect(screen.getByRole('button', { name: en.copyCode })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: en.copyCode }))
    await waitFor(() => { expect(screen.getByRole('button', { name: en.copied })).toBeTruthy() })
    expect(execCommand).toHaveBeenCalledWith('copy')
    execCommand.mockRestore()
  })

  it('resets copied state for a new auth attempt', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(() => Promise.resolve()) } })
    let attempt = 0
    const startAuth = vi.fn(() => Promise.resolve({ verificationUri: 'https://chatgpt.com/device', userCode: ++attempt === 1 ? 'FIRST-CODE' : 'SECOND-CODE' }))
    const logout = vi.fn(() => Promise.resolve())
    render(<CodexPluginCard {...props({ startAuth, logout })} />)
    expand()
    await waitFor(() => { expect(screen.getByText(en.signedOut)).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: en.signIn }))
    await waitFor(() => { expect(screen.getByRole('button', { name: en.copyCode })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: en.copyCode }))
    await waitFor(() => { expect(screen.getByRole('button', { name: en.copied })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: en.cancel }))
    await waitFor(() => { expect(screen.getByRole('button', { name: en.signIn })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: en.signIn }))
    await waitFor(() => { expect(screen.getByRole('button', { name: en.copyCode })).toBeTruthy() })
    expect(screen.queryByRole('button', { name: en.copied })).toBeNull()
  })

  it('cancels only the active auth attempt without logging out', async () => {
    const cancelAuth = vi.fn(() => Promise.resolve())
    const logout = vi.fn(() => Promise.resolve())
    render(<CodexPluginCard {...props({ cancelAuth, logout, startAuth: vi.fn(() => Promise.resolve({ url: 'https://chatgpt.com/oauth', attemptId: 'attempt-1' })) })} />)
    expand()
    await waitFor(() => { expect(screen.getByText(en.signedOut)).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: en.signIn }))
    await waitFor(() => { expect(screen.getByRole('button', { name: en.cancel })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: en.cancel }))
    await waitFor(() => { expect(cancelAuth).toHaveBeenCalledWith('attempt-1') })
    expect(logout).not.toHaveBeenCalled()
  })

  it('keeps the model catalog and row details collapsed by default', async () => {
    render(<CodexPluginCard {...props()} />)
    expand()
    await waitFor(() => { expect(screen.getByText(en.signedOut)).toBeTruthy() })

    expect(document.querySelector('[data-model-row="gpt-5.6-sol"]')).toBeNull()
    openCatalog()
    expect(document.querySelector('[data-model-row="gpt-5.6-sol"]')).toBeTruthy()
    expect(screen.queryByLabelText(en.thinking)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en.modelDetails + ': gpt-5.6-sol' }))
    const contextInput = screen.getByLabelText(en.contextWindow) as HTMLInputElement
    const visionBox = screen.getByLabelText(en.vision) as HTMLInputElement
    const thinkingBox = screen.getByLabelText(en.thinking) as HTMLInputElement
    const defaultEffort = screen.getByLabelText(en.defaultEffort) as HTMLSelectElement
    // DOM order: Context first row then Vision -> Thinking -> Default thinking (opencode-go baseline)
    const pos = (a: Element, b: Element) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    expect(pos(contextInput, visionBox)).toBe(-1)
    expect(pos(visionBox, thinkingBox)).toBe(-1)
    expect(pos(thinkingBox, defaultEffort)).toBe(-1)
    // Context uses 36h inputStyle full width, select uses 32h selectStyle with arrow
    expect(catalogStyles.inputStyle.minHeight).toBe(36)
    expect(catalogStyles.selectStyle.minHeight).toBe(32)
    expect(contextInput.style.minHeight || getComputedStyle(contextInput).minHeight).toContain('36')
    expect(defaultEffort.style.minHeight || getComputedStyle(defaultEffort).minHeight).toContain('32')
    expect(defaultEffort.style.backgroundImage).toContain('svg')
    expect(defaultEffort.style.appearance).toBe('none')
    // shared tokens: rowInput 32h, modelDetail flex column, capabilities flex wrap
    expect(catalogStyles.rowInputStyle.minHeight).toBe(32)
    expect(catalogStyles.modelDetailStyle.flexDirection).toBe('column')
    expect(catalogStyles.modelDetailStyle.gap).toBe(10)
    expect(catalogStyles.capabilitiesStyle.display).toBe('flex')
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
    const cancelAuth = vi.fn(async () => undefined)
    render(<CodexPluginCard {...props({ readAuthStatus, logout, cancelAuth })} />)
    expand()

    await waitFor(() => { expect(screen.getByText(en.signingIn)).toBeTruthy() })
    expect(screen.queryByRole('button', { name: en.signIn })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en.cancel }))
    await waitFor(() => { expect(cancelAuth).toHaveBeenCalledTimes(1) })
    expect(logout).not.toHaveBeenCalled()
    await waitFor(() => { expect(screen.getByRole('button', { name: en.signIn })).toBeTruthy() })
  })

  it('labels named multi-window quotas by their window', async () => {
    const readAuthStatus = vi.fn(async (): Promise<CodexAccountStatus> => ({
      status: 'signed-in',
      usage: {
        rateLimits: [{
          id: 'codex_bengalfox',
          name: 'GPT-5.3-Codex-Spark',
          windows: [
            { remainingPercent: 100, windowSeconds: 18_000 },
            { remainingPercent: 100, windowSeconds: 604_800 },
          ],
        }],
      },
    }))
    render(<CodexPluginCard {...props({ readAuthStatus })} />)
    expand()
    await waitFor(() => {
      expect(screen.getByText(`GPT-5.3-Codex-Spark · ${en.fiveHourLimit}`)).toBeTruthy()
    })
    expect(screen.getByText(`GPT-5.3-Codex-Spark · ${en.weeklyLimit}`)).toBeTruthy()
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

  it('uses official vision models in the image-generation dropdown and defaults to Luna', async () => {
    render(<CodexPluginCard {...props({
      useCodexSettings: selector => selector(snapshot({
        value: { ...settings, enableImageGeneration: true },
      })),
    })} />)
    expand()
    await waitFor(() => { expect(screen.getByText(en.signedOut)).toBeTruthy() })

    const select = screen.getByLabelText(en.imageGenerationModel) as HTMLSelectElement
    expect(select.value).toBe('gpt-5.6-luna')
    const optionValues = [...select.options].map(option => option.value)
    expect(optionValues).toContain('gpt-5.6-luna')
    expect(optionValues).toContain('gpt-5.5')
    expect(optionValues).not.toContain('gpt-5.6-luna-fast')
    expect(optionValues).not.toContain('gpt-5.3-codex-spark')
  })
})
