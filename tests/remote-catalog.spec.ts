import { mkdir, mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { CodexCredentialStore, OPENAI_CODEX_PROVIDER } from '../src/store.ts'
import {
  CODEX_MODEL_CACHE_FILENAME,
  CODEX_MODELS_URL,
  refreshCodexModelCatalog,
} from '../src/remote-catalog.ts'

const remotePayload = {
  models: [
    {
      slug: 'gpt-6-astra',
      display_name: 'GPT-6-Astra',
      description: 'Our most capable model for complex, demanding work.',
      default_reasoning_level: 'medium',
      supported_reasoning_levels: [
        { effort: 'low' },
        { effort: 'medium' },
        { effort: 'high' },
        { effort: 'xhigh' },
        { effort: 'max' },
        { effort: 'ultra' },
      ],
      visibility: 'list',
      supported_in_api: true,
      additional_speed_tiers: ['fast'],
      input_modalities: ['text', 'image'],
      context_window: 272_000,
      max_context_window: 872_000,
    },
    {
      slug: 'gpt-reserve',
      display_name: 'GPT-Reserve',
      visibility: 'hide',
      supported_in_api: true,
      context_window: 272_000,
    },
  ],
}

async function authenticatedStore(root: string): Promise<CodexCredentialStore> {
  const store = new CodexCredentialStore(join(root, 'codex-oauth.json'))
  await store.modify(OPENAI_CODEX_PROVIDER, async () => ({
    type: 'oauth',
    access: 'access-token',
    refresh: 'refresh-token',
    expires: Date.now() + 60 * 60_000,
    accountId: 'account-id',
  }))
  return store
}

describe('refreshCodexModelCatalog', () => {
  it('fetches new models and updates the local fallback catalog', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-codex-models-'))
    const store = await authenticatedStore(root)
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(remotePayload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))

    const models = await refreshCodexModelCatalog(store, request)

    expect(request).toHaveBeenCalledTimes(1)
    const [url, init] = request.mock.calls[0] ?? []
    expect(String(url)).toMatch(new RegExp('^' + CODEX_MODELS_URL.replace(/[.*+?^\$\{\}()|[\]\\]/gu, '\\$&') + '\\?client_version='))
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer access-token')
    expect(new Headers(init?.headers).get('chatgpt-account-id')).toBe('account-id')
    expect(models).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'gpt-6-astra',
        contextWindow: 272_000,
        defaultEffort: 'medium',
        efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
        thinking: true,
        vision: true,
      }),
      expect.objectContaining({ id: 'gpt-6-astra-fast', fast: true }),
      expect.objectContaining({ id: 'gpt-5.6-sol' }),
    ]))
    expect(models.some(model => model.id === 'gpt-reserve')).toBe(false)

    const cached = JSON.parse(await readFile(join(root, CODEX_MODEL_CACHE_FILENAME), 'utf8')) as { models: unknown[] }
    expect(cached.models).toEqual(models)
  })

  it('returns discovered models when only local cache persistence fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-codex-models-'))
    const store = await authenticatedStore(root)
    await mkdir(join(root, CODEX_MODEL_CACHE_FILENAME))

    await expect(refreshCodexModelCatalog(store, async () => new Response(JSON.stringify(remotePayload), { status: 200 })))
      .resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'gpt-6-astra' })]))
  })

  it('serves the dynamically updated local catalog when refresh fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-codex-models-'))
    const store = await authenticatedStore(root)
    const succeeds = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(remotePayload), { status: 200 }))
    await refreshCodexModelCatalog(store, succeeds)

    const cached = await refreshCodexModelCatalog(store, vi.fn<typeof fetch>(async () => { throw new Error('offline') }))

    expect(cached.some(model => model.id === 'gpt-6-astra')).toBe(true)
  })
})
