/**
 * Register the `codex` provider, ChatGPT OAuth, sortable catalog, and
 * optional search / view_image / codex_generate_image capabilities.
 * @module dsh-llm-codex
 */

import { randomUUID } from 'node:crypto'
import type { Context, Fiber } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-client-connection'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import { resolveRetryPolicy, RetryPolicySchema } from '@deepseek-ai/dsh-llm'
import type { ResolvedRetryPolicy, RetryPolicyConfig } from '@deepseek-ai/dsh-llm'
import { deepEqualJson } from '@deepseek-ai/dsh-util-values'
import type { SettingsPathOp } from '@deepseek-ai/dsh-settings'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import { allowDshRuntime } from './compatibility.ts'
import type {} from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-web'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-fs'
import { CodexAdapter, refreshCodexAccessToken, resolveCodexAccessToken } from './adapter.ts'
import { CODEX_REASONING_EFFORTS, isCodexReasoningEffort } from './catalog.ts'
import type { CodexReasoningEffort } from './catalog.ts'
import type { CodexConnectionOptions } from './adapter.ts'
import { CodexWebAuth, registerCodexAuthRoutes } from './auth-routes.ts'
import { generateImageTool } from './generate-image.ts'
import { viewImageTool } from './view-image.ts'
import { CodexSearchProvider } from './search.ts'
import { CodexCredentialStore } from './store.ts'
import { refreshCodexModelCatalog } from './remote-catalog.ts'
import { isRecord } from './untrusted-data.ts'
import { installCodexModelSwitchAdapters } from './model-switch-adapter.ts'
import {
  CODEX_CATALOG,
  CODEX_DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  CODEX_PROVIDER,
  CODEX_RPC_CHANNEL,
  CODEX_SAVE_ENDPOINT,
  CODEX_SETTINGS_READ_ENDPOINT,
  CODEX_MODELS_FETCH_ENDPOINT,
  CODEX_AUTH_STATUS_ENDPOINT,
  CODEX_AUTH_BEGIN_ENDPOINT,
  CODEX_AUTH_CANCEL_ENDPOINT,
  CODEX_AUTH_ATTEMPT_STATUS_ENDPOINT,
  CODEX_AUTH_LOGOUT_ENDPOINT,
  CODEX_SETTINGS_NAMESPACE,
  DEFAULT_CODEX_IMAGE_GENERATION_MODEL,
  DEFAULT_CODEX_SEARCH_CONTEXT_SIZE,
  DEFAULT_CODEX_SEARCH_MAX_OUTPUT_TOKENS,
  DEFAULT_CODEX_SEARCH_MODE,
  DEFAULT_CODEX_SEARCH_MODEL,
  DEFAULT_CODEX_SETTINGS,
  decodeCodexSaveRequest,
  decodeCodexSettings,
} from './client-contract.ts'
import type { CodexCatalogModel, CodexSearchContextSize, CodexSearchMode } from './client-contract.ts'
import { hydrateCatalogModel } from './catalog.ts'

/** Preserve Codex's historical normal retry count across host-line default changes. */
const DEFAULT_MAX_RETRIES = 2

function withAuthRetries(policy: ResolvedRetryPolicy): ResolvedRetryPolicy {
  if (policy.mode !== 'normal') return policy
  if (policy.retryableCodes.includes('AUTH')) return policy
  return { ...policy, retryableCodes: Object.freeze([...policy.retryableCodes, 'AUTH']) }
}

