import type { IncomingMessage } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthInteraction } from '@earendil-works/pi-ai'
import { CodexWebAuth, trustedRequest } from '../src/auth-routes.ts'
import { openSystemBrowser } from '../src/open-browser.ts'
import { CodexCredentialStore } from '../src/store.ts'
import { decodeCodexAuthStatus } from '../src/client-contract.ts'

const loginCodex = vi.hoisted(() => vi.fn())

vi.mock('../src/auth.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/auth.ts')>()
  return { ...actual, loginCodex }
})

/** Same contract as pi-ai's browser login: emit a URL, then hang on manual_code. */
async function hangLikePiAiBrowserLogin(interaction: AuthInteraction, url: string): Promise<void> {
  interaction.notify({ type: 'auth_url', url })
  const local = new AbortController()
  try {
    await interaction.prompt({ type: 'manual_code', message: 'paste', signal: local.signal })
  } finally {
    local.abort()
  }
}

let root: string | undefined

afterEach(async () => {
  loginCodex.mockReset()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

function authStore(): CodexCredentialStore {
  return new CodexCredentialStore(join(root!, 'codex-oauth.json'))
}

function hangingAuth(openBrowser: (url: string) => Promise<void> = async () => {}): CodexWebAuth {
  let attempt = 0
  loginCodex.mockImplementation(async (interaction: AuthInteraction) => {
    attempt += 1
    await hangLikePiAiBrowserLogin(
      interaction,
      `https://auth.openai.com/oauth/authorize?attempt=${String(attempt)}`,
    )
  })
  return new CodexWebAuth(authStore(), { openBrowser })
}

function request(overrides: {
  remoteAddress?: string
  host?: string
  origin?: string
  site?: string
} = {}): IncomingMessage {
  return {
    socket: { remoteAddress: overrides.remoteAddress ?? '127.0.0.1' },
    headers: {
      host: overrides.host ?? '127.0.0.1:3080',
      ...overrides.origin === undefined ? {} : { origin: overrides.origin },
      ...overrides.site === undefined ? {} : { 'sec-fetch-site': overrides.site },
    },
  } as IncomingMessage
}

describe('trustedRequest', () => {
  it('allows same-origin loopback and rejects remote or cross-site callers', () => {
    expect(trustedRequest(request())).toBe(true)
    expect(trustedRequest(request({ origin: 'http://127.0.0.1:3080' }))).toBe(true)
    expect(trustedRequest(request({ remoteAddress: '192.168.50.75' }))).toBe(false)
    expect(trustedRequest(request({ site: 'cross-site' }))).toBe(false)
    expect(trustedRequest(request({ origin: 'https://evil.example' }))).toBe(false)
  })
})

describe('CodexWebAuth.status', () => {
  it('returns a secret-free signed-out snapshot', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-llm-codex-auth-'))
    const auth = new CodexWebAuth(authStore(), { openBrowser: async () => {} })
    const status = await auth.status()
    expect(status).toEqual({ status: 'signed-out' })
    expect(decodeCodexAuthStatus(status)).toEqual({ status: 'signed-out' })
    expect(JSON.stringify(status)).not.toMatch(/access|refresh|token|Bearer/iu)
    await auth.dispose()
  })

  it('lets a later client cancel an abandoned browser login and start again', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-llm-codex-auth-'))
    const auth = hangingAuth()
    await expect(auth.signIn()).resolves.toEqual({
      url: 'https://auth.openai.com/oauth/authorize?attempt=1',
      attemptId: expect.any(String),
    })
    await expect(auth.status()).resolves.toEqual({ status: 'signing-in' })

    await expect(auth.signOut()).resolves.toBeUndefined()
    await expect(auth.status()).resolves.toEqual({ status: 'signed-out' })

    await expect(auth.signIn()).resolves.toEqual({
      url: 'https://auth.openai.com/oauth/authorize?attempt=2',
      attemptId: expect.any(String),
    })
    await auth.signOut()
    await auth.dispose()
  })

  it('selects device-code login and returns a secret-free remote challenge', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-llm-codex-auth-'))
    let selected: string | undefined
    loginCodex.mockImplementation(async (interaction: AuthInteraction) => {
      selected = await interaction.prompt({
        type: 'select',
        message: 'method',
        options: [{ id: 'browser', label: 'Browser' }, { id: 'device_code', label: 'Device' }],
      })
      interaction.notify({
        type: 'device_code',
        verificationUri: 'https://auth.openai.com/codex/device',
        userCode: 'ABCD-EFGH',
        intervalSeconds: 5,
        expiresInSeconds: 900,
      })
      await interaction.prompt({ type: 'manual_code', message: 'wait' })
    })
    const auth = new CodexWebAuth(authStore())
    const challenge = await auth.signIn('device_code')
    expect(selected).toBe('device_code')
    expect(challenge).toMatchObject({
      verificationUri: 'https://auth.openai.com/codex/device',
      userCode: 'ABCD-EFGH',
      attemptId: expect.any(String),
    })
    expect(JSON.stringify(challenge)).not.toMatch(/access|refresh|token|Bearer/iu)
    expect(auth.cancel('stale-attempt')).toBe(false)
    expect(auth.cancel(challenge.attemptId)).toBe(true)
    await auth.dispose()
    expect(auth.attemptStatus(challenge.attemptId!)).toBe('cancelled')
  })

  it('opens the system browser with the authorization URL', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-llm-codex-auth-'))
    const opened: string[] = []
    const auth = hangingAuth(async url => { opened.push(url) })
    await expect(auth.signIn()).resolves.toEqual({
      url: 'https://auth.openai.com/oauth/authorize?attempt=1',
      attemptId: expect.any(String),
    })
    expect(opened).toEqual(['https://auth.openai.com/oauth/authorize?attempt=1'])
    await auth.signOut()
    await auth.dispose()
  })
})

describe('openSystemBrowser', () => {
  it('refuses non-http URLs', async () => {
    await expect(openSystemBrowser('javascript:alert(1)')).rejects.toThrow(/non-http/u)
  })
})
