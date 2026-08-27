/** Browser-safe constants and JSON decoders shared by Host and client faces. */

import { defaultDisplayedCatalog, hydrateCatalogModel } from './catalog.ts'
import type { CodexCatalogModel } from './catalog.ts'

export type { CodexCatalogModel } from './catalog.ts'

/** Settings namespace owned by this plugin. */
export const CODEX_SETTINGS_NAMESPACE = 'llm-codex'
/** Public DSH provider route. Distinct from pi-ai's internal `openai-codex` id. */
export const CODEX_PROVIDER = 'codex'
/** Default maximum idle interval while a stream read is outstanding. */
export const CODEX_DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000
/** Private Connection RPC channel used for catalog save. */
export const CODEX_RPC_CHANNEL = '/codex'
/** Atomic settings-save endpoint. */
export const CODEX_SAVE_ENDPOINT = 'settings/save'
/** Authoritative settings snapshot endpoint. */
export const CODEX_SETTINGS_READ_ENDPOINT = 'settings/read'
export const CODEX_AUTH_STATUS_ENDPOINT = 'auth/status'
export const CODEX_AUTH_BEGIN_ENDPOINT = 'auth/begin'
export const CODEX_AUTH_CANCEL_ENDPOINT = 'auth/cancel'
export const CODEX_AUTH_ATTEMPT_STATUS_ENDPOINT = 'auth/attempt-status'
export const CODEX_AUTH_LOGOUT_ENDPOINT = 'auth/logout'
/** Plugin-owned status endpoint consumed by its browser half. */
export const CODEX_AUTH_STATUS_PATH = '/plugins/dsh-llm-codex/auth/status'
/** Plugin-owned browser-login endpoint consumed by its browser half. */
export const CODEX_AUTH_LOGIN_PATH = '/plugins/dsh-llm-codex/auth/login'
/** Plugin-owned logout endpoint consumed by its browser half. */
export const CODEX_AUTH_LOGOUT_PATH = '/plugins/dsh-llm-codex/auth/logout'

/** Search modes accepted by the Codex standalone search endpoint. */
export type CodexSearchMode = 'cached' | 'indexed' | 'live'
/** Search-context sizes accepted by the Codex standalone search endpoint. */
export type CodexSearchContextSize = 'low' | 'medium' | 'high'

/** Default model used by the standalone search endpoint. */
export const DEFAULT_CODEX_SEARCH_MODEL = 'gpt-5.6-luna'
/** Default search mode, matching the official local Codex client. */
export const DEFAULT_CODEX_SEARCH_MODE: CodexSearchMode = 'cached'
/** Default provider search-context size. */
export const DEFAULT_CODEX_SEARCH_CONTEXT_SIZE: CodexSearchContextSize = 'medium'
/** Default output budget for the standalone search response. */
export const DEFAULT_CODEX_SEARCH_MAX_OUTPUT_TOKENS = 10_000
/** Default Codex routing model for `codex_generate_image`. */
export const DEFAULT_CODEX_IMAGE_GENERATION_MODEL = 'gpt-5.6-luna'

/** Settings fields presented by the package's Web configuration card. */
export interface CodexSettingsView {
  /** Stream idle timeout in milliseconds. */
  streamIdleTimeoutMs: number
  /** Displayed conversation-picker catalog. */
  models: readonly CodexCatalogModel[]
  /** Register the optional standalone Codex search provider. */
  enableSearch: boolean
  /** Register the optional image-loading tool. */
  enableImageTool: boolean
  /** Register the optional Codex image-generation tool. */
  enableImageGeneration: boolean
  /** Model used for auxiliary standalone searches. */
  searchModel: string
  /** Vision-capable official model that invokes hosted image_generation. */
  imageGenerationModel: string
  /** Cached, indexed, or live web access. */
  searchMode: CodexSearchMode
  /** Amount of search context returned by the provider. */
  searchContextSize: CodexSearchContextSize
  /** Maximum generated tokens returned by the standalone search endpoint. */
  searchMaxOutputTokens: number
}

/** Atomic editable-settings payload sent by the browser face. */
export interface CodexSaveRequest {
  models: readonly CodexCatalogModel[]
  enableSearch: boolean
  enableImageTool: boolean
  enableImageGeneration: boolean
  searchModel: string
  imageGenerationModel: string
  searchMode: CodexSearchMode
  searchContextSize: CodexSearchContextSize
  searchMaxOutputTokens: number
  expectedRevision: number
}

