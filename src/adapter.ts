/**
 * Codex subscription chat adapter. The public route is `codex`; the wire
 * implementation is pi-ai openai-codex-responses plus Fast service_tier.
 */

import { LlmAdapter, LlmError } from '@deepseek-ai/dsh-llm'
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
import { createCodexPiAiProfile } from './pi-ai-profile.ts'
import type { CodexConnectionOptions } from './pi-ai-profile.ts'
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

export class CodexAdapter extends LlmAdapter {
  private snapshot: { options: CodexConnectionOptions, adapter: PiAiAdapter } | undefined

  constructor(private readonly config: CodexAdapterOptions) {
    super()
  }

  private current(): PiAiAdapter {
    const options = this.config.options()
    if (this.snapshot?.options === options) return this.snapshot.adapter
    const profile = createCodexPiAiProfile(options)
    const profiles = new Map<string, ResolvedPiAiProviderProfile>([[CODEX_PROVIDER, profile]])
    const adapter = new PiAiAdapter({
      profiles: () => profiles,
      resolveApiKey: () => this.config.resolveApiKey(),
      ...this.config.resolveAttachments === undefined
        ? {}
        : { resolveAttachments: this.config.resolveAttachments },
    })
    this.snapshot = { options, adapter }
    return adapter
  }

  override providerInfo(provider: string): LlmProviderInfo {
    return this.current().providerInfo(provider)
  }

  override providerRetryPolicy(provider: string): ResolvedRetryPolicy | undefined {
    return this.current().providerRetryPolicy(provider)
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
    return this.current().resolveModel(provider, model, signal)
  }

  override stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    return this.current().stream(options)
  }
}
