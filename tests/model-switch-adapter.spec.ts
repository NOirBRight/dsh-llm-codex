import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import WebRuntime from '@deepseek-ai/dsh-web'
import type { WebSearchProvider, WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web'
import { describe, expect, it, vi } from 'vitest'
import { ModelSwitchAdapterRegistry } from 'dsh-model-switch/adapter-registry'
import { CodexSearchProvider } from '../src/search.ts'
import { CodexCredentialStore } from '../src/store.ts'
import { installCodexModelSwitchAdapters } from '../src/model-switch-adapter.ts'

const imageExecute = vi.hoisted(() => vi.fn())
vi.mock('../src/generate-image.ts', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/generate-image.ts')>()
  return { ...actual, generateImageTool: vi.fn(() => ({ execute: imageExecute })) }
})
class AttachmentsStub extends Service { constructor(ctx: Context) { super(ctx, 'attachments') } }
class FsStub extends Service { constructor(ctx: Context) { super(ctx, 'fs') } }
class Owner extends Service { readonly adapters = new ModelSwitchAdapterRegistry(); constructor(ctx: Context) { super(ctx, 'modelSwitch') } }
const settings = () => ({ searchMode: 'live' as const, searchContextSize: 'high' as const, searchMaxOutputTokens: 1000, models: [{ id: 'gpt-route', tools: true, vision: true }, { id: 'text-only', tools: true, vision: false }] })

describe('Codex Model Switch adapters', () => {
  it('registers Search and Image without Vision, delegates official request/signal, and disposes', async () => {
    const result: WebSearchResult = { content: 'answer', sources: [], truncated: false }
    const search = vi.spyOn(CodexSearchProvider.prototype, 'search').mockResolvedValue(result)
    imageExecute.mockResolvedValueOnce({ path: 'out.png', revisedPrompt: 'better', image: { attachmentId: 'a1', mediaType: 'image/png', bytes: 8, width: 2, height: 4, name: 'out.png' } })
    const root = new Context(); const attachments = root.plugin(AttachmentsStub); const fs = root.plugin(FsStub); await attachments; await fs; const owner = root.plugin(Owner); await owner
    const provider = root.plugin(ctx => installCodexModelSwitchAdapters(ctx, new CodexCredentialStore(), settings)); await provider
    const entry = root.modelSwitch.adapters.get('codex')
    expect(entry).toMatchObject({ provider: 'codex', search: { provider: 'codex' }, image: { provider: 'codex' } })
    expect(entry).not.toHaveProperty('vision')
    expect(entry?.search?.supportsModel('gpt-route')).toBe(true)
    const request: WebSearchRequest = { query: 'thin proxy', maxResults: 2 }; const signal = new AbortController().signal
    await expect(entry!.search!.search('gpt-route', request, signal)).resolves.toBe(result)
    expect(search).toHaveBeenCalledWith(request, signal)
    expect(entry?.image?.supportsModel('gpt-route')).toBe(true)
    expect(entry?.image?.supportsModel('text-only')).toBe(false)
    const execution = { signal } as never
    await expect(entry!.image!.generate('gpt-route', { prompt: 'draw', source: 'in.png', outputFormat: 'png' }, execution)).resolves.toEqual({ path: 'out.png', mediaType: 'image/png', bytes: 8, width: 2, height: 4, attachmentId: 'a1', name: 'out.png', revisedPrompt: 'better' })
    expect(imageExecute).toHaveBeenCalledWith({ prompt: 'draw', source: 'in.png', outputFormat: 'png' }, execution)
    await provider.dispose(); expect(root.modelSwitch.adapters.get('codex')).toBeUndefined(); await owner.dispose(); await fs.dispose(); await attachments.dispose(); search.mockRestore()
  })
  it('does nothing when Model Switch is absent', async () => { const root = new Context(); const provider = root.plugin(ctx => installCodexModelSwitchAdapters(ctx, new CodexCredentialStore(), settings)); await provider; await provider.dispose() })
})

/** Test-only fixed route with the parent router contract: supportsModel gate, loud errors, no fallback. */
class FixedCodexRoute implements WebSearchProvider {
  readonly id = 'codex'
  constructor(private readonly adapters: ModelSwitchAdapterRegistry, private readonly model: () => string) {}
  available(): boolean {
    const search = this.adapters.get('codex')?.search
    return search !== undefined && search.supportsModel(this.model())
  }
  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const search = this.adapters.get('codex')?.search
    if (search === undefined) throw new Error('missing search adapter: codex')
    if (!search.supportsModel(this.model())) throw new Error(`search model is not supported by adapter: codex/${this.model()}`)
    return search.search(this.model(), request, signal)
  }
}

