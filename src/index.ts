/**
 * Register the `codex` provider, ChatGPT OAuth, sortable catalog, and
 * optional search / view_image / codex_generate_image capabilities.
 * @module dsh-llm-codex
 */

import { randomUUID } from 'node:crypto'
import type { Context, Fiber, Volatile, VolatileSnapshot } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { clientRequestSchema } from '@deepseek-ai/dsh-client-connection'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import { SettingsConflictError } from '@deepseek-ai/dsh-settings'
import { INVALID_CREDENTIAL_CODE, LlmError, resolveRetryPolicy, RetryPolicySchema } from '@deepseek-ai/dsh-llm'
import type { ResolvedRetryPolicy, RetryPolicyConfig } from '@deepseek-ai/dsh-llm'
import { deepEqualJson } from '@deepseek-ai/dsh-util-values'
import type { SettingsPathOp } from '@deepseek-ai/dsh-settings'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import { allowDshRuntime } from './compatibility.ts'
import type {} from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-web'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-fs'
import { CodexAdapter, refreshCodexAccessToken, resolveCodexAccessToken } from './adapter.ts'
import { CODEX_REASONING_EFFORTS, isCodexReasoningEffort } from './catalog.ts'
import type { CodexReasoningEffort } from './catalog.ts'
import type { CodexConnectionOptions } from './adapter.ts'
import { CodexWebAuth, safeMessage } from './codex-web-auth.ts'
import { isCodexCredentialFailure } from './usage.ts'
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
  CODEX_RPC_ENDPOINT,
  CODEX_SAVE_ENDPOINT,
  CODEX_MODELS_FETCH_ENDPOINT,
  CODEX_AUTH_STATUS_ENDPOINT,
  CODEX_AUTH_BEGIN_ENDPOINT,
  CODEX_AUTH_CANCEL_ENDPOINT,
  CODEX_AUTH_ATTEMPT_STATUS_ENDPOINT,
  CODEX_AUTH_LOGOUT_ENDPOINT,
  CODEX_SETTINGS_NAMESPACE,
  CODEX_SETTINGS_ENTRY_ID,
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
  CODEX_RPC_ENDPOINT,
  CODEX_SAVE_ENDPOINT,
  CODEX_MODELS_FETCH_ENDPOINT,
  CODEX_AUTH_STATUS_ENDPOINT,
  CODEX_AUTH_BEGIN_ENDPOINT,
  CODEX_AUTH_CANCEL_ENDPOINT,
  CODEX_AUTH_ATTEMPT_STATUS_ENDPOINT,
  CODEX_AUTH_LOGOUT_ENDPOINT,
  CODEX_SETTINGS_NAMESPACE,
  CODEX_SETTINGS_ENTRY_ID,
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
export { CodexWebAuth } from './codex-web-auth.ts'

export const name = 'llm-codex'
export const inject = ['llm']

const NS = CODEX_SETTINGS_NAMESPACE


export interface Config {
  streamIdleTimeoutMs?: number
  models: Volatile<CodexCatalogModel[] | undefined>
  enableSearch: Volatile<boolean>
  enableImageTool: Volatile<boolean>
  enableImageGeneration: Volatile<boolean>
  searchModel: Volatile<string>
  imageGenerationModel: Volatile<string>
  searchMode: Volatile<CodexSearchMode>
  searchContextSize: Volatile<CodexSearchContextSize>
  searchMaxOutputTokens: Volatile<number>
  retryPolicy?: RetryPolicyConfig
  /** Set false when Model Switch owns stable tool names, preventing legacy duplicates. */
  registerLegacyTools?: boolean
}

interface RuntimeConfig {
  streamIdleTimeoutMs?: number
  models?: VolatileSnapshot<CodexCatalogModel[] | undefined>
  enableSearch?: boolean
  enableImageTool?: boolean
  enableImageGeneration?: boolean
  searchModel?: string
  imageGenerationModel?: string
  searchMode?: CodexSearchMode
  searchContextSize?: CodexSearchContextSize
  searchMaxOutputTokens?: number
  retryPolicy?: RetryPolicyConfig
  registerLegacyTools?: boolean
}
type ConfigInput = Omit<RuntimeConfig, 'models'> & { models?: CodexCatalogModel[] }

