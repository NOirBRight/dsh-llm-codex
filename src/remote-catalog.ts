/** Authenticated Codex model discovery with a DSH-local fallback cache. */

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { isCodexReasoningEffort, officialPickerCatalog } from './catalog.ts'
import type { CodexCatalogModel, CodexReasoningEffort } from './catalog.ts'
import { decodeCodexCatalogModel } from './client-contract.ts'
import { isRecord, nonEmptyStringValues, positiveSafeInteger } from './untrusted-data.ts'
import { resolveCodexAccessToken } from './adapter.ts'
import { OPENAI_CODEX_PROVIDER } from './store.ts'
import type { CodexCredentialStore } from './store.ts'

export const CODEX_MODELS_URL = 'https://chatgpt.com/backend-api/codex/models'
export const CODEX_MODEL_CACHE_FILENAME = 'codex-models.json'
const CACHE_FORMAT_VERSION = 1
const REQUEST_TIMEOUT_MS = 15_000
// NOTE: the endpoint validates semver today; configure this if OpenAI gates catalogs by client version.
const CLIENT_VERSION = '0.0.0'

function reasoningEfforts(value: unknown): CodexReasoningEffort[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item['effort'] !== 'string' || !isCodexReasoningEffort(item['effort'])) return []
    return [item['effort']]
  })
}

function remoteRows(value: unknown): CodexCatalogModel[] {
  if (!isRecord(value) || !Array.isArray(value['models'])) throw new Error('Codex returned an invalid model catalog')
  return value['models'].flatMap((entry): CodexCatalogModel[] => {
    if (!isRecord(entry)
      || entry['visibility'] !== 'list'
      || entry['supported_in_api'] !== true
      || typeof entry['slug'] !== 'string'
      || entry['slug'].length === 0) return []
    const id = entry['slug']
    const name = typeof entry['display_name'] === 'string' && entry['display_name'].length > 0 ? entry['display_name'] : id
    const efforts = reasoningEfforts(entry['supported_reasoning_levels'])
    const modalities = nonEmptyStringValues(entry['input_modalities'])
    const contextWindow = positiveSafeInteger(entry['context_window'])
    const maxTokens = positiveSafeInteger(entry['max_output_tokens'])
    const model: CodexCatalogModel = {
      id,
      name,
      ...typeof entry['description'] === 'string' && entry['description'].length > 0 ? { description: entry['description'] } : {},
      ...contextWindow === undefined ? {} : { contextWindow },
      ...maxTokens === undefined ? {} : { maxTokens },
      thinking: efforts.length > 0,
      ...efforts.length === 0 ? {} : { efforts },
      ...typeof entry['default_reasoning_level'] === 'string' && isCodexReasoningEffort(entry['default_reasoning_level'])
        ? { defaultEffort: entry['default_reasoning_level'] }
        : {},
      vision: modalities.includes('image'),
      tools: true,
    }
    const fast = nonEmptyStringValues(entry['additional_speed_tiers']).includes('fast')
      || (Array.isArray(entry['service_tiers']) && entry['service_tiers'].some(tier => isRecord(tier) && tier['id'] === 'priority'))
    return fast
      ? [model, { ...model, id: id + '-fast', name: name + ' Fast', fast: true }]
      : [model]
  })
}

function mergeCatalog(primary: readonly CodexCatalogModel[], fallback: readonly CodexCatalogModel[]): CodexCatalogModel[] {
  const merged = new Map<string, CodexCatalogModel>()
  for (const model of [...primary, ...fallback]) if (!merged.has(model.id)) merged.set(model.id, model)
  return [...merged.values()]
}

function cachePath(store: CodexCredentialStore): string {
  return join(dirname(store.filename), CODEX_MODEL_CACHE_FILENAME)
}

async function readCache(filename: string): Promise<CodexCatalogModel[] | undefined> {
  let value: unknown
  try {
    value = JSON.parse(await readFile(filename, 'utf8'))
  } catch {
    return undefined
  }
  if (!isRecord(value) || value['version'] !== CACHE_FORMAT_VERSION || !Array.isArray(value['models'])) return undefined
  const models = value['models'].map(decodeCodexCatalogModel)
  return models.every((model): model is CodexCatalogModel => model !== undefined) ? models : undefined
}

async function fetchRemoteCatalog(store: CodexCredentialStore, request: typeof fetch): Promise<CodexCatalogModel[]> {
  const access = await resolveCodexAccessToken(store)
  const credential = await store.read(OPENAI_CODEX_PROVIDER)
  const accountId = credential?.type === 'oauth' ? credential.accountId : undefined
  if (typeof accountId !== 'string' || accountId.length === 0) throw new Error('Codex authorization is unavailable')
  const response = await request(CODEX_MODELS_URL + '?client_version=' + CLIENT_VERSION, {
    method: 'GET',
    redirect: 'error',
    headers: {
      authorization: 'Bearer ' + access,
      'chatgpt-account-id': accountId,
      accept: 'application/json',
      originator: 'deepseek-harness',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const payload: unknown = await response.json()
  if (!response.ok) throw new Error('Codex model refresh failed (HTTP ' + String(response.status) + ')')
  return remoteRows(payload)
}

/** Fetch the live catalog, persist it locally, and fall back to the last known/static rows offline. */
export async function refreshCodexModelCatalog(
  store: CodexCredentialStore,
  request: typeof fetch = fetch,
): Promise<CodexCatalogModel[]> {
  const filename = cachePath(store)
  const fallback = mergeCatalog(await readCache(filename) ?? [], officialPickerCatalog())
  let remote: CodexCatalogModel[]
  try {
    remote = await fetchRemoteCatalog(store, request)
  } catch {
    return fallback
  }
  const models = mergeCatalog(remote, officialPickerCatalog())
  try {
    await writeFileAtomic(filename, JSON.stringify({ version: CACHE_FORMAT_VERSION, models }, null, 2) + '\n', {
      mode: 0o600,
      dirMode: 0o700,
    })
  } catch {}
  return models
}