const richSettings = () => ({
  searchMode: 'live' as const,
  searchContextSize: 'high' as const,
  searchMaxOutputTokens: 1000,
  models: [
    { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', tools: true, vision: true },
    { id: 'custom', tools: true },
    { id: 'no-tools', name: 'No Tools', tools: false },
  ],
})

async function setupRegistry(settingsFn: () => ReturnType<typeof richSettings> | undefined, store = new CodexCredentialStore()): Promise<{ root: Context; entry: NonNullable<ReturnType<ModelSwitchAdapterRegistry['get']>> }> {
  const root = new Context()
  const attachments = root.plugin(AttachmentsStub); const fs = root.plugin(FsStub); await attachments; await fs
  const owner = root.plugin(Owner); await owner
  const provider = root.plugin(ctx => installCodexModelSwitchAdapters(ctx, store, settingsFn)); await provider
  const entry = root.modelSwitch.adapters.get('codex')
  if (entry === undefined) throw new Error('codex adapters not registered')
  return { root, entry }
}

describe('Codex search capability metadata', () => {
  it('self-declares label/models while retaining the exact supportsModel rule', async () => {
    const { root, entry } = await setupRegistry(richSettings)
    const meta = entry.search as unknown as { label?: unknown; models?: unknown }
    expect(meta.label).toBe('Codex')
    expect(meta.models).toEqual([
      { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna' },
      { id: 'custom', name: 'custom' },
    ])
    expect(entry.search?.supportsModel('gpt-5.6-luna')).toBe(true)
    expect(entry.search?.supportsModel('custom')).toBe(true)
    expect(entry.search?.supportsModel('no-tools')).toBe(false)
    expect(entry.search?.supportsModel('unknown')).toBe(false)
    await root.fiber.dispose()
  })

  it('reflects current settings through the models getter', async () => {
    let models = [{ id: 'first', name: 'First' }]
    const { root, entry } = await setupRegistry(() => ({ searchMode: 'live' as const, searchContextSize: 'high' as const, searchMaxOutputTokens: 1000, models }))
    const meta = entry.search as unknown as { models?: { id: string; name: string }[] }
    expect(meta.models).toEqual([{ id: 'first', name: 'First' }])
    models = [{ id: 'second', name: 'Second' }]
    expect(meta.models).toEqual([{ id: 'second', name: 'Second' }])
    await root.fiber.dispose()
  })

  it('rejects unsupported models and unavailable settings without touching the provider', async () => {
    const search = vi.spyOn(CodexSearchProvider.prototype, 'search').mockResolvedValue({ content: 'unreached', sources: [], truncated: false })
    try {
      const { root, entry } = await setupRegistry(richSettings)
      await expect(entry.search!.search('nope', { query: 'x' })).rejects.toThrow('not supported')
      expect(search).not.toHaveBeenCalled()
      await root.fiber.dispose()
    } finally { search.mockRestore() }
    const missing = await setupRegistry(() => undefined)
    await expect(missing.entry.search!.search('gpt-5.6-luna', { query: 'x' })).rejects.toThrow('unavailable')
    await missing.root.fiber.dispose()
  })
})

describe('Codex search through official WebRuntime.search', () => {
  it('delegates the official request/signal and preserves the result', async () => {
    const result: WebSearchResult = { content: 'answer', sources: [], truncated: false }
    const search = vi.spyOn(CodexSearchProvider.prototype, 'search').mockResolvedValue(result)
    try {
      const { root } = await setupRegistry(richSettings)
      const web = root.plugin(WebRuntime); await web
      const route = new FixedCodexRoute(root.modelSwitch.adapters, () => 'gpt-5.6-luna')
      const bridge = root.plugin(ctx => { ctx.inject(['web'], scope => scope.effect(() => scope.web.registerSearchProvider(route), 'test: codex search route')) }); await bridge
      const request: WebSearchRequest = { query: 'thin proxy', maxResults: 2 }
      const signal = new AbortController().signal
      await expect(root.web.search(request, signal)).resolves.toBe(result)
      expect(search).toHaveBeenCalledWith(request, signal)
      await root.fiber.dispose()
    } finally { search.mockRestore() }
  })

  it('surfaces unsupported-model errors with no silent fallback', async () => {
    const search = vi.spyOn(CodexSearchProvider.prototype, 'search').mockResolvedValue({ content: 'unreached', sources: [], truncated: false })
    try {
      const { root } = await setupRegistry(richSettings)
      const web = root.plugin(WebRuntime); await web
      const route = new FixedCodexRoute(root.modelSwitch.adapters, () => 'nope')
      const bridge = root.plugin(ctx => { ctx.inject(['web'], scope => scope.effect(() => scope.web.registerSearchProvider(route), 'test: codex search route')) }); await bridge
      expect(route.available()).toBe(false)
      // Official selector rejects before dispatch; the router itself names the unsupported model.
      await expect(root.web.search({ query: 'x' })).rejects.toThrow('no usable web provider')
      await expect(route.search({ query: 'x' })).rejects.toThrow('not supported')
      expect(search).not.toHaveBeenCalled()
      await root.fiber.dispose()
    } finally { search.mockRestore() }
  })

  it('surfaces missing-credential errors from the real provider', async () => {
    // Isolated filename: never touches the developer credential file, never reaches the network.
    const dshHome = await mkdtemp(join(tmpdir(), 'dsh-llm-codex-search-creds-'))
    try {
      const { root } = await setupRegistry(richSettings, new CodexCredentialStore(join(dshHome, 'codex-auth.json')))
      const web = root.plugin(WebRuntime); await web
      const route = new FixedCodexRoute(root.modelSwitch.adapters, () => 'gpt-5.6-luna')
      const bridge = root.plugin(ctx => { ctx.inject(['web'], scope => scope.effect(() => scope.web.registerSearchProvider(route), 'test: codex search route')) }); await bridge
      expect(route.available()).toBe(true)
      await expect(root.web.search({ query: 'x' })).rejects.toMatchObject({ code: 'WEB_PROVIDER_CREDENTIAL_MISSING' })
      await root.fiber.dispose()
    } finally { await rm(dshHome, { recursive: true, force: true }) }
  })
})
