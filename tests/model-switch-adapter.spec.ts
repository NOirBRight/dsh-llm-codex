import { Context, Service } from '@deepseek-ai/cordis'
import type { WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web'
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
