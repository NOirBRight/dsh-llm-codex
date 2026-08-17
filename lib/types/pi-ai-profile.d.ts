/**
 * Translate the displayed Codex catalog into a pi-ai profile on the public
 * `codex` route. Chat still uses openai-codex-responses; Fast rows rewrite
 * the wire model id and inject service_tier.
 */
import type { ProviderStreams } from '@earendil-works/pi-ai';
import type { ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai';
import type { ResolvedRetryPolicy } from '@deepseek-ai/dsh-llm';
import type { CodexCatalogModel } from './catalog.ts';
export declare const CODEX_CHAT_BASE_URL = "https://chatgpt.com/backend-api";
export declare const CODEX_DEFAULT_CONTEXT_WINDOW = 272000;
export declare const CODEX_DEFAULT_MODEL_MAX_TOKENS = 128000;
export interface CodexConnectionOptions {
    models: readonly CodexCatalogModel[];
    streamIdleTimeoutMs: number;
    retryPolicy: ResolvedRetryPolicy;
}
export declare function codexResponsesApi(): ProviderStreams;
export declare function createCodexPiAiProfile(connection: CodexConnectionOptions): ResolvedPiAiProviderProfile;
//# sourceMappingURL=pi-ai-profile.d.ts.map