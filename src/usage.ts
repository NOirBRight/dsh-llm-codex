/** Live ChatGPT Codex rate-limit usage for the browser account page. */

import { createModels } from '@earendil-works/pi-ai'
import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex'
import type {
  CodexCredits,
  CodexIndividualLimit,
  CodexRateLimit,
  CodexRateLimitWindow,
  CodexUsage,
} from './client-contract.ts'
import type { CodexCredentialStore } from './store.ts'
import { OPENAI_CODEX_PROVIDER } from './store.ts'

export type {
  CodexCredits,
  CodexIndividualLimit,
  CodexRateLimit,
  CodexRateLimitWindow,
  CodexUsage,
} from './client-contract.ts'

export const CODEX_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage'
const USAGE_REQUEST_TIMEOUT_MS = 15_000
export const CODEX_REAUTH_REQUIRED_CODE = 'CODEX_REAUTH_REQUIRED' as const
export const CODEX_REAUTH_REQUIRED_MESSAGE = 'Codex authorization must be renewed'

export class CodexReauthRequiredError extends Error {
  readonly code = CODEX_REAUTH_REQUIRED_CODE

  constructor() {
    super(CODEX_REAUTH_REQUIRED_MESSAGE)
    this.name = 'CodexReauthRequiredError'
  }
}

export function isCodexReauthRequiredError(error: unknown): error is CodexReauthRequiredError {
  return error instanceof CodexReauthRequiredError
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isoInstant(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const ms = value < 1e12 ? value * 1000 : value
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
  }
}

function parseResetAt(record: Record<string, unknown>, now: number): string | undefined {
  const direct = isoInstant(record['reset_at'] ?? record['resetAt'] ?? record['resetsAt'])
  if (direct !== undefined) return direct
  const after = record['reset_after_seconds'] ?? record['resetAfterSeconds']
  if (typeof after === 'number' && Number.isFinite(after) && after >= 0) {
    return new Date(now + after * 1000).toISOString()
  }
}

function parseWindow(value: unknown, now: number): CodexRateLimitWindow | undefined {
  if (value === undefined || value === null) return undefined
  if (!isRecord(value)) throw new Error('Codex returned a malformed rate-limit window')
  const usedPercent = value['used_percent']
  const windowSeconds = value['limit_window_seconds']
  if (typeof usedPercent !== 'number' || !Number.isFinite(usedPercent) || usedPercent < 0 || usedPercent > 100) {
    throw new Error('Codex returned an invalid used percentage')
  }
  if (typeof windowSeconds !== 'number' || !Number.isInteger(windowSeconds) || windowSeconds <= 0) {
    throw new Error('Codex returned an invalid rate-limit window duration')
  }
  const resetsAt = parseResetAt(value, now)
  return {
    remainingPercent: 100 - usedPercent,
    windowSeconds,
    ...resetsAt === undefined ? {} : { resetsAt },
  }
}

function parseLimit(id: string, name: string | undefined, value: unknown, now: number): CodexRateLimit | undefined {
  if (value === undefined || value === null) return undefined
  if (!isRecord(value)) throw new Error('Codex returned malformed rate-limit details')
  const windows = [parseWindow(value['primary_window'], now), parseWindow(value['secondary_window'], now)]
    .filter(window => window !== undefined)
  return windows.length === 0 ? undefined : { id, ...name === undefined ? {} : { name }, windows }
}

function exactAmount(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.length === 0 || value.length > 64 || !/^-?\d+(?:\.\d+)?$/u.test(value)) {
    throw new Error(`Codex returned an invalid ${key} amount`)
  }
  return value
}

function parseCredits(value: unknown): CodexCredits | undefined {
  if (value === undefined || value === null) return undefined
  if (!isRecord(value) || typeof value['has_credits'] !== 'boolean' || typeof value['unlimited'] !== 'boolean') {
    throw new Error('Codex returned malformed credit details')
  }
  if (!value['has_credits']) return undefined
  const balance = value['balance']
  if (balance !== undefined && balance !== null
    && (typeof balance !== 'string' || balance.length === 0 || balance.length > 64 || !/^-?\d+(?:\.\d+)?$/u.test(balance))) {
    throw new Error('Codex returned an invalid credit balance')
  }
  return {
    unlimited: value['unlimited'],
    ...typeof balance === 'string' ? { balance } : {},
  }
}

