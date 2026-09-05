/**
 * Codex subscription chat adapter. The public route is `codex`; the wire
 * implementation is pi-ai openai-codex-responses plus Fast service_tier.
 */

import { LlmAdapter, LlmError, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type {
  GenerateOptions,
  LlmModelInfo,
  LlmProviderInfo,
  LlmResolvedModelInfo,
  ResolvedRetryPolicy,
  StreamChunk,
} from '@deepseek-ai/dsh-llm'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'
import type { ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import { createModels } from '@earendil-works/pi-ai'
import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex'
import { CODEX_PROVIDER } from './client-contract.ts'
import { CODEX_EFFORT_LABELS, defaultCodexReasoningEffort, effortsForCodexModel } from './catalog.ts'
import { createCodexPiAiProfile } from './pi-ai-profile.ts'
import type { CodexConnectionOptions } from './pi-ai-profile.ts'
import { createPiAiAuth } from './pi-ai-auth.ts'
import type { CodexCredentialStore } from './store.ts'
import { OPENAI_CODEX_PROVIDER } from './store.ts'

export type { CodexConnectionOptions } from './pi-ai-profile.ts'

export interface CodexAdapterOptions {
  options: () => CodexConnectionOptions
  resolveApiKey: () => Promise<string>
  /** Force-refresh ChatGPT OAuth after a content-less AUTH finish. */
  refreshApiKey?: () => Promise<string>
  resolveAttachments?: () => AttachmentStore | undefined
}

/** Resolve the current ChatGPT access token, or throw a typed LlmError. */
export async function resolveCodexAccessToken(store: CodexCredentialStore): Promise<string> {
  const models = createModels({ credentials: store })
  models.setProvider(openaiCodexProvider())
  const existing = await store.read(OPENAI_CODEX_PROVIDER)
  const auth = await models.getAuth(OPENAI_CODEX_PROVIDER)
  const access = auth?.auth.apiKey
  if (access === undefined || access.length === 0) {
    if (existing !== undefined) {
      throw new LlmError(
        'llm-codex: session refresh failed; sign in again with ChatGPT',
        'AUTH',
      )
    }
    throw new LlmError(
      'llm-codex: not signed in; sign in with ChatGPT from Plugin configuration',
      'MISSING_CREDENTIAL',
    )
  }
  return access
}

/**
 * Force getAuth to refresh by marking the stored access token expired.
 * @param store - Host-backed Codex OAuth store.
 * @returns the refreshed ChatGPT access token.
 */
export async function refreshCodexAccessToken(store: CodexCredentialStore): Promise<string> {
  await store.modify(OPENAI_CODEX_PROVIDER, async (current) => {
    if (current === undefined || current.type !== 'oauth') return current
    return { ...current, expires: 1 }
  })
  return resolveCodexAccessToken(store)
}

function isAuthFinish(chunk: StreamChunk): boolean {
  return chunk.type === 'finish' && chunk.reason.kind === 'error' && chunk.reason.failure.code === 'AUTH'
}

function isModelContent(chunk: StreamChunk): boolean {
  return chunk.type === 'block-start'
    || chunk.type === 'text-delta'
    || chunk.type === 'reasoning-delta'
    || chunk.type === 'tool-call-delta'
    || chunk.type === 'block-end'
}

/**
 * Replay a stream once after a content-less AUTH finish, forcing a token refresh first.
 * @param stream - one request-scoped model stream factory.
 * @param options - the same generate options passed to both attempts.
 * @param classify - per-chunk error remapping applied to both attempts.
 * @param refreshApiKey - force-refresh hook; omitted means AUTH is not retried here.
 * @returns chunks from the first successful attempt, or the original AUTH finish.
 */
export async function* streamWithAuthRetry(
  stream: (options: GenerateOptions) => AsyncIterable<StreamChunk>,
  options: GenerateOptions,
  classify: (chunk: StreamChunk) => StreamChunk,
  refreshApiKey: (() => Promise<string>) | undefined,
): AsyncGenerator<StreamChunk> {
  const buffered: StreamChunk[] = []
  let sawContent = false
  for await (const raw of stream(options)) {
    const chunk = classify(raw)
    if (isAuthFinish(chunk) && !sawContent && refreshApiKey !== undefined) {
      try {
        await refreshApiKey()
      } catch (error) {
        // Only AUTH/MISSING_CREDENTIAL from a failed refresh stay here; abort must
        // surface as cancellation, not as a fake AUTH finish.
        if (options.signal?.aborted === true || (error instanceof Error && error.name === 'AbortError')) throw error
        yield* buffered
        yield chunk
        return
      }
      options.signal?.throwIfAborted()
      for await (const retryRaw of stream(options)) {
        yield classify(retryRaw)
      }
      return
    }
    if (isModelContent(chunk)) {
      sawContent = true
      yield* buffered
      buffered.length = 0
      yield chunk
      continue
    }
    if (sawContent) yield chunk
    else buffered.push(chunk)
  }
  yield* buffered
}

/**
 * Apply the plugin-owned default only when pi-ai advertises that exact level.
 * A conversation's explicit reasoningEffort still takes precedence in DSH.
 */
export function applyCodexDefaultReasoningMetadata(
  info: LlmResolvedModelInfo,
  model: string,
  override?: string,
  advertisedEfforts?: readonly string[],
): LlmResolvedModelInfo {
  if (info.reasoning === undefined) return info
  const reasoning = advertisedEfforts === undefined
    ? info.reasoning
    : {
        ...info.reasoning,
        efforts: advertisedEfforts.map(effort => ({
          id: ReasoningEffortId(effort),
          name: CODEX_EFFORT_LABELS[effort] ?? effort,
        })),
      }
  const wanted = override ?? defaultCodexReasoningEffort(model)
  const defaultEffort = ReasoningEffortId(wanted)
  if (!reasoning.efforts.some(effort => effort.id === defaultEffort)) {
    return reasoning === info.reasoning ? info : { ...info, reasoning }
  }
  return {
    ...info,
    reasoning: { ...reasoning, defaultEffort },
  }
}

function codexReasoningEfforts(model: CodexConnectionOptions['models'][number] | undefined): readonly string[] | undefined {
  if (model === undefined) return undefined
  const efforts = effortsForCodexModel(model)
  return efforts.length === 0 ? undefined : efforts
}


/**
 * Classify ChatGPT WebSocket failures that pi-ai reports without an HTTP status.
 * @param chunk - One delegated DSH stream chunk.
 * @returns The original chunk, or a copy with a retryable transport code.
 */
export function classifyCodexTransientError(chunk: StreamChunk): StreamChunk {
  if (chunk.type !== 'finish' || chunk.reason.kind !== 'error' || chunk.reason.failure.code !== 'PI_AI_ERROR') {
    return chunk
  }
  const message = chunk.reason.failure.message
  const closed = /^WebSocket closed(?:\s+(\d+))?(?:\s+.*)?$/iu.exec(message)
  const transport = /^WebSocket (?:error|stream closed before response\.completed)$/iu.test(message)
    || (closed !== null && closed[1] !== '1009')
  const code = /failed to extract accountId from token|invalid token|no account ID in token|OpenAI Codex token refresh failed/iu.test(message)
    ? 'AUTH'
    : transport
      ? 'TRANSPORT'
      : /overloaded|service unavailable|websocket_connection_limit_reached/iu.test(message)
        ? 'SERVER'
        : undefined
  if (code === undefined) return chunk
  return {
    ...chunk,
    reason: {
      ...chunk.reason,
      failure: { ...chunk.reason.failure, code },
    },
  }
}


const SANDBOX_MODE_RANK: Record<string, number> = {
  'read-only': 0,
  'workspace-write': 1,
  'danger-full-access': 2,
}

/**
 * Remove sandbox escalation choices that cannot be strictly wider than the
 * current DSH policy. Core still validates every retained request; this only
 * prevents Codex from selecting an impossible optional enum value.
 */
export function narrowCodexEscalationSchemas(options: GenerateOptions): GenerateOptions {
  const mode = sandboxModeOf(options)
  const currentRank = mode === undefined ? undefined : SANDBOX_MODE_RANK[mode]
  if (currentRank === undefined || options.tools === undefined) return options
  let changed = false
  const tools = options.tools.map((tool) => {
    const parameters = tool.parameters
    const properties = isRecord(parameters.properties) ? parameters.properties : undefined
    const permission = properties === undefined || !isRecord(properties.sandbox_permissions)
      ? undefined
      : properties.sandbox_permissions
    if (permission === undefined || !Array.isArray(permission.enum)) return tool
    const wider = permission.enum.filter((candidate): candidate is string => {
      return typeof candidate === 'string' && (SANDBOX_MODE_RANK[candidate] ?? -1) > currentRank
    })
    if (wider.length === permission.enum.length) return tool
    changed = true
    const nextProperties = { ...properties }
    if (wider.length === 0) {
      delete nextProperties.sandbox_permissions
      delete nextProperties.justification
    } else {
      nextProperties.sandbox_permissions = { ...permission, enum: wider }
    }
    const required = Array.isArray(parameters.required)
      ? parameters.required.filter(name => name !== 'sandbox_permissions' && name !== 'justification')
      : undefined
    return {
      ...tool,
      parameters: {
        ...parameters,
        properties: nextProperties,
        ...(required === undefined ? {} : { required }),
      },
    }
  })
  return changed ? { ...options, tools } : options
}

function sandboxModeOf(options: GenerateOptions): string | undefined {
  for (let index = options.messages.length - 1; index >= 0; index -= 1) {
    const message = options.messages[index]
    if (!isRecord(message)) continue
    const found = sandboxModeIn(message.content)
    if (found !== undefined) return found
  }
  return sandboxModeIn(options.system)
}

function sandboxModeIn(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return /Current DSH file policy:\s*(read-only|workspace-write|danger-full-access)\./u.exec(value)?.[1]
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = sandboxModeIn(item)
      if (found !== undefined) return found
    }
    return undefined
  }
  if (!isRecord(value)) return undefined
  return sandboxModeIn(value.text) ?? sandboxModeIn(value.content)
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** ChatGPT subscription adapter backed by pi-ai Codex Responses. */
export class CodexAdapter extends LlmAdapter {
  private readonly auth = createPiAiAuth()
  private snapshot: { options: CodexConnectionOptions, adapter: PiAiAdapter } | undefined

  constructor(private readonly config: CodexAdapterOptions) {
    super()
  }

  private current(): PiAiAdapter {
    const options = this.config.options()
    if (this.snapshot?.options === options) return this.snapshot.adapter
    const profile = createCodexPiAiProfile(options)
    const profiles = new Map<string, ResolvedPiAiProviderProfile>([[CODEX_PROVIDER, profile]])
    const adapterOptions = {
      profiles: () => profiles,
      resolveApiKey: () => this.config.resolveApiKey(),
      auth: this.auth,
      ...this.config.resolveAttachments === undefined
        ? {}
        : { resolveAttachments: this.config.resolveAttachments },
    }
    const adapter = new PiAiAdapter(adapterOptions)
    this.snapshot = { options, adapter }
    return adapter
  }

  override providerInfo(provider: string): LlmProviderInfo {
    return this.current().providerInfo(provider)
  }

  override providerRetryPolicy(provider: string): ResolvedRetryPolicy | undefined {
    return this.current().providerRetryPolicy(provider)
  }

  /**
   * Declare neutral request-image pricing when a newer Host calls this adapter.
   * @param _provider - provider route.
   * @param _model - model id.
   * @returns `undefined` so the Host uses heuristic image pricing.
   */
  override imageRequestPricing(_provider: string, _model: string): undefined {
    return undefined
  }

  override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    this.snapshot = undefined
    return this.current().listModels(provider)
  }

  override async resolveModel(
    provider: string,
    model: string,
    signal?: AbortSignal,
  ): Promise<LlmResolvedModelInfo> {
    const info = await this.current().resolveModel(provider, model, signal)
    const catalog = this.config.options().models.find(entry => entry.id === model)
    return applyCodexDefaultReasoningMetadata(info, model, catalog?.defaultEffort, codexReasoningEfforts(catalog))
  }

  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    yield* streamWithAuthRetry(
      opts => this.current().stream(narrowCodexEscalationSchemas(opts)),
      options,
      classifyCodexTransientError,
      this.config.refreshApiKey,
    )
  }

  /** Own the method so rc.2 Host can call it even when this class extends an older LlmAdapter. */
  override async prepareCall(provider: string, model: string, signal?: AbortSignal) {
    const delegate = this.current()
    const catalog = this.config.options().models.find(entry => entry.id === model)
    const inner = typeof (delegate as { prepareCall?: unknown }).prepareCall === 'function'
      ? await (delegate as unknown as { prepareCall: (provider: string, model: string, signal?: AbortSignal) => Promise<{
        model: LlmResolvedModelInfo
        stream: (options: GenerateOptions) => AsyncIterable<StreamChunk>
      }> }).prepareCall(provider, model, signal)
      : {
        model: await this.resolveModel(provider, model, signal),
        stream: (options: GenerateOptions) => delegate.stream(options),
      }
    const refreshApiKey = this.config.refreshApiKey
    const modelInfo = applyCodexDefaultReasoningMetadata(
      inner.model,
      model,
      catalog?.defaultEffort,
      codexReasoningEfforts(catalog),
    )
    return {
      model: modelInfo,
      stream: (options: GenerateOptions) => streamWithAuthRetry(
        opts => inner.stream(narrowCodexEscalationSchemas(opts)) as AsyncIterable<StreamChunk>,
        options,
        classifyCodexTransientError,
        refreshApiKey,
      ),
    }
  }
}