export { CodexAdapter, refreshCodexAccessToken, resolveCodexAccessToken } from './adapter.ts'
export type { CodexAdapterOptions, CodexConnectionOptions } from './adapter.ts'
export {
  CODEX_CATALOG,
  CODEX_DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  CODEX_PROVIDER,
  CODEX_RPC_CHANNEL,
  CODEX_SAVE_ENDPOINT,
  CODEX_SETTINGS_READ_ENDPOINT,
  CODEX_MODELS_FETCH_ENDPOINT,
  CODEX_AUTH_STATUS_ENDPOINT,
  CODEX_AUTH_BEGIN_ENDPOINT,
  CODEX_AUTH_CANCEL_ENDPOINT,
  CODEX_AUTH_ATTEMPT_STATUS_ENDPOINT,
  CODEX_AUTH_LOGOUT_ENDPOINT,
  CODEX_SETTINGS_NAMESPACE,
  CODEX_AUTH_STATUS_PATH,
  CODEX_AUTH_LOGIN_PATH,
  CODEX_AUTH_LOGOUT_PATH,
  DEFAULT_CODEX_SETTINGS,
  DEFAULT_CODEX_SEARCH_CONTEXT_SIZE,
  DEFAULT_CODEX_SEARCH_MAX_OUTPUT_TOKENS,
  DEFAULT_CODEX_IMAGE_GENERATION_MODEL,
  DEFAULT_CODEX_SEARCH_MODE,
  DEFAULT_CODEX_SEARCH_MODEL,
  decodeCodexSettings,
  decodeCodexSaveRequest,
  decodeCodexSaveResult,
  decodeCodexCatalogModel,
  decodeCodexModelCatalog,
} from './client-contract.ts'
export type {
  CodexCatalogModel,
  CodexSaveRequest,
  CodexSaveResult,
  CodexSearchContextSize,
  CodexSearchMode,
  CodexSettingsView,
} from './client-contract.ts'
export {
  CODEX_FAST_SERVICE_TIER,
  CODEX_FAST_SUFFIX,
  CODEX_LARGE_CONTEXT_SUFFIX,
  CODEX_LARGE_CONTEXT_WINDOW,
  CODEX_OFFICIAL_MODELS,
  defaultDisplayedCatalog,
  officialImageGenerationModels,
  officialPickerCatalog,
  resolveWireModel,
  hydrateCatalogModel,
} from './catalog.ts'
export { CODEX_MODELS_URL, CODEX_MODEL_CACHE_FILENAME, refreshCodexModelCatalog } from './remote-catalog.ts'
export { applyCodexWirePayload, applyCodexCatalogWire } from './service-tier.ts'
export {
  CodexCredentialStore,
  CODEX_AUTH_FILENAME,
  OPENAI_CODEX_PROVIDER,
  codexAuthPath,
} from './store.ts'
export { loginCodex, logoutCodex, codexAuthStatus } from './auth.ts'
export type { CodexAuthStatus } from './auth.ts'
export {
  CODEX_USAGE_URL,
  parseCodexUsage,
  readCodexRateLimits,
  CodexReauthRequiredError,
  isCodexReauthRequiredError,
} from './usage.ts'
export type {
  CodexCredits,
  CodexIndividualLimit,
  CodexRateLimit,
  CodexRateLimitWindow,
  CodexUsage,
} from './usage.ts'
export {
  CodexSearchProvider,
  CODEX_BASE_URL,
  CODEX_SEARCH_PROVIDER,
  CODEX_SEARCH_URL,
  externalWebAccess,
  mapCodexSearchResponse,
} from './search.ts'
export { VIEW_IMAGE_TOOL_NAME } from './view-image.ts'
export { installCodexModelSwitchAdapters } from './model-switch-adapter.ts'
export { GENERATE_IMAGE_TOOL_NAME, generateImageTool } from './generate-image.ts'
export { createCodexPiAiProfile, CODEX_CHAT_BASE_URL, codexResponsesApi } from './pi-ai-profile.ts'
export { registerCodexAuthRoutes, trustedRequest, CodexWebAuth } from './auth-routes.ts'

export const name = 'llm-codex'
export const inject = ['llm']

const NS = CODEX_SETTINGS_NAMESPACE

export interface Config {
  streamIdleTimeoutMs?: number
  models?: CodexCatalogModel[]
  enableSearch?: boolean
  enableImageTool?: boolean
  enableImageGeneration?: boolean
  searchModel?: string
  imageGenerationModel?: string
  searchMode?: CodexSearchMode
  searchContextSize?: CodexSearchContextSize
  searchMaxOutputTokens?: number
  retryPolicy?: RetryPolicyConfig
  /** Set false when Model Switch owns stable tool names, preventing legacy duplicates. */
  registerLegacyTools?: boolean
}

/** Parse the retired on-disk literal without advertising it as a supported effort. */
const configuredEffort = z.transform(
  z.union([...CODEX_REASONING_EFFORTS, z.const('ultra').hidden()]),
  effort => isCodexReasoningEffort(effort) ? effort : undefined,
)
const configuredEfforts = z.transform(
  z.array(configuredEffort),
  efforts => efforts.filter(effort => effort !== undefined),
) as z<CodexReasoningEffort[]>