/** Host reply after an accepted settings save. */
export interface CodexSaveResult {
  settings: CodexSettingsView
  revision: number
}

/** One quota window expressed as remaining capacity for direct UI rendering. */
export interface CodexRateLimitWindow {
  readonly remainingPercent: number
  readonly windowSeconds: number
  /** ISO-8601 instant from official `reset_at` / `reset_after_seconds`. */
  readonly resetsAt?: string
}

/** One separately metered Codex quota bucket. */
export interface CodexRateLimit {
  readonly id: string
  readonly name?: string
  readonly windows: readonly CodexRateLimitWindow[]
}

/** Optional exact prepaid-credit balance returned by ChatGPT. */
export interface CodexCredits {
  readonly unlimited: boolean
  readonly balance?: string
}

/** Optional exact workspace member spend limit returned by ChatGPT. */
export interface CodexIndividualLimit {
  readonly limit: string
  readonly used: string
  readonly remaining: string
  readonly remainingPercent: number
}

/** Secret-free quota projection returned to the browser. */
export interface CodexUsage {
  readonly rateLimits: readonly CodexRateLimit[]
  readonly credits?: CodexCredits
  readonly individualLimit?: CodexIndividualLimit
}

/** Host auth JSON. `loading` is client-only and never crosses the wire. */
export type CodexHostAuthStatus =
  | { status: 'signed-out' }
  | { status: 'signing-in' }
  | { status: 'reauth-required'; message: string }
  | { status: 'signed-in'; usage: CodexUsage; quotaError?: string }
  | { status: 'error'; message: string }

/** Browser-facing account snapshot, including the pre-fetch loading state. */
export type CodexAccountStatus =
  | { status: 'loading' }
  | CodexHostAuthStatus

/** Host reply after Sign in with ChatGPT opens the system browser. */
export interface CodexAuthLoginReply {
  url?: string
  verificationUri?: string
  userCode?: string
  expiresAt?: number
  attemptId?: string
}

/** Host reply after sign-out. */
export interface CodexAuthLogoutReply {
  ok: true
}

export type CodexAuthAttemptStatus =
  | { status: 'pending' | 'succeeded' | 'failed' | 'cancelled' }
  | { status: 'missing' }

export const DEFAULT_CODEX_SETTINGS: Readonly<CodexSettingsView> = Object.freeze({
  streamIdleTimeoutMs: CODEX_DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  models: Object.freeze(defaultDisplayedCatalog()),
  enableSearch: false,
  enableImageTool: false,
  enableImageGeneration: false,
  searchModel: DEFAULT_CODEX_SEARCH_MODEL,
  imageGenerationModel: DEFAULT_CODEX_IMAGE_GENERATION_MODEL,
  searchMode: DEFAULT_CODEX_SEARCH_MODE,
  searchContextSize: DEFAULT_CODEX_SEARCH_CONTEXT_SIZE,
  searchMaxOutputTokens: DEFAULT_CODEX_SEARCH_MAX_OUTPUT_TOKENS,
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const TOKEN_FIELD = /^(?:accessToken|refreshToken|access_token|refresh_token|id_token|idToken|token)$/iu

function hasTokenFields(value: Record<string, unknown>): boolean {
  return Object.keys(value).some(key => TOKEN_FIELD.test(key))
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function optionalBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key]
  return typeof value === 'boolean' ? value : undefined
}

function optionalPositiveInt(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

/** Decode one catalog row; unknown extra fields are ignored. */
export function decodeCodexCatalogModel(value: unknown): CodexCatalogModel | undefined {
  if (!isRecord(value) || typeof value['id'] !== 'string' || value['id'].trim().length === 0) return undefined
  const model: CodexCatalogModel = { id: value['id'].trim() }
  const name = optionalString(value, 'name')
  const description = optionalString(value, 'description')
  const contextWindow = optionalPositiveInt(value, 'contextWindow')
  const maxTokens = optionalPositiveInt(value, 'maxTokens')
  const thinking = optionalBoolean(value, 'thinking')
  const defaultEffort = optionalString(value, 'defaultEffort')
  const vision = optionalBoolean(value, 'vision')
  const tools = optionalBoolean(value, 'tools')
  const fast = optionalBoolean(value, 'fast')
  if (name !== undefined) model.name = name
  if (description !== undefined) model.description = description
  if (contextWindow !== undefined) model.contextWindow = contextWindow
  if (maxTokens !== undefined) model.maxTokens = maxTokens
  if (thinking !== undefined) model.thinking = thinking
  if (defaultEffort !== undefined) model.defaultEffort = defaultEffort
  if (vision !== undefined) model.vision = vision
  if (tools !== undefined) model.tools = tools
  if (fast !== undefined) model.fast = fast
  return hydrateCatalogModel(model)
}

function decodeModels(value: unknown): CodexCatalogModel[] | undefined {
  if (value === undefined) return [...DEFAULT_CODEX_SETTINGS.models]
  if (!Array.isArray(value)) return undefined
  const models: CodexCatalogModel[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const model = decodeCodexCatalogModel(item)
    if (model === undefined || seen.has(model.id)) return undefined
    seen.add(model.id)
    models.push(model)
  }
  return models
}

/** Narrow a redacted settings payload before it enters React state. */
export function decodeCodexSettings(value: unknown): CodexSettingsView | undefined {
  if (!isRecord(value) || hasTokenFields(value)) return undefined
  const models = decodeModels(value['models'])
  if (models === undefined) return undefined
  const streamIdleTimeoutMs = value['streamIdleTimeoutMs']
  const enableSearch = value['enableSearch']
  const enableImageTool = value['enableImageTool']
  const enableImageGeneration = value['enableImageGeneration']
  const searchModel = value['searchModel']
  const imageGenerationModel = value['imageGenerationModel']
  const searchMode = value['searchMode']
  const searchContextSize = value['searchContextSize']
  const searchMaxOutputTokens = value['searchMaxOutputTokens']
  if (streamIdleTimeoutMs !== undefined
    && (typeof streamIdleTimeoutMs !== 'number' || !Number.isFinite(streamIdleTimeoutMs) || streamIdleTimeoutMs <= 0)) {
    return undefined
  }
  if (enableSearch !== undefined && typeof enableSearch !== 'boolean') return undefined
  if (enableImageTool !== undefined && typeof enableImageTool !== 'boolean') return undefined
  if (enableImageGeneration !== undefined && typeof enableImageGeneration !== 'boolean') return undefined
  if (searchModel !== undefined && (typeof searchModel !== 'string' || searchModel.trim().length === 0)) return undefined
  if (imageGenerationModel !== undefined && (typeof imageGenerationModel !== 'string' || imageGenerationModel.trim().length === 0)) return undefined
  if (searchMode !== undefined && searchMode !== 'cached' && searchMode !== 'indexed' && searchMode !== 'live') {
    return undefined
  }
  if (searchContextSize !== undefined
    && searchContextSize !== 'low' && searchContextSize !== 'medium' && searchContextSize !== 'high') {
    return undefined
  }
  if (searchMaxOutputTokens !== undefined
    && (typeof searchMaxOutputTokens !== 'number' || !Number.isInteger(searchMaxOutputTokens) || searchMaxOutputTokens < 1)) {
    return undefined
  }
  return {
    streamIdleTimeoutMs: typeof streamIdleTimeoutMs === 'number'
      ? streamIdleTimeoutMs
      : DEFAULT_CODEX_SETTINGS.streamIdleTimeoutMs,
    models,
    enableSearch: typeof enableSearch === 'boolean' ? enableSearch : DEFAULT_CODEX_SETTINGS.enableSearch,
    enableImageTool: typeof enableImageTool === 'boolean' ? enableImageTool : DEFAULT_CODEX_SETTINGS.enableImageTool,
    enableImageGeneration: typeof enableImageGeneration === 'boolean' ? enableImageGeneration : DEFAULT_CODEX_SETTINGS.enableImageGeneration,
    searchModel: typeof searchModel === 'string' ? searchModel.trim() : DEFAULT_CODEX_SETTINGS.searchModel,
    imageGenerationModel: typeof imageGenerationModel === 'string' ? imageGenerationModel.trim() : DEFAULT_CODEX_SETTINGS.imageGenerationModel,
    searchMode: searchMode === 'indexed' || searchMode === 'live' ? searchMode : DEFAULT_CODEX_SETTINGS.searchMode,
    searchContextSize: searchContextSize === 'low' || searchContextSize === 'high'
      ? searchContextSize
      : DEFAULT_CODEX_SETTINGS.searchContextSize,
    searchMaxOutputTokens: typeof searchMaxOutputTokens === 'number'
      ? searchMaxOutputTokens
      : DEFAULT_CODEX_SETTINGS.searchMaxOutputTokens,
  }
}

/** Decode a browser save request. */
export function decodeCodexSaveRequest(value: unknown): CodexSaveRequest | undefined {
  if (!isRecord(value) || hasTokenFields(value)) return undefined
  const settings = decodeCodexSettings(value)
  if (settings === undefined) return undefined
  const expectedRevision = value['expectedRevision']
  if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return undefined
  }
  return {
    models: settings.models,
    enableSearch: settings.enableSearch,
    enableImageTool: settings.enableImageTool,
    enableImageGeneration: settings.enableImageGeneration,
    searchModel: settings.searchModel,
    imageGenerationModel: settings.imageGenerationModel,
    searchMode: settings.searchMode,
    searchContextSize: settings.searchContextSize,
    searchMaxOutputTokens: settings.searchMaxOutputTokens,
    expectedRevision,
  }
}

/** Decode a Host save reply. */
export function decodeCodexSaveResult(value: unknown): CodexSaveResult | undefined {
  if (!isRecord(value) || hasTokenFields(value)) return undefined
  const settings = decodeCodexSettings(value['settings'])
  const revision = value['revision']
  if (settings === undefined || typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0) {
    return undefined
  }
  return { settings, revision }
}

function decodeRateLimitWindow(value: unknown): CodexRateLimitWindow | undefined {
  if (!isRecord(value) || hasTokenFields(value)) return undefined
  const remainingPercent = value['remainingPercent']
  const windowSeconds = value['windowSeconds']
  if (typeof remainingPercent !== 'number'
    || !Number.isFinite(remainingPercent)
    || remainingPercent < 0
    || remainingPercent > 100) {
    return undefined
  }
  if (typeof windowSeconds !== 'number' || !Number.isFinite(windowSeconds) || windowSeconds <= 0) {
    return undefined
  }
  const resetsAt = value['resetsAt']
  if (resetsAt !== undefined && (typeof resetsAt !== 'string' || resetsAt.length === 0)) return undefined
  return {
    remainingPercent,
    windowSeconds,
    ...resetsAt === undefined ? {} : { resetsAt },
  }
}

function decodeRateLimit(value: unknown): CodexRateLimit | undefined {
  if (!isRecord(value) || hasTokenFields(value)) return undefined
  const id = value['id']
  const name = value['name']
  const windows = value['windows']
  if (typeof id !== 'string' || id.length === 0 || !Array.isArray(windows)) return undefined
  if (name !== undefined && (typeof name !== 'string' || name.length === 0)) return undefined
  const decodedWindows: CodexRateLimitWindow[] = []
  for (const item of windows) {
    const window = decodeRateLimitWindow(item)
    if (window === undefined) return undefined
    decodedWindows.push(window)
  }
  return {
    id,
    ...name === undefined ? {} : { name },
    windows: decodedWindows,
  }
}

function decodeCredits(value: unknown): CodexCredits | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value) || hasTokenFields(value) || typeof value['unlimited'] !== 'boolean') return undefined
  const balance = value['balance']
  if (balance !== undefined && (typeof balance !== 'string' || balance.length === 0)) return undefined
  return {
    unlimited: value['unlimited'],
    ...balance === undefined ? {} : { balance },
  }
}

