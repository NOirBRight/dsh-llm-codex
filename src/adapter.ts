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
import { defaultCodexReasoningEffort } from './catalog.ts'
import { createCodexPiAiProfile } from './pi-ai-profile.ts'
import type { CodexConnectionOptions } from './pi-ai-profile.ts'
import { createPiAiAuth } from './pi-ai-auth.ts'
import type { CodexCredentialStore } from './store.ts'
import { OPENAI_CODEX_PROVIDER } from './store.ts'

export type { CodexConnectionOptions } from './pi-ai-profile.ts'

export interface CodexAdapterOptions {
  options: () => CodexConnectionOptions
  resolveApiKey: () => Promise<string>
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
 * Apply the plugin-owned default only when pi-ai advertises that exact level.
 * A conversation's explicit reasoningEffort still takes precedence in DSH.
 */
export function applyCodexDefaultReasoningMetadata(
  info: LlmResolvedModelInfo,
  model: string,
  override?: string,
): LlmResolvedModelInfo {
  if (info.reasoning === undefined) return info
  const wanted = override ?? defaultCodexReasoningEffort(model)
  const defaultEffort = ReasoningEffortId(wanted)
  if (!info.reasoning.efforts.some(effort => effort.id === defaultEffort)) return info
  return {
    ...info,
    reasoning: { ...info.reasoning, defaultEffort },
  }
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
   * Declare neutral request-image pricing when a newer Host calls an adapter built against an older peer instance.
   * The method omits `override` so the same source compiles against pre-alpha peer types.
   * @param _provider - provider route.
   * @param _model - model id.
   * @returns `undefined` so the Host uses heuristic image pricing.
   */
  imageRequestPricing(_provider: string, _model: string): undefined {
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
    return applyCodexDefaultReasoningMetadata(info, model, catalog?.defaultEffort)
  }

  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    for await (const chunk of this.current().stream(narrowCodexEscalationSchemas(options))) {
      yield classifyCodexTransientError(chunk)
    }
  }

  /** Own the method so rc.2 Host can call it even when this class extends an older LlmAdapter. */
  override async prepareCall(provider: string, model: string, signal?: AbortSignal) {
    const delegate = this.current()
    const inner = typeof (delegate as { prepareCall?: unknown }).prepareCall === 'function'
      ? await (delegate as unknown as { prepareCall: (provider: string, model: string, signal?: AbortSignal) => Promise<{
        model: LlmResolvedModelInfo
        stream: (options: GenerateOptions) => AsyncIterable<StreamChunk>
      }> }).prepareCall(provider, model, signal)
      : {
        model: await this.resolveModel(provider, model, signal),
        stream: (options: GenerateOptions) => delegate.stream(options),
      }
    return {
      model: inner.model,
      stream: async function* (options: GenerateOptions) {
        for await (const chunk of inner.stream(narrowCodexEscalationSchemas(options)) as AsyncIterable<StreamChunk>) {
          yield classifyCodexTransientError(chunk)
        }
      },
    }
  }
}