function isVolatileValue<T>(value: T | Volatile<T> | undefined): value is Volatile<T> {
  return value !== null && typeof value === 'object' && 'get' in value && typeof value.get === 'function'
}

function configValue<T>(value: T | Volatile<T> | undefined): T | VolatileSnapshot<T> | undefined {
  return isVolatileValue(value) ? value.get() : value
}

function readConfig(config: Config): RuntimeConfig {
  const streamIdleTimeoutMs = config.streamIdleTimeoutMs
  const models = configValue(config.models)
  const enableSearch = configValue(config.enableSearch)
  const enableImageTool = configValue(config.enableImageTool)
  const enableImageGeneration = configValue(config.enableImageGeneration)
  const searchModel = configValue(config.searchModel)
  const imageGenerationModel = configValue(config.imageGenerationModel)
  const searchMode = configValue(config.searchMode)
  const searchContextSize = configValue(config.searchContextSize)
  const searchMaxOutputTokens = configValue(config.searchMaxOutputTokens)
  const retryPolicy = config.retryPolicy
  const registerLegacyTools = config.registerLegacyTools
  return {
    ...(streamIdleTimeoutMs === undefined ? {} : { streamIdleTimeoutMs }),
    ...(models === undefined ? {} : { models }),
    ...(enableSearch === undefined ? {} : { enableSearch }),
    ...(enableImageTool === undefined ? {} : { enableImageTool }),
    ...(enableImageGeneration === undefined ? {} : { enableImageGeneration }),
    ...(searchModel === undefined ? {} : { searchModel }),
    ...(imageGenerationModel === undefined ? {} : { imageGenerationModel }),
    ...(searchMode === undefined ? {} : { searchMode }),
    ...(searchContextSize === undefined ? {} : { searchContextSize }),
    ...(searchMaxOutputTokens === undefined ? {} : { searchMaxOutputTokens }),
    ...(retryPolicy === undefined ? {} : { retryPolicy }),
    ...(registerLegacyTools === undefined ? {} : { registerLegacyTools }),
  }
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

const catalogModel: z<CodexCatalogModel> = z.object({
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

export const Config: z<ConfigInput, Config> = z.object({
  streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(
    CODEX_DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  ),
  models: z.transform(z.array(catalogModel), resolveModels, true).volatile(),
  enableSearch: z.boolean().default(false).volatile(),
  enableImageTool: z.boolean().default(false).volatile(),
  enableImageGeneration: z.boolean().default(false).volatile(),
  searchModel: z.string().default(DEFAULT_CODEX_SEARCH_MODEL).volatile(),
  imageGenerationModel: z.string().default(DEFAULT_CODEX_IMAGE_GENERATION_MODEL).volatile(),
  searchMode: z.union(['cached', 'indexed', 'live'] as const).default(DEFAULT_CODEX_SEARCH_MODE).volatile(),
  searchContextSize: z.union(['low', 'medium', 'high'] as const).default(DEFAULT_CODEX_SEARCH_CONTEXT_SIZE).volatile(),
  searchMaxOutputTokens: z.number().step(1).min(1).default(DEFAULT_CODEX_SEARCH_MAX_OUTPUT_TOKENS).volatile(),
  retryPolicy: RetryPolicySchema,
  registerLegacyTools: z.boolean().default(true),
})

function resolveModels(models: VolatileSnapshot<CodexCatalogModel[] | undefined>): CodexCatalogModel[] {
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

export function resolveAdapterOptions(config: Config | RuntimeConfig): CodexConnectionOptions {
  const streamIdleTimeoutMs = config.streamIdleTimeoutMs ?? CODEX_DEFAULT_STREAM_IDLE_TIMEOUT_MS
  if (!Number.isFinite(streamIdleTimeoutMs)
    || streamIdleTimeoutMs <= 0
    || streamIdleTimeoutMs > MAX_TIMER_DELAY_MS) {
    throw new Error(
      `llm-codex: streamIdleTimeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`,
    )
  }
  return {
    models: resolveModels(configValue(config.models)),
    streamIdleTimeoutMs,
    retryPolicy: withAuthRetries(resolveRetryPolicy(
      config.retryPolicy ?? { mode: 'normal', maxRetries: DEFAULT_MAX_RETRIES },
      'llm-codex: retryPolicy',
    )),
  }
}

function failure(code: string, message: string) {
  return {
    ok: false as const,
    error: {
      code,
      message,
      details: {},
    },
  }
}

function internalError(message: string) {
  return failure('internal', message)
}

/**
 * Map one Host Connection failure onto the wire. A credential that is missing
 * or no longer usable answers {@link INVALID_CREDENTIAL_CODE} so the shared
 * provider quota cache drops the previous account's entry instead of keeping
 * it; any other {@link LlmError} keeps its own failure code, and every other
 * failure stays internal rather than escaping the handler as a gateway error.
 * @param error - value caught while answering a Codex endpoint.
 * @param fallback - message used when the failure carries none.
 */
function rpcFailure(error: unknown, fallback: string) {
  const message = error instanceof Error && error.message.length > 0 ? safeMessage(error) : fallback
  if (isCodexCredentialFailure(error)) return failure(INVALID_CREDENTIAL_CODE, message)
  if (error instanceof LlmError) return failure(error.code, message)
  return internalError(message)
}

async function saveConfiguration(ctx: Context, payload: unknown, currentConfig: RuntimeConfig) {
  const request = decodeCodexSaveRequest(payload)
  if (request === undefined) return internalError('invalid Codex settings request')
  const settings = ctx.get('settings')
  if (settings === undefined) return internalError('Codex settings are unavailable')
  try {
    const before = settings.describe().find(descriptor => descriptor.ns === CODEX_SETTINGS_ENTRY_ID)
    if (before === undefined) return internalError('Codex settings are unavailable')
    const current = decodeCodexSettings(before.value)
    if (current === undefined) return internalError('Codex settings are invalid')
    try {
      resolveAdapterOptions({
        ...currentConfig,
        models: [...request.models],
        enableSearch: request.enableSearch,
        enableImageTool: request.enableImageTool,
        enableImageGeneration: request.enableImageGeneration,
        searchModel: request.searchModel,
        imageGenerationModel: request.imageGenerationModel,
        searchMode: request.searchMode,
        searchContextSize: request.searchContextSize,
        searchMaxOutputTokens: request.searchMaxOutputTokens,
      })
    } catch (error: unknown) {
      return failure('invalid_config', error instanceof Error ? safeMessage(error) : 'invalid Codex settings')
    }
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
    if (ops.length > 0) await settings.mutate(CODEX_SETTINGS_ENTRY_ID, ops, request.expectedRevision)
    const accepted = settings.describe().find(descriptor => descriptor.ns === CODEX_SETTINGS_ENTRY_ID)
    const acceptedSettings = decodeCodexSettings(accepted?.value)
    if (accepted === undefined || acceptedSettings === undefined) {
      return internalError('Codex settings could not be reloaded')
    }
    return { ok: true as const, value: { settings: acceptedSettings, revision: accepted.revision } }
  } catch (error: unknown) {
    if (error instanceof SettingsConflictError) return failure(error.code, error.message)
    const message = error instanceof Error && error.message.length > 0
      ? safeMessage(error)
      : 'Codex settings save failed'
    return internalError(message)
  }
}

export function createCodexManagementRpcHandler(
  ctx: Context,
  auth: CodexWebAuth,
  fetchModels: () => Promise<readonly CodexCatalogModel[]> = async () => CODEX_CATALOG,
  getConfig: () => RuntimeConfig = () => ({}),
): ConnectionRpcHandler {
  return async (endpoint, payload) => {
    // Expected failures stay RPC results; unexpected transport failures stay HTTP errors.
    try {
      const request = isRecord(payload) ? payload : undefined
      if (endpoint === CODEX_MODELS_FETCH_ENDPOINT) return { ok: true as const, value: await fetchModels() }
      if (endpoint === CODEX_SAVE_ENDPOINT) return saveConfiguration(ctx, payload, getConfig())
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
    } catch (error: unknown) {
      return rpcFailure(error, `Codex ${endpoint} request failed`)
    }
  }
}

async function handleCodexFetch(
  request: Request,
  handler: ConnectionRpcHandler,
  operator: Parameters<ConnectionRpcHandler>[3],
): Promise<Response> {
  const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (mediaType !== 'application/json') {
    return Response.json({ error: 'Expected application/json' }, { status: 415 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON request' }, { status: 400 })
  }
  const envelope = clientRequestSchema.safeParse(body)
  if (!envelope.success || envelope.data.method !== CODEX_RPC_ENDPOINT) {
    return Response.json({ error: 'Invalid Codex request' }, { status: 400 })
  }
  const payload = isRecord(envelope.data.payload) ? envelope.data.payload : undefined
  if (payload === undefined || typeof payload['endpoint'] !== 'string') {
    return Response.json({ error: 'Invalid Codex request payload' }, { status: 400 })
  }
  try {
    const result = await handler(payload['endpoint'], payload['payload'], request.signal, operator)
    if (!result.ok || result.attachments === undefined || result.attachments.length === 0) {
      return Response.json({
        type: 'server-response',
        rpcId: envelope.data.rpcId,
        result,
      }, { headers: { 'cache-control': 'no-store' } })
    }
    const form = new FormData()
    const attachments = result.attachments.map((attachment, index) => {
      const part = `bytes-${index}`
      form.append(part, new Blob([attachment.bytes as BlobPart]))
      return { path: attachment.path, codec: 'bytes', part }
    })
    form.append('metadata', JSON.stringify({
      type: 'server-response',
      rpcId: envelope.data.rpcId,
      result: { ok: true, value: result.value },
      attachments,
    }))
    return new Response(form, { headers: { 'cache-control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Codex request failed' }, { status: 500 })
  }
}

export function apply(ctx: Context, config: Config): void {
  if (!allowDshRuntime(ctx.logger, 'dsh-llm-codex', ['@deepseek-ai/dsh-llm'])) return

  let current = readConfig(config)
  let lastRaw: RuntimeConfig | undefined
  let lastGood: CodexConnectionOptions | undefined
  const options = (): CodexConnectionOptions => {
    const raw = current
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
  ctx.effect(() => async () => auth.dispose(), 'dsh-llm-codex: OAuth lifecycle')
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

  ctx.inject(['connection'], (connectionCtx) => {
    const handler = createCodexManagementRpcHandler(
      ctx,
      auth,
      () => refreshCodexModelCatalog(credentials),
      () => current,
    )
    connectionCtx.effect(() => connectionCtx.connection.fetch.register({
      path: '/api/plugin-rpc/codex',
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: request => handleCodexFetch(request, handler, connectionCtx.connection.operator),
    }), 'dsh-llm-codex: authenticated management fetch')
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
    return decodeCodexSettings({ ...DEFAULT_CODEX_SETTINGS, ...current })
  }

  installCodexModelSwitchAdapters(ctx, credentials, resolvedSettings)

  const reconcileSearch = async (): Promise<void> => {
    if (stopped) return
    const resolved = resolvedSettings()
    if (resolved === undefined) return
    const nextRegistration = current.registerLegacyTools !== false
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
    const enabled = current.registerLegacyTools !== false && resolved?.enableImageTool === true
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
    const enabled = current.registerLegacyTools !== false && resolved?.enableImageGeneration === true
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
  ctx.inject(['settings'], settingsCtx => {
    settingsCtx.effect(
      () => settingsCtx.settings.configure({ auto: false }, ctx.fiber),
      'dsh-llm-codex: custom settings page policy',
    )
  })
  ctx.on('loader/volatile-update', paths => {
    if (paths.length === 0) return
    current = readConfig(config)
    lastRaw = undefined
    scheduleCapabilities()
  })
  scheduleCapabilities()
}
