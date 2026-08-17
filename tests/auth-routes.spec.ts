import type { IncomingMessage } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CodexWebAuth, trustedRequest } from '../src/auth-routes.ts'
import { CodexCredentialStore } from '../src/store.ts'
import { decodeCodexAuthStatus } from '../src/client-contract.ts'

let root: string | undefined

afterEach(async () => {
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

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
    const auth = new CodexWebAuth(new CodexCredentialStore(join(root, 'codex-oauth.json')))
    const status = await auth.status()
    expect(status).toEqual({ status: 'signed-out' })
    expect(decodeCodexAuthStatus(status)).toEqual({ status: 'signed-out' })
    expect(JSON.stringify(status)).not.toMatch(/access|refresh|token|Bearer/iu)
    await auth.dispose()
  })
})
