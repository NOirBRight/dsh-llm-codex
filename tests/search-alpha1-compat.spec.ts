import { describe, expect, it, vi } from 'vitest'
import { CodexAdapter } from '../src/adapter.ts'
import {
  CODEX_CONNECT_SEARCH_MODEL_REQUEST_EVENT,
  CODEX_SEARCH_MODEL_REQUEST_EVENT,
  CodexSearchAlpha1Adapter,
  recordCodexSearchRequest,
} from '../src/search-event.ts'
import type { CodexSearchRequestRecord } from '../src/search.ts'

class CountingSet extends Set<string> {
  addCount = 0

  override add(value: string): this {
    this.addCount += 1
    return super.add(value)
  }
}

class AddThenThrowSet extends Set<string> {
  override add(value: string): this {
    super.add(value)
    throw new Error('compatibility probe failed after mutation')
  }
}


function hostModule(vocabulary: unknown, version: unknown = 0): object {
  return { KNOWN_SESSION_EVENT_TYPES: vocabulary, SESSION_FORMAT_VERSION: version }
}

function request(): CodexSearchRequestRecord {
  return {
    endpoint: 'https://chatgpt.com/backend-api/codex/alpha/search',
    body: {
      id: 'request-1',
      model: 'gpt-5.6-luna',
      input: [{
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'latest release' }],
      }],
      commands: { search_query: [{ q: 'latest release' }] },
      settings: { search_context_size: 'medium', allowed_callers: ['direct'], external_web_access: true },
      max_output_tokens: 2048,
    },
  }
}

describe('CodexSearchAlpha1Adapter', () => {
  it('registers both event names in both vocabularies', async () => {
    const local = new Set<string>()
    const host = new Set<string>()
    const adapter = new CodexSearchAlpha1Adapter({
      localVocabulary: local,
      hostSessionModule: hostModule(host),
      log: () => {},
    })

    await expect(adapter.install()).resolves.toEqual({ ok: true })
    expect(local).toEqual(new Set([CODEX_SEARCH_MODEL_REQUEST_EVENT, CODEX_CONNECT_SEARCH_MODEL_REQUEST_EVENT]))
    expect(host).toEqual(new Set([CODEX_SEARCH_MODEL_REQUEST_EVENT, CODEX_CONNECT_SEARCH_MODEL_REQUEST_EVENT]))
  })

  it('rejects a missing process entry and logs once', async () => {
    const log = vi.fn()
    const adapter = new CodexSearchAlpha1Adapter({ localVocabulary: new Set<string>(), argv: [], log })

    await expect(adapter.install()).resolves.toMatchObject({ ok: false, reason: /missing process\.argv/ })
    await expect(adapter.install()).resolves.toMatchObject({ ok: false, reason: /missing process\.argv/ })
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('rejects a Host module without the official event export', async () => {
    const log = vi.fn()
    const adapter = new CodexSearchAlpha1Adapter({
      localVocabulary: new Set<string>(),
      hostSessionModule: { SESSION_FORMAT_VERSION: 0 },
      log,
    })

    await expect(adapter.install()).resolves.toMatchObject({ ok: false, reason: /not a mutable Set/ })
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('rejects a Host module whose event export is not a Set', async () => {
    const log = vi.fn()
    const adapter = new CodexSearchAlpha1Adapter({
      localVocabulary: new Set<string>(),
      hostSessionModule: hostModule([]),
      log,
    })

    await expect(adapter.install()).resolves.toMatchObject({ ok: false, reason: /not a mutable Set/ })
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('rejects an unsupported session format', async () => {
    const log = vi.fn()
    const adapter = new CodexSearchAlpha1Adapter({
      localVocabulary: new Set<string>(),
      hostSessionModule: hostModule(new Set<string>(), 1),
      log,
    })

    await expect(adapter.install()).resolves.toMatchObject({ ok: false, reason: /official alpha\.1/ })
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('does not repeat Set.add calls or remove events', async () => {
    const local = new CountingSet()
    const host = new CountingSet()
    const adapter = new CodexSearchAlpha1Adapter({
      localVocabulary: local,
      hostSessionModule: hostModule(host),
      log: () => {},
    })

    await adapter.install()
    await adapter.install()
    expect(local.addCount).toBe(2)
    expect(host.addCount).toBe(2)
    expect([...local]).toEqual([CODEX_SEARCH_MODEL_REQUEST_EVENT, CODEX_CONNECT_SEARCH_MODEL_REQUEST_EVENT])
    expect([...host]).toEqual([CODEX_SEARCH_MODEL_REQUEST_EVENT, CODEX_CONNECT_SEARCH_MODEL_REQUEST_EVENT])
  })

  it('keeps partial Set.add mutations when Search degrades', async () => {
    const local = new Set<string>(['unrelated'])
    const host = new AddThenThrowSet()
    const adapter = new CodexSearchAlpha1Adapter({
      localVocabulary: local,
      hostSessionModule: hostModule(host),
      log: () => {},
    })

    await expect(adapter.install()).resolves.toMatchObject({ ok: false })
    expect([...local]).toEqual(['unrelated', CODEX_SEARCH_MODEL_REQUEST_EVENT, CODEX_CONNECT_SEARCH_MODEL_REQUEST_EVENT])
    expect([...host]).toEqual([CODEX_SEARCH_MODEL_REQUEST_EVENT])
  })
  it('degrades Search without preventing Codex chat construction', async () => {
    const adapter = new CodexSearchAlpha1Adapter({ localVocabulary: {}, log: () => {} })
    await expect(adapter.install()).resolves.toMatchObject({ ok: false })
    expect(new CodexAdapter({
      options: () => ({ models: [], streamIdleTimeoutMs: 30_000, retryPolicy: { mode: 'normal', maxRetries: 2 } }),
      resolveApiKey: async () => 'test-key',
    })).toBeInstanceOf(CodexAdapter)
  })

  it('replays the secret-free request through the session log', () => {
    const append = vi.fn()
    const ctx = {
      get: (name: string) => name === 'agents' ? { currentInitiator: () => ({ session: { append } }) } : undefined,
    } as never

    recordCodexSearchRequest(ctx, request())
    expect(append).toHaveBeenCalledWith(CODEX_SEARCH_MODEL_REQUEST_EVENT, request())
  })
})