function decodeIndividualLimit(value: unknown): CodexIndividualLimit | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value) || hasTokenFields(value)) return undefined
  const limit = value['limit']
  const used = value['used']
  const remaining = value['remaining']
  const remainingPercent = value['remainingPercent']
  if (typeof limit !== 'string' || limit.length === 0) return undefined
  if (typeof used !== 'string' || used.length === 0) return undefined
  if (typeof remaining !== 'string' || remaining.length === 0) return undefined
  if (typeof remainingPercent !== 'number'
    || !Number.isFinite(remainingPercent)
    || remainingPercent < 0
    || remainingPercent > 100) {
    return undefined
  }
  return { limit, used, remaining, remainingPercent }
}

/** Narrow a secret-free usage snapshot before it enters React state. */
export function decodeCodexUsage(value: unknown): CodexUsage | undefined {
  if (!isRecord(value) || hasTokenFields(value) || !Array.isArray(value['rateLimits'])) return undefined
  const rateLimits: CodexRateLimit[] = []
  for (const item of value['rateLimits']) {
    const limit = decodeRateLimit(item)
    if (limit === undefined) return undefined
    rateLimits.push(limit)
  }
  const credits = decodeCredits(value['credits'])
  if (value['credits'] !== undefined && credits === undefined) return undefined
  const individualLimit = decodeIndividualLimit(value['individualLimit'])
  if (value['individualLimit'] !== undefined && individualLimit === undefined) return undefined
  return {
    rateLimits,
    ...credits === undefined ? {} : { credits },
    ...individualLimit === undefined ? {} : { individualLimit },
  }
}

