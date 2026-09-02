/**
 * Codex standalone web search over the dsh web provider seam.
 */

import { createModels } from '@earendil-works/pi-ai'
import type { Models } from '@earendil-works/pi-ai'
import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex'
import { WebError } from '@deepseek-ai/dsh-web'
import type {
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResult,
  WebSearchSource,
} from '@deepseek-ai/dsh-web'
import { chatgptAccountIdFromToken } from './chatgpt-account.ts'
import type { CodexCredentialStore } from './store.ts'
import { OPENAI_CODEX_PROVIDER } from './store.ts'
import {
  CODEX_PROVIDER,
  DEFAULT_CODEX_SEARCH_CONTEXT_SIZE,
  DEFAULT_CODEX_SEARCH_MAX_OUTPUT_TOKENS,
  DEFAULT_CODEX_SEARCH_MODE,
  DEFAULT_CODEX_SEARCH_MODEL,
} from './client-contract.ts'
import type { CodexSearchContextSize, CodexSearchMode } from './client-contract.ts'

export {
  DEFAULT_CODEX_SEARCH_CONTEXT_SIZE,
  DEFAULT_CODEX_SEARCH_MAX_OUTPUT_TOKENS,
  DEFAULT_CODEX_SEARCH_MODE,
  DEFAULT_CODEX_SEARCH_MODEL,
}
export type { CodexSearchContextSize, CodexSearchMode }

export const CODEX_SEARCH_PROVIDER = CODEX_PROVIDER
export const CODEX_BASE_URL = 'https://chatgpt.com/backend-api/codex'
export const CODEX_SEARCH_URL = `${CODEX_BASE_URL}/alpha/search`

interface SearchRequestBody {
  readonly id: string
  readonly model: string
  readonly input: readonly [{
    readonly type: 'message'
    readonly role: 'user'
    readonly content: readonly [{ readonly type: 'input_text'; readonly text: string }]
  }]
  readonly commands: {
    readonly search_query: readonly [{ readonly q: string }]
  }
  readonly settings: {
    readonly search_context_size: CodexSearchContextSize
    readonly allowed_callers: readonly ['direct']
    readonly external_web_access: boolean | 'indexed'
  }
  readonly max_output_tokens: number
}

export interface CodexSearchProviderOptions {
  readonly credentials: CodexCredentialStore
  readonly model: string
  readonly mode: CodexSearchMode
  readonly contextSize: CodexSearchContextSize
  readonly maxOutputTokens: number
  readonly resolveRequestId: () => string
}

export function externalWebAccess(mode: CodexSearchMode): boolean | 'indexed' {
  switch (mode) {
    case 'cached': return false
    case 'indexed': return 'indexed'
    case 'live': return true
  }
}

function accountIdFromToken(access: string): string {
  try {
    return chatgptAccountIdFromToken(access)
  } catch (error: unknown) {
    throw new WebError('Codex search credential has no usable account id; sign in again', 'WEB_PROVIDER_CREDENTIAL_MISSING', { cause: error })
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function citeableUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : undefined
  } catch {
    return undefined
  }
}

export function mapCodexSearchResponse(value: unknown): WebSearchResult {
  if (!isRecord(value) || typeof value['output'] !== 'string') {
    throw new WebError('Codex returned a search response without string output', 'WEB_PROVIDER_ERROR')
  }
  const output = value['output']
  const rawResults = value['results']
  if (rawResults !== undefined && !Array.isArray(rawResults)) {
    throw new WebError('Codex returned a search response with non-array results', 'WEB_PROVIDER_ERROR')
  }
  const sources: WebSearchSource[] = []
  const seen = new Set<string>()
  for (const item of rawResults ?? []) {
    if (!isRecord(item) || item['type'] !== 'text_result') continue
    const url = citeableUrl(item['url'])
    if (url === undefined || seen.has(url)) continue
    seen.add(url)
    const title = optionalString(item, 'title')
    const snippet = optionalString(item, 'snippet')
    sources.push({
      url,
      ...title === undefined ? {} : { title },
      ...snippet === undefined ? {} : { snippet },
    })
  }
  return {
    ...output.length === 0 ? {} : { content: output },
    sources,
    truncated: false,
  }
}

function searchAborted(signal?: AbortSignal, fallback?: unknown): WebError {
  return new WebError('Codex search aborted', 'WEB_ABORTED', {
    cause: signal?.aborted === true ? signal.reason : fallback,
  })
}

function throwIfSearchAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw searchAborted(signal)
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function abortable<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal === undefined) return operation
  if (signal.aborted) return Promise.reject(searchAborted(signal))
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => { reject(searchAborted(signal)) }
    signal.addEventListener('abort', onAbort, { once: true })
    void operation.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

function providerMessage(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined
  const error = value['error']
  const raw = typeof error === 'string'
    ? error
    : isRecord(error) && typeof error['message'] === 'string'
      ? error['message']
      : typeof value['message'] === 'string' ? value['message'] : undefined
  return raw?.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, '[REDACTED]').slice(0, 1000)
}

export class CodexSearchProvider implements WebSearchProvider {
  readonly id = CODEX_SEARCH_PROVIDER
  private readonly models: Models

  constructor(private readonly options: CodexSearchProviderOptions) {
    const models = createModels({ credentials: options.credentials })
    models.setProvider(openaiCodexProvider())
    this.models = models
  }

  available(): boolean {
    return this.options.model.length > 0
      && Number.isInteger(this.options.maxOutputTokens)
      && this.options.maxOutputTokens > 0
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    throwIfSearchAborted(signal)
    let auth
    try {
      auth = await abortable(this.models.getAuth(OPENAI_CODEX_PROVIDER), signal)
    } catch (error: unknown) {
      throwIfSearchAborted(signal)
      if (isAbortError(error)) throw searchAborted(signal, error)
      throw new WebError('Codex search credential resolution failed', 'WEB_PROVIDER_ERROR', { cause: error })
    }
    const access = auth?.auth.apiKey
    if (access === undefined || access.length === 0) {
      throw new WebError('Codex search is signed out; sign in from Plugin configuration', 'WEB_PROVIDER_CREDENTIAL_MISSING')
    }
    const accountId = accountIdFromToken(access)
    throwIfSearchAborted(signal)

    const body: SearchRequestBody = {
      id: this.options.resolveRequestId(),
      model: this.options.model,
      input: [{
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: request.query }],
      }],
      commands: { search_query: [{ q: request.query }] },
      settings: {
        search_context_size: this.options.contextSize,
        allowed_callers: ['direct'],
        external_web_access: externalWebAccess(this.options.mode),
      },
      max_output_tokens: this.options.maxOutputTokens,
    }
    throwIfSearchAborted(signal)

    let response: Response
    try {
      response = await fetch(CODEX_SEARCH_URL, {
        method: 'POST',
        redirect: 'error',
        headers: {
          authorization: `Bearer ${access}`,
          'chatgpt-account-id': accountId,
          'content-type': 'application/json',
          accept: 'application/json',
          originator: 'deepseek-harness',
        },
        body: JSON.stringify(body),
        ...signal === undefined ? {} : { signal },
      })
    } catch (error: unknown) {
      throwIfSearchAborted(signal)
      if (isAbortError(error)) throw searchAborted(signal, error)
      throw new WebError('Codex search request failed', 'WEB_PROVIDER_ERROR', { cause: error })
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch (error: unknown) {
      throwIfSearchAborted(signal)
      if (isAbortError(error)) throw searchAborted(signal, error)
      throw new WebError(`Codex returned an unprocessable search response (HTTP ${response.status})`, 'WEB_PROVIDER_ERROR', { cause: error })
    }
    if (!response.ok) {
      const detail = providerMessage(payload)
      const message = detail === undefined
        ? `Codex search failed (HTTP ${response.status})`
        : `Codex search failed (HTTP ${response.status}): ${detail}`
      throw new WebError(
        response.status === 401 || response.status === 403
          ? `${message}; sign in again`
          : message,
        response.status === 401 || response.status === 403
          ? 'WEB_PROVIDER_CREDENTIAL_MISSING'
          : 'WEB_PROVIDER_ERROR',
      )
    }
    return mapCodexSearchResponse(payload)
  }
}