const catalogModel = z.object({
  id: z.string().required(),
  name: z.string(),
  description: z.string(),
  contextWindow: z.number().step(1).min(1),
  maxTokens: z.number().step(1).min(1),
  vision: z.boolean(),
  thinking: z.boolean(),
  defaultEffort: z.union(CODEX_REASONING_EFFORTS),
  efforts: configuredEfforts,
  tools: z.boolean(),
  fast: z.boolean(),
})

export const Config: z<Config> = z.object({
  streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(
    CODEX_DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  ),
  models: z.array(catalogModel),
  enableSearch: z.boolean().default(false),
  enableImageTool: z.boolean().default(false),
  enableImageGeneration: z.boolean().default(false),
  searchModel: z.string().default(DEFAULT_CODEX_SEARCH_MODEL),
  imageGenerationModel: z.string().default(DEFAULT_CODEX_IMAGE_GENERATION_MODEL),
  searchMode: z.union(['cached', 'indexed', 'live'] as const).default(DEFAULT_CODEX_SEARCH_MODE),
  searchContextSize: z.union(['low', 'medium', 'high'] as const).default(DEFAULT_CODEX_SEARCH_CONTEXT_SIZE),
  searchMaxOutputTokens: z.number().step(1).min(1).default(DEFAULT_CODEX_SEARCH_MAX_OUTPUT_TOKENS),
  retryPolicy: RetryPolicySchema,
  registerLegacyTools: z.boolean().default(true),
})

function resolveModels(models: readonly CodexCatalogModel[] | undefined): CodexCatalogModel[] {
  const seen = new Set<string>()
  return (models ?? CODEX_CATALOG).map((model) => {
    if (model.id.length === 0) throw new Error('llm-codex: catalog model ids must be non-empty')
    if (model.name !== undefined && model.name.length === 0) {
      throw new Error(`llm-codex: catalog model "${model.id}" has an empty name`)
    }
    if (seen.has(model.id)) throw new Error(`llm-codex: duplicate catalog model "${model.id}"`)
    seen.add(model.id)
    return hydrateCatalogModel(model)
  })
}

export function resolveAdapterOptions(config: Config): CodexConnectionOptions {
  const streamIdleTimeoutMs = config.streamIdleTimeoutMs ?? CODEX_DEFAULT_STREAM_IDLE_TIMEOUT_MS
  if (!Number.isFinite(streamIdleTimeoutMs)
    || streamIdleTimeoutMs <= 0
    || streamIdleTimeoutMs > MAX_TIMER_DELAY_MS) {
    throw new Error(
      `llm-codex: streamIdleTimeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`,
    )
  }
  return {
    models: resolveModels(config.models),
    streamIdleTimeoutMs,
    retryPolicy: withAuthRetries(resolveRetryPolicy(
      config.retryPolicy ?? { mode: 'normal', maxRetries: DEFAULT_MAX_RETRIES },
      'llm-codex: retryPolicy',
    )),
  }
}

function internalError(message: string) {
  return {
    ok: false as const,
    error: {
      code: 'internal' as const,
      message,
      details: {},
    },
  }
}