/** Narrow the Host auth status. Token-shaped fields fail closed. */
export function decodeCodexAuthStatus(value: unknown): CodexHostAuthStatus | undefined {
  if (!isRecord(value) || hasTokenFields(value)) return undefined
  const status = value['status']
  if (status === 'signed-out' || status === 'signing-in') return { status }
  if (status === 'reauth-required' || status === 'error') {
    if (typeof value['message'] !== 'string' || value['message'].length === 0) return undefined
    return { status, message: value['message'] }
  }
  if (status !== 'signed-in') return undefined
  const usage = decodeCodexUsage(value['usage'])
  if (usage === undefined) return undefined
  const quotaError = value['quotaError']
  if (quotaError !== undefined && (typeof quotaError !== 'string' || quotaError.length === 0)) return undefined
  return {
    status,
    usage,
    ...quotaError === undefined ? {} : { quotaError },
  }
}

/** Narrow the Host login reply. Only an http(s) system-browser URL is accepted. */
export function decodeCodexAuthLoginReply(value: unknown): CodexAuthLoginReply | undefined {
  if (!isRecord(value) || hasTokenFields(value)) return undefined
  const url = value['url']
  const verificationUri = value['verificationUri']
  const userCode = value['userCode']
  const attemptId = value['attemptId']
  if (attemptId !== undefined && (typeof attemptId !== 'string' || attemptId.length === 0)) return undefined
  if (url !== undefined) {
    if (typeof url !== 'string' || url.length === 0) return undefined
    try { const parsed = new URL(url); if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined } catch { return undefined }
  }
  if (verificationUri !== undefined && (typeof verificationUri !== 'string' || verificationUri.length === 0)) return undefined
  if (userCode !== undefined && (typeof userCode !== 'string' || userCode.length === 0)) return undefined
  const expiresAt = value['expiresAt']
  if (expiresAt !== undefined && (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt))) return undefined
  if (url === undefined && (verificationUri === undefined || userCode === undefined)) return undefined
  return { ...(url === undefined ? {} : { url }), ...(verificationUri === undefined ? {} : { verificationUri }), ...(userCode === undefined ? {} : { userCode }), ...(expiresAt === undefined ? {} : { expiresAt }), ...(attemptId === undefined ? {} : { attemptId }) }
}

/** Narrow secret-free auth attempt status. */
export function decodeCodexAuthAttemptStatus(value: unknown): CodexAuthAttemptStatus | undefined {
  if (!isRecord(value) || hasTokenFields(value)) return undefined
  const status = value['status']
  return status === 'pending' || status === 'succeeded' || status === 'failed' || status === 'cancelled' || status === 'missing'
    ? { status } : undefined
}

/** Narrow the Host logout reply. */
export function decodeCodexAuthLogoutReply(value: unknown): CodexAuthLogoutReply | undefined {
  if (!isRecord(value) || hasTokenFields(value) || value['ok'] !== true) return undefined
  return { ok: true }
}

/** Frozen default catalog exported for tests and the picker. */
export const CODEX_CATALOG: readonly CodexCatalogModel[] = Object.freeze(defaultDisplayedCatalog())
