/**
 * Translate the displayed Codex catalog into a pi-ai profile on the public
 * `codex` route. Chat still uses openai-codex-responses; Fast rows rewrite
 * the wire model id and inject service_tier.
 */

import { createProvider } from '@earendil-works/pi-ai'
import type {
  Api,
  AssistantMessageEventStream,
  Context as PiContext,
  Model,
  Provider,
  ProviderStreams,
  SimpleStreamOptions,
  StreamOptions,
} from '@earendil-works/pi-ai'
import { openAICodexResponsesApi } from '@earendil-works/pi-ai/api/openai-codex-responses.lazy'
import type { OpenAICodexResponsesOptions } from '@earendil-works/pi-ai/api/openai-codex-responses'
import type { ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import type { ResolvedRetryPolicy } from '@deepseek-ai/dsh-llm'
import { effortsForCodexModel, officialModelFor, resolveWireModel } from './catalog.ts'
import { applyCodexWirePayload } from './service-tier.ts'
import { CODEX_PROVIDER } from './client-contract.ts'
import type { CodexCatalogModel } from './catalog.ts'
import { CODEX_CATALOG } from './client-contract.ts'

export const CODEX_CHAT_BASE_URL = 'https://chatgpt.com/backend-api'
export const CODEX_DEFAULT_CONTEXT_WINDOW = 272_000
export const CODEX_DEFAULT_MODEL_MAX_TOKENS = 128_000

const NO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

export interface CodexConnectionOptions {
  models: readonly CodexCatalogModel[]
  streamIdleTimeoutMs: number
  retryPolicy: ResolvedRetryPolicy
}

const CODEX_TRANSPORT_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const
function thinkingLevelMap(model: CodexCatalogModel): Model<'openai-codex-responses'>['thinkingLevelMap'] | undefined {
  const efforts = new Set(effortsForCodexModel(model))
  if (efforts.size === 0) return undefined
  const official = officialModelFor(model.id)
  return Object.fromEntries(CODEX_TRANSPORT_LEVELS.map(level => [
    level,
    level !== 'off' && efforts.has(level) ? official?.thinkingLevelMap[level] ?? level : null,
  ]))
}

function toPiAiModel(model: CodexCatalogModel): Model<'openai-codex-responses'> {
  const official = officialModelFor(model.id)
  const levels = thinkingLevelMap(model)
  return {
    id: model.id,
    name: model.name ?? model.id,
    api: 'openai-codex-responses',
    provider: CODEX_PROVIDER,
    baseUrl: CODEX_CHAT_BASE_URL,
    reasoning: model.thinking !== false,
    ...levels === undefined ? {} : { thinkingLevelMap: levels },
    input: model.vision === false ? ['text'] : official?.vision === false ? ['text'] : ['text', 'image'],
    cost: NO_COST,
    contextWindow: model.contextWindow ?? official?.contextWindow ?? CODEX_DEFAULT_CONTEXT_WINDOW,
    maxTokens: model.maxTokens ?? official?.maxTokens ?? CODEX_DEFAULT_MODEL_MAX_TOKENS,
    compat: {
      supportsDeveloperRole: false,
      supportsLongCacheRetention: false,
      supportsStrictMode: false,
      supportsOpenAIGrammarTools: true,
      supportsToolSearch: official?.id !== 'gpt-5.3-codex-spark',
      supportsExplicitPromptCacheMode: false,
    },
  }
}

function requestAuth(): Provider['auth'] {
  return {
    apiKey: {
      name: 'Codex OAuth bearer token',
      async resolve({ credential }) {
        const apiKey = credential?.key
        return apiKey === undefined || apiKey.length === 0
          ? undefined
          : { auth: { apiKey }, source: 'OAuth' }
      },
    },
  }
}

function withCodexWire<TOptions extends StreamOptions>(
  streamFn: (model: Model<Api>, context: PiContext, options?: TOptions) => AssistantMessageEventStream,
): (model: Model<Api>, context: PiContext, options?: TOptions) => AssistantMessageEventStream {
  return (model, context, options) => {
    const target = resolveWireModel(model.id)
    const original = options?.onPayload
    const nextOptions = {
      ...options,
      ...target.serviceTier === undefined ? {} : { serviceTier: target.serviceTier },
      onPayload: async (payload: unknown, nextModel: Model<Api>) => {
        const next = original === undefined ? payload : await original(payload, nextModel)
        return applyCodexWirePayload(next === undefined ? payload : next, target)
      },
    } as TOptions & OpenAICodexResponsesOptions
    return streamFn(model, context, nextOptions)
  }
}

export function codexResponsesApi(): ProviderStreams {
  const base = openAICodexResponsesApi()
  return {
    stream: withCodexWire<StreamOptions>(base.stream),
    streamSimple: withCodexWire<SimpleStreamOptions>(base.streamSimple),
  }
}

export function createCodexPiAiProfile(connection: CodexConnectionOptions): ResolvedPiAiProviderProfile {
  const source = connection.models.length > 0 ? connection.models : CODEX_CATALOG
  const models = source.map(model => toPiAiModel(model))
  const piProvider = createProvider({
    id: CODEX_PROVIDER,
    name: 'Codex',
    baseUrl: CODEX_CHAT_BASE_URL,
    auth: requestAuth(),
    models,
    api: codexResponsesApi(),
  })
  const profile = {
    provider: CODEX_PROVIDER,
    displayName: 'Codex',
    baseURL: CODEX_CHAT_BASE_URL,
    defaultContextWindow: CODEX_DEFAULT_CONTEXT_WINDOW,
    defaultMaxTokens: CODEX_DEFAULT_MODEL_MAX_TOKENS,
    defaultInput: ['text'] as ('text' | 'image')[],
    /** Mirrors the official total base64 image payload limit per request. */
    maxRequestImageBytes: 20 * 1024 * 1024,
    /** Required by the RC2 resolved-profile contract for deterministic request images. */
    requestImagePixelBudget: 2048 * 2048,
    requestImageMaxBytes: 1024 * 1024,
    streamIdleTimeoutMs: connection.streamIdleTimeoutMs,
    retryPolicy: connection.retryPolicy,
    piProvider,
    configuredMaxTokens: new Map(),
  }
  return profile
}