async function saveConfiguration(ctx: Context, payload: unknown) {
  const request = decodeCodexSaveRequest(payload)
  if (request === undefined) return internalError('invalid Codex settings request')
  const settings = ctx.get('settings')
  if (settings === undefined) return internalError('Codex settings are unavailable')
  try {
    const before = settings.describe().find(descriptor => descriptor.ns === NS)
    if (before === undefined) return internalError('Codex settings are unavailable')
    const current = decodeCodexSettings(before.value)
    if (current === undefined) return internalError('Codex settings are invalid')
    const ops: SettingsPathOp[] = []
    if (!deepEqualJson(current.models, request.models)) {
      ops.push({ op: 'set', path: ['models'], value: request.models })
    }
    if (current.enableSearch !== request.enableSearch) {
      ops.push({ op: 'set', path: ['enableSearch'], value: request.enableSearch })
    }
    if (current.enableImageTool !== request.enableImageTool) {
      ops.push({ op: 'set', path: ['enableImageTool'], value: request.enableImageTool })
    }
    if (current.enableImageGeneration !== request.enableImageGeneration) {
      ops.push({ op: 'set', path: ['enableImageGeneration'], value: request.enableImageGeneration })
    }
    if (current.searchModel !== request.searchModel) {
      ops.push({ op: 'set', path: ['searchModel'], value: request.searchModel })
    }
    if (current.imageGenerationModel !== request.imageGenerationModel) {
      ops.push({ op: 'set', path: ['imageGenerationModel'], value: request.imageGenerationModel })
    }
    if (current.searchMode !== request.searchMode) {
      ops.push({ op: 'set', path: ['searchMode'], value: request.searchMode })
    }
    if (current.searchContextSize !== request.searchContextSize) {
      ops.push({ op: 'set', path: ['searchContextSize'], value: request.searchContextSize })
    }
    if (current.searchMaxOutputTokens !== request.searchMaxOutputTokens) {
      ops.push({ op: 'set', path: ['searchMaxOutputTokens'], value: request.searchMaxOutputTokens })
    }
    if (ops.length > 0) await settings.mutate(NS, ops, request.expectedRevision)
    const accepted = settings.describe().find(descriptor => descriptor.ns === NS)
    const acceptedSettings = decodeCodexSettings(accepted?.value)
    if (accepted === undefined || acceptedSettings === undefined) {
      return internalError('Codex settings could not be reloaded')
    }
    return { ok: true as const, value: { settings: acceptedSettings, revision: accepted.revision } }
  } catch (error: unknown) {
    const message = error instanceof Error && error.message.length > 0
      ? error.message
      : 'Codex settings save failed'
    return internalError(message)
  }
}

async function readConfiguration(ctx: Context) {
  const descriptor = ctx.get('settings')?.describe().find(item => item.ns === NS)
  const settings = decodeCodexSettings(descriptor?.value)
  return descriptor === undefined || settings === undefined ? internalError('Codex settings are unavailable') : { ok: true as const, value: { settings, revision: descriptor.revision } }
}

export function createCodexRpcHandler(ctx: Context): ConnectionRpcHandler {
  return async (endpoint, payload) => {
    if (endpoint === CODEX_SAVE_ENDPOINT) return saveConfiguration(ctx, payload)
    if (endpoint === CODEX_SETTINGS_READ_ENDPOINT) return readConfiguration(ctx)
    return internalError(`unknown Codex endpoint: ${endpoint}`)
  }
}

export function createCodexManagementRpcHandler(
  ctx: Context,
  auth: CodexWebAuth,
  fetchModels: () => Promise<readonly CodexCatalogModel[]> = async () => CODEX_CATALOG,
): ConnectionRpcHandler {
  return async (endpoint, payload) => {
    const request = isRecord(payload) ? payload : undefined
    if (endpoint === CODEX_SETTINGS_READ_ENDPOINT) return readConfiguration(ctx)
    if (endpoint === CODEX_MODELS_FETCH_ENDPOINT) return { ok: true as const, value: await fetchModels() }
    if (endpoint === CODEX_SAVE_ENDPOINT) return saveConfiguration(ctx, payload)
    if (endpoint === CODEX_AUTH_STATUS_ENDPOINT) {
      const refresh = request?.['refresh'] === true
      return { ok: true as const, value: await auth.status(refresh) }
    }
    if (endpoint === CODEX_AUTH_BEGIN_ENDPOINT) {
      const method = request?.['method'] === 'device_code'
        ? 'device_code'
        : 'browser'
      return { ok: true as const, value: await auth.signIn(method) }
    }
    if (endpoint === CODEX_AUTH_ATTEMPT_STATUS_ENDPOINT) {
      const attemptId = typeof request?.['attemptId'] === 'string' ? request['attemptId'] : ''
      return { ok: true as const, value: { status: auth.attemptStatus(attemptId) } }
    }
    if (endpoint === CODEX_AUTH_CANCEL_ENDPOINT) {
      const attemptId = typeof request?.['attemptId'] === 'string' ? request['attemptId'] : undefined
      if (!auth.cancel(attemptId)) return internalError('stale Codex sign-in attempt')
      return { ok: true as const, value: { ok: true } }
    }
    if (endpoint === CODEX_AUTH_LOGOUT_ENDPOINT) { await auth.signOut(); return { ok: true as const, value: { ok: true } } }
    return internalError(`unknown Codex endpoint: ${endpoint}`)
  }
}

export function apply(ctx: Context, config: Config): void {
  if (!allowDshRuntime(ctx.logger, 'dsh-llm-codex', ['@deepseek-ai/dsh-llm'])) return

  let current: () => Config = () => config
  let lastRaw: Config | undefined
  let lastGood: CodexConnectionOptions | undefined
  const options = (): CodexConnectionOptions => {
    const raw = current()
    if (raw === lastRaw && lastGood !== undefined) return lastGood
    try {
      const next = resolveAdapterOptions(raw)
      lastRaw = raw
      lastGood = next
      return next
    } catch (error) {
      if (lastGood === undefined) throw error
      lastRaw = raw
      ctx.logger.error('llm-codex: keeping the last good configuration after an invalid settings section')
      ctx.logger.error(error)
      return lastGood
    }
  }
  options()

  const credentials = new CodexCredentialStore()
  const auth = new CodexWebAuth(credentials)
  const adapter = new CodexAdapter({
    options,
    resolveApiKey: () => resolveCodexAccessToken(credentials),
    refreshApiKey: () => refreshCodexAccessToken(credentials),
    resolveAttachments: () => ctx.get('attachments'),
  })
  ctx.llm.registerConfigurableProviders([
    { provider: CODEX_PROVIDER, displayName: 'Codex', settingsNs: NS, settingsPath: [] },
  ])
  const registration = ctx.llm.registerAdapter([CODEX_PROVIDER], adapter)
  let registeredPolicy = options().retryPolicy
  const ensureRegistrationFacts = (): void => {
    lastRaw = undefined
    const policy = options().retryPolicy
    if (deepEqualJson(policy, registeredPolicy)) return
    registration.replace([CODEX_PROVIDER])
    registeredPolicy = policy
  }

  ctx.inject(['webServer'], webCtx => registerCodexAuthRoutes(webCtx, credentials, auth))
  ctx.inject(['connection'], (connectionCtx) => {
    connectionCtx.effect(() => connectionCtx.connection.rpc.handle(CODEX_RPC_CHANNEL, createCodexManagementRpcHandler(ctx, auth, () => refreshCodexModelCatalog(credentials))), 'dsh-llm-codex: management RPC')
  })

  let stopped = false
  let searchFiber: Fiber | undefined
  let searchRegistration: object | undefined
  let searchTail = Promise.resolve()
  let imageFiber: Fiber | undefined
  let imageTail = Promise.resolve()
  let generateFiber: Fiber | undefined
  let generateTail = Promise.resolve()

  const resolvedSettings = (): ReturnType<typeof decodeCodexSettings> => {
    return decodeCodexSettings({ ...DEFAULT_CODEX_SETTINGS, ...current() })
  }

  installCodexModelSwitchAdapters(ctx, credentials, resolvedSettings)

  const reconcileSearch = async (): Promise<void> => {
    if (stopped) return
    const resolved = resolvedSettings()
    if (resolved === undefined) return
    const nextRegistration = current().registerLegacyTools !== false
      && resolved.enableSearch
      ? {
          model: resolved.searchModel,
          mode: resolved.searchMode,
          contextSize: resolved.searchContextSize,
          maxOutputTokens: resolved.searchMaxOutputTokens,
        }
      : undefined
    if (deepEqualJson(nextRegistration, searchRegistration)) return
    const previous = searchFiber
    searchFiber = undefined
    searchRegistration = undefined
    if (previous !== undefined) await previous.dispose()
    if (stopped || nextRegistration === undefined) return
    const fiber = ctx.inject(['web'], webCtx => webCtx.web.registerSearchProvider(new CodexSearchProvider({
      credentials,
      model: nextRegistration.model,
      mode: nextRegistration.mode,
      contextSize: nextRegistration.contextSize,
      maxOutputTokens: nextRegistration.maxOutputTokens,
      resolveRequestId: () => String(webCtx.get('agents')?.currentInitiator()?.session.id ?? randomUUID()),
    })))
    searchFiber = fiber
    searchRegistration = nextRegistration
    void Promise.resolve(fiber).catch((error: unknown) => {
      if (searchFiber === fiber) {
        searchFiber = undefined
        searchRegistration = undefined
      }
      ctx.logger.error('dsh-llm-codex: optional search provider failed to activate')
      ctx.logger.error(error)
    })
  }

  const reconcileImageTool = async (): Promise<void> => {
    if (stopped) return
    const resolved = resolvedSettings()
    const enabled = current().registerLegacyTools !== false && resolved?.enableImageTool === true
    if (enabled === (imageFiber !== undefined)) return
    const previous = imageFiber
    imageFiber = undefined
    if (previous !== undefined) await previous.dispose()
    if (stopped || !enabled) return
    const fiber = ctx.inject(
      ['tools', 'fs', 'attachments'],
      toolCtx => toolCtx.tools.register(viewImageTool(toolCtx)),
    )
    imageFiber = fiber
    void Promise.resolve(fiber).catch((error: unknown) => {
      if (imageFiber === fiber) imageFiber = undefined
      ctx.logger.error('dsh-llm-codex: optional view_image tool failed to activate')
      ctx.logger.error(error)
    })
  }

  const reconcileGenerateImage = async (): Promise<void> => {
    if (stopped) return
    const resolved = resolvedSettings()
    const enabled = current().registerLegacyTools !== false && resolved?.enableImageGeneration === true
    if (enabled === (generateFiber !== undefined)) return
    const previous = generateFiber
    generateFiber = undefined
    if (previous !== undefined) await previous.dispose()
    if (stopped || !enabled) return
    const fiber = ctx.inject(
      ['tools', 'fs', 'attachments'],
      toolCtx => toolCtx.tools.register(generateImageTool(toolCtx, {
        resolveAccessToken: () => resolveCodexAccessToken(credentials),
        routingModel: () => resolvedSettings()?.imageGenerationModel ?? DEFAULT_CODEX_IMAGE_GENERATION_MODEL,
      })),
    )
    generateFiber = fiber
    void Promise.resolve(fiber).catch((error: unknown) => {
      if (generateFiber === fiber) generateFiber = undefined
      ctx.logger.error('dsh-llm-codex: optional codex_generate_image tool failed to activate')
      ctx.logger.error(error)
    })
  }

  const scheduleCapabilities = (): void => {
    ensureRegistrationFacts()
    searchTail = searchTail.then(reconcileSearch, reconcileSearch).catch((error: unknown) => {
      ctx.logger.error('dsh-llm-codex: could not apply the updated search configuration')
      ctx.logger.error(error)
    })
    imageTail = imageTail.then(reconcileImageTool, reconcileImageTool).catch((error: unknown) => {
      ctx.logger.error('dsh-llm-codex: could not apply the updated image-tool configuration')
      ctx.logger.error(error)
    })
    generateTail = generateTail.then(reconcileGenerateImage, reconcileGenerateImage).catch((error: unknown) => {
      ctx.logger.error('dsh-llm-codex: could not apply the updated image-generation configuration')
      ctx.logger.error(error)
    })
  }

  ctx.effect(() => async () => {
    stopped = true
    let primaryFailed = false
    let primaryError: unknown
    try {
      await Promise.all([searchTail, imageTail, generateTail])
    } catch (error: unknown) {
      primaryFailed = true
      primaryError = error
    }
    const fibers = [searchFiber, imageFiber, generateFiber]
    searchFiber = undefined
    imageFiber = undefined
    generateFiber = undefined
    const cleanupErrors: unknown[] = []
    for (const fiber of fibers) {
      if (fiber === undefined) continue
      try {
        await fiber.dispose()
      } catch (error: unknown) {
        cleanupErrors.push(error)
      }
    }
    if (primaryFailed || cleanupErrors.length > 0) {
      const errors = primaryFailed ? [primaryError, ...cleanupErrors] : cleanupErrors
      throw new AggregateError(errors, 'dsh-llm-codex: optional capability cleanup failed')
    }
  }, 'dsh-llm-codex: optional capability lifecycle')
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, NS, Config, config, {
      setSource: (source) => {
        current = source as () => Config
      },
      onChange: scheduleCapabilities,
    })
  })
  scheduleCapabilities()
}
