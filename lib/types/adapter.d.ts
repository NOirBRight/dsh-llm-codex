/**
 * Codex subscription chat adapter. The public route is `codex`; the wire
 * implementation is pi-ai openai-codex-responses plus Fast service_tier.
 */
import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, ResolvedRetryPolicy, StreamChunk } from '@deepseek-ai/dsh-llm';
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import type { CodexConnectionOptions } from './pi-ai-profile.ts';
import type { CodexCredentialStore } from './store.ts';
export type { CodexConnectionOptions } from './pi-ai-profile.ts';
export interface CodexAdapterOptions {
    options: () => CodexConnectionOptions;
    resolveApiKey: () => Promise<string>;
    /** Force-refresh ChatGPT OAuth after a content-less AUTH finish. */
    refreshApiKey?: () => Promise<string>;
    resolveAttachments?: () => AttachmentStore | undefined;
}
/** Resolve the current ChatGPT access token, or throw a typed LlmError. */
export declare function resolveCodexAccessToken(store: CodexCredentialStore): Promise<string>;
/**
 * Force getAuth to refresh by marking the stored access token expired.
 * @param store - Host-backed Codex OAuth store.
 * @returns the refreshed ChatGPT access token.
 */
export declare function refreshCodexAccessToken(store: CodexCredentialStore): Promise<string>;
/**
 * Replay a stream once after a content-less AUTH finish, forcing a token refresh first.
 * @param stream - one request-scoped model stream factory.
 * @param options - the same generate options passed to both attempts.
 * @param classify - per-chunk error remapping applied to both attempts.
 * @param refreshApiKey - force-refresh hook; omitted means AUTH is not retried here.
 * @returns chunks from the first successful attempt, or the original AUTH finish.
 */
export declare function streamWithAuthRetry(stream: (options: GenerateOptions) => AsyncIterable<StreamChunk>, options: GenerateOptions, classify: (chunk: StreamChunk) => StreamChunk, refreshApiKey: (() => Promise<string>) | undefined): AsyncGenerator<StreamChunk>;
/**
 * Apply the plugin-owned default only when pi-ai advertises that exact level.
 * A conversation's explicit reasoningEffort still takes precedence in DSH.
 */
export declare function applyCodexDefaultReasoningMetadata(info: LlmResolvedModelInfo, model: string, override?: string): LlmResolvedModelInfo;
/**
 * Classify ChatGPT WebSocket failures that pi-ai reports without an HTTP status.
 * @param chunk - One delegated DSH stream chunk.
 * @returns The original chunk, or a copy with a retryable transport code.
 */
export declare function classifyCodexTransientError(chunk: StreamChunk): StreamChunk;
/**
 * Remove sandbox escalation choices that cannot be strictly wider than the
 * current DSH policy. Core still validates every retained request; this only
 * prevents Codex from selecting an impossible optional enum value.
 */
export declare function narrowCodexEscalationSchemas(options: GenerateOptions): GenerateOptions;
/** ChatGPT subscription adapter backed by pi-ai Codex Responses. */
export declare class CodexAdapter extends LlmAdapter {
    private readonly config;
    private readonly auth;
    private snapshot;
    constructor(config: CodexAdapterOptions);
    private current;
    providerInfo(provider: string): LlmProviderInfo;
    providerRetryPolicy(provider: string): ResolvedRetryPolicy | undefined;
    /**
     * Declare neutral request-image pricing when a newer Host calls this adapter.
     * @param _provider - provider route.
     * @param _model - model id.
     * @returns `undefined` so the Host uses heuristic image pricing.
     */
    imageRequestPricing(_provider: string, _model: string): undefined;
    listModels(provider: string): Promise<readonly LlmModelInfo[]>;
    resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    /** Own the method so rc.2 Host can call it even when this class extends an older LlmAdapter. */
    prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<{
        model: LlmResolvedModelInfo;
        stream: (options: GenerateOptions) => AsyncGenerator<StreamChunk, any, any>;
    }>;
}
//# sourceMappingURL=adapter.d.ts.map