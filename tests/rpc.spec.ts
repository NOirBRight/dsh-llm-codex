import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { INVALID_CREDENTIAL_CODE, LlmError } from '@deepseek-ai/dsh-llm'
import { CodexCredentialStore } from '../src/store.ts'
import { CODEX_USAGE_URL, CodexReauthRequiredError, readCodexRateLimits } from '../src/usage.ts'
import {
  CODEX_SAVE_ENDPOINT,
  CODEX_MODELS_FETCH_ENDPOINT,
  CODEX_SETTINGS_ENTRY_ID,
  DEFAULT_CODEX_SETTINGS,
  decodeCodexSaveRequest,
  decodeCodexSaveResult,
  decodeCodexModelCatalog,
} from '../src/client-contract.ts'
import { createCodexManagementRpcHandler } from '../src/index.ts'

describe('createCodexManagementRpcHandler', () => {
  it('rejects unknown endpoints', async () => {
    const handler = createCodexManagementRpcHandler(new Context(), {} as never)
    const result = await handler('auth/status/unknown', undefined)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected unknown endpoint to fail')
    expect(result.error.message).toMatch(/unknown Codex endpoint/)
  })

  it('commits only llm-codex capability fields through one revision-fenced mutation', async () => {
    const current = {
      ...DEFAULT_CODEX_SETTINGS,
      models: DEFAULT_CODEX_SETTINGS.models.map(model => ({ ...model })),
    }
    let value = current
    let revision = 1
    const mutate = vi.fn(async (
      ns: string,
      ops: readonly { op: string, path: readonly string[], value: unknown }[],
      expected: number,
    ) => {
      expect(ns).toBe(CODEX_SETTINGS_ENTRY_ID)
      expect(expected).toBe(revision)
      const next = structuredClone(value) as Record<string, unknown>
      for (const op of ops) next[op.path[0] as string] = structuredClone(op.value)
      value = next as typeof current
      revision += 1
    })
    const ctx = new Context()
    ctx.provide('settings', {
      describe: () => [{ ns: CODEX_SETTINGS_ENTRY_ID, value, revision }],
      mutate,
    } as never)
    const handler = createCodexManagementRpcHandler(ctx, {} as never, undefined, () => current)

    const result = await handler(CODEX_SAVE_ENDPOINT, {
      models: current.models,
      enableSearch: true,
      enableImageTool: true,
      enableImageGeneration: true,
      searchModel: 'gpt-5.6-luna',
      imageGenerationModel: 'gpt-5.6-luna',
      searchMode: 'live',
      searchContextSize: 'medium',
      searchMaxOutputTokens: 10_000,
      expectedRevision: 1,
    })

    expect(decodeCodexSaveResult(result.ok ? result.value : undefined)).toMatchObject({
      settings: {
        enableSearch: true,
        enableImageTool: true,
        enableImageGeneration: true,
        searchModel: 'gpt-5.6-luna',
        imageGenerationModel: 'gpt-5.6-luna',
        searchMode: 'live',
      },
      revision: 2,
    })
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate.mock.calls[0]?.[1]).toEqual([
      { op: 'set', path: ['enableSearch'], value: true },
      { op: 'set', path: ['enableImageTool'], value: true },
      { op: 'set', path: ['enableImageGeneration'], value: true },
      { op: 'set', path: ['searchMode'], value: 'live' },
    ])
    expect(JSON.stringify(result)).not.toMatch(/accessToken|refreshToken|Bearer/u)
  })

  it('filters legacy ultra before a catalog can be saved', () => {
    const request = decodeCodexSaveRequest({
      models: [{
        id: 'gpt-6-astra',
        efforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'],
        defaultEffort: 'medium',
      }],
      expectedRevision: 1,
    })

    expect(request?.models[0]).toMatchObject({
      efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
      defaultEffort: 'medium',
    })
    expect(JSON.stringify(request)).not.toContain('ultra')
  })

  it('rejects a save payload that tries to send token fields', async () => {
    const handler = createCodexManagementRpcHandler(new Context(), {} as never)
    const result = await handler(CODEX_SAVE_ENDPOINT, {
      models: [{ id: 'gpt-5.6-sol' }],
      expectedRevision: 1,
      accessToken: 'nope',
    })
    expect(result.ok).toBe(false)
  })
})

describe('createCodexManagementRpcHandler', () => {
  it('forwards an explicit live-usage refresh to Codex auth', async () => {
    const status = vi.fn(async () => ({ status: 'signed-in' }))
    const handler = createCodexManagementRpcHandler(new Context(), { status } as never)

    await handler('auth/status', { refresh: true })

    expect(status).toHaveBeenCalledWith(true)
  })

  it('returns the dynamically refreshed model catalog', async () => {
    const fetchModels = vi.fn(async () => [{ id: 'gpt-6-astra', efforts: ['low', 'ultra'] }])
    const handler = createCodexManagementRpcHandler(new Context(), {} as never, fetchModels)

    const result = await handler(CODEX_MODELS_FETCH_ENDPOINT, {})

    expect(fetchModels).toHaveBeenCalledTimes(1)
    expect(decodeCodexModelCatalog(result.ok ? result.value : undefined)).toEqual([
      expect.objectContaining({ id: 'gpt-6-astra', efforts: ['low'] }),
    ])
  })
})

/** Answer one auth/status call whose Host auth fails with the given value. */
async function statusFailure(thrown: unknown) {
  const auth = { status: vi.fn(() => Promise.reject(thrown)) }
  const handler = createCodexManagementRpcHandler(new Context(), auth as never)
  const result = await handler('auth/status', { refresh: true })
  if (result.ok) throw new Error('expected the auth read to fail')
  return result.error
}

describe('Codex management failure codes', () => {
  it('answers a missing credential with the wire code the quota cache drops on', async () => {
    const error = await statusFailure(new LlmError('llm-codex: not signed in; sign in with ChatGPT', 'MISSING_CREDENTIAL'))
    expect(error.code).toBe(INVALID_CREDENTIAL_CODE)
  })

  it('answers an unusable stored credential with the same wire code', async () => {
    const error = await statusFailure(new LlmError('llm-codex: the stored credential could not be resolved', INVALID_CREDENTIAL_CODE))
    expect(error.code).toBe(INVALID_CREDENTIAL_CODE)
  })

  it('answers a session the issuer rejected with the same wire code', async () => {
    const error = await statusFailure(new CodexReauthRequiredError())
    expect(error.code).toBe(INVALID_CREDENTIAL_CODE)
  })

  it('keeps another LlmError code and redacts token-shaped messages', async () => {
    const bearer = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature'
    const error = await statusFailure(new LlmError('llm-codex: ChatGPT returned 429 for ' + bearer, 'RATE_LIMIT'))
    expect(error.code).toBe('RATE_LIMIT')
    expect(error.message).not.toContain(bearer)
    expect(error.message).toContain('[redacted token]')
  })

  it('keeps a non-LlmError failure internal instead of leaking it to the gateway', async () => {
    const error = await statusFailure(new Error('socket hang up'))
    expect(error.code).toBe('internal')
    expect(error.message).toBe('socket hang up')
  })

  it('maps a credential failure on the model catalog endpoint too', async () => {
    const fetchModels = vi.fn(() => Promise.reject(new LlmError('llm-codex: not signed in', 'MISSING_CREDENTIAL')))
    const handler = createCodexManagementRpcHandler(new Context(), {} as never, fetchModels)

    const result = await handler(CODEX_MODELS_FETCH_ENDPOINT, {})

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected the catalog read to fail')
    expect(result.error.code).toBe(INVALID_CREDENTIAL_CODE)
  })

  it.each([
    ['upstream 401', 401],
    ['upstream 403', 403],
  ])('maps a usage read rejected by the issuer (%s) onto the credential wire code', async (_label, status) => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-llm-codex-usage-rpc-'))
    try {
      const filename = join(root, 'codex-oauth.json')
      await writeFile(filename, JSON.stringify({
        version: 1,
        credential: {
          type: 'oauth',
          access: 'access-token',
          refresh: 'refresh-token',
          accountId: 'account-id',
          expires: Date.now() + 3_600_000,
        },
      }), { mode: 0o600 })
      vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status })))
      const store = new CodexCredentialStore(filename)
      expect(CODEX_USAGE_URL).toContain('chatgpt.com')
      const handler = createCodexManagementRpcHandler(new Context(), {
        status: () => readCodexRateLimits(store).then(usage => ({ status: 'signed-in', usage })),
      } as never)

      const result = await handler('auth/status', { refresh: true })

      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('expected the usage read to fail')
      expect(result.error.code).toBe(INVALID_CREDENTIAL_CODE)
    } finally {
      vi.unstubAllGlobals()
      await rm(root, { recursive: true, force: true })
    }
  })

  it.each([
    ['a 5xx response', () => new Response('', { status: 503 })],
    ['a network failure', () => { throw new TypeError('fetch failed') }],
  ])('keeps a transient usage failure (%s) internal', async (_label, respond) => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-llm-codex-usage-rpc-'))
    try {
      const filename = join(root, 'codex-oauth.json')
      await writeFile(filename, JSON.stringify({
        version: 1,
        credential: {
          type: 'oauth',
          access: 'access-token',
          refresh: 'refresh-token',
          accountId: 'account-id',
          expires: Date.now() + 3_600_000,
        },
      }), { mode: 0o600 })
      vi.stubGlobal('fetch', vi.fn(async () => respond()))
      const store = new CodexCredentialStore(filename)
      const handler = createCodexManagementRpcHandler(new Context(), {
        status: () => readCodexRateLimits(store).then(usage => ({ status: 'signed-in', usage })),
      } as never)

      const result = await handler('auth/status', { refresh: true })

      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('expected the usage read to fail')
      expect(result.error.code).toBe('internal')
    } finally {
      vi.unstubAllGlobals()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('keeps a failing sign-out answerable instead of throwing', async () => {
    const auth = { signOut: vi.fn(() => Promise.reject(new Error('codex: credential store is locked'))) }
    const handler = createCodexManagementRpcHandler(new Context(), auth as never)

    const result = await handler('auth/logout', {})

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected sign-out to fail')
    expect(result.error.code).toBe('internal')
  })
})