function parseIndividualLimit(value: unknown): CodexIndividualLimit | undefined {
  if (value === undefined || value === null) return undefined
  if (!isRecord(value)) throw new Error('Codex returned malformed spend-control details')
  const individual = value['individual_limit']
  if (individual === undefined || individual === null) return undefined
  if (!isRecord(individual)) throw new Error('Codex returned a malformed individual limit')
  const remainingPercent = individual['remaining_percent']
  if (typeof remainingPercent !== 'number' || !Number.isFinite(remainingPercent)
    || remainingPercent < 0 || remainingPercent > 100) {
    throw new Error('Codex returned an invalid individual-limit percentage')
  }
  return {
    limit: exactAmount(individual, 'limit'),
    used: exactAmount(individual, 'used'),
    remaining: exactAmount(individual, 'remaining'),
    remainingPercent,
  }
}

/** Convert the provider response into the small secret-free object sent to the browser. */
export function parseCodexUsage(value: unknown, now = Date.now()): CodexUsage {
  if (!isRecord(value)) throw new Error('Codex returned a malformed usage response')
  const limitsById = new Map<string, CodexRateLimit>()
  const appendLimit = (limit: CodexRateLimit): void => {
    const existing = limitsById.get(limit.id)
    if (existing === undefined) {
      limitsById.set(limit.id, limit)
      return
    }
    const knownWindowSeconds = new Set(existing.windows.map(window => window.windowSeconds))
    const windows = [
      ...existing.windows,
      ...limit.windows.filter(window => !knownWindowSeconds.has(window.windowSeconds)),
    ]
    limitsById.set(limit.id, {
      ...existing,
      ...existing.name === undefined && limit.name !== undefined ? { name: limit.name } : {},
      windows,
    })
  }
  const primary = parseLimit('codex', 'Codex', value['rate_limit'], now)
  if (primary !== undefined) appendLimit(primary)
  const additional = value['additional_rate_limits']
  if (additional !== undefined && additional !== null && !Array.isArray(additional)) {
    throw new Error('Codex returned malformed additional rate limits')
  }
  for (const item of additional ?? []) {
    if (!isRecord(item)) throw new Error('Codex returned a malformed additional rate limit')
    const id = item['metered_feature']
    const name = item['limit_name']
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error('Codex returned an additional rate limit without an id')
    }
    if (name !== undefined && name !== null && typeof name !== 'string') {
      throw new Error('Codex returned an invalid additional rate-limit name')
    }
    const limit = parseLimit(
      id,
      typeof name === 'string' && name.length > 0 ? name : undefined,
      item['rate_limit'],
      now,
    )
    if (limit !== undefined) appendLimit(limit)
  }
  const limits = [...limitsById.values()]
  const credits = parseCredits(value['credits'])
  const individualLimit = parseIndividualLimit(value['spend_control'])
  return {
    rateLimits: limits,
    ...credits === undefined ? {} : { credits },
    ...individualLimit === undefined ? {} : { individualLimit },
  }
}

/** Read current quota without issuing a model request. */
export async function readCodexRateLimits(store: CodexCredentialStore): Promise<CodexUsage> {
  const models = createModels({ credentials: store })
  models.setProvider(openaiCodexProvider())
  const auth = await models.getAuth(OPENAI_CODEX_PROVIDER)
  const credential = await store.read(OPENAI_CODEX_PROVIDER)
  const access = auth?.auth.apiKey
  const accountId = credential?.type === 'oauth' ? credential.accountId : undefined
  if (access === undefined || access.length === 0 || typeof accountId !== 'string' || accountId.length === 0) {
    throw new Error('Codex is signed out')
  }
  const response = await fetch(CODEX_USAGE_URL, {
    method: 'GET',
    redirect: 'error',
    headers: {
      authorization: `Bearer ${access}`,
      'chatgpt-account-id': accountId,
      accept: 'application/json',
      'cache-control': 'no-store',
      'user-agent': 'dsh-llm-codex',
    },
    signal: AbortSignal.timeout(USAGE_REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new CodexReauthRequiredError()
    throw new Error(`Codex usage request failed with HTTP ${response.status}`)
  }
  let value: unknown
  try {
    value = await response.json()
  } catch (error: unknown) {
    throw new Error('Codex returned an unreadable usage response', { cause: error })
  }
  return parseCodexUsage(value)
}
