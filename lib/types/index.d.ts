/**
 * Register the `codex` provider, ChatGPT OAuth, sortable catalog, and
 * optional search / view_image / codex_generate_image capabilities.
 * @module dsh-llm-codex
 */
import type { Context, Volatile, VolatileSnapshot } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection';
import type { RetryPolicyConfig } from '@deepseek-ai/dsh-llm';
import type { CodexConnectionOptions } from './adapter.ts';
import { CodexWebAuth } from './codex-web-auth.ts';
import type { CodexCatalogModel, CodexSearchContextSize, CodexSearchMode } from './client-contract.ts';
export { CodexAdapter, refreshCodexAccessToken, resolveCodexAccessToken } from './adapter.ts';
export type { CodexAdapterOptions, CodexConnectionOptions } from './adapter.ts';
export { CODEX_CATALOG, CODEX_DEFAULT_STREAM_IDLE_TIMEOUT_MS, CODEX_PROVIDER, CODEX_RPC_ENDPOINT, CODEX_SAVE_ENDPOINT, CODEX_MODELS_FETCH_ENDPOINT, CODEX_AUTH_STATUS_ENDPOINT, CODEX_AUTH_BEGIN_ENDPOINT, CODEX_AUTH_CANCEL_ENDPOINT, CODEX_AUTH_ATTEMPT_STATUS_ENDPOINT, CODEX_AUTH_LOGOUT_ENDPOINT, CODEX_SETTINGS_NAMESPACE, CODEX_SETTINGS_ENTRY_ID, DEFAULT_CODEX_SETTINGS, DEFAULT_CODEX_SEARCH_CONTEXT_SIZE, DEFAULT_CODEX_SEARCH_MAX_OUTPUT_TOKENS, DEFAULT_CODEX_IMAGE_GENERATION_MODEL, DEFAULT_CODEX_SEARCH_MODE, DEFAULT_CODEX_SEARCH_MODEL, decodeCodexSettings, decodeCodexSaveRequest, decodeCodexSaveResult, decodeCodexCatalogModel, decodeCodexModelCatalog, } from './client-contract.ts';
export type { CodexCatalogModel, CodexSaveRequest, CodexSaveResult, CodexSearchContextSize, CodexSearchMode, CodexSettingsView, } from './client-contract.ts';
export { CODEX_FAST_SERVICE_TIER, CODEX_FAST_SUFFIX, CODEX_LARGE_CONTEXT_SUFFIX, CODEX_LARGE_CONTEXT_WINDOW, CODEX_OFFICIAL_MODELS, defaultDisplayedCatalog, officialImageGenerationModels, officialPickerCatalog, resolveWireModel, hydrateCatalogModel, } from './catalog.ts';
export { CODEX_MODELS_URL, CODEX_MODEL_CACHE_FILENAME, refreshCodexModelCatalog } from './remote-catalog.ts';
export { applyCodexWirePayload, applyCodexCatalogWire } from './service-tier.ts';
export { CodexCredentialStore, CODEX_AUTH_FILENAME, OPENAI_CODEX_PROVIDER, codexAuthPath, } from './store.ts';
export { loginCodex, logoutCodex, codexAuthStatus } from './auth.ts';
export type { CodexAuthStatus } from './auth.ts';
export { CODEX_USAGE_URL, parseCodexUsage, readCodexRateLimits, CodexReauthRequiredError, isCodexReauthRequiredError, } from './usage.ts';
export type { CodexCredits, CodexIndividualLimit, CodexRateLimit, CodexRateLimitWindow, CodexUsage, } from './usage.ts';
export { CodexSearchProvider, CODEX_BASE_URL, CODEX_SEARCH_PROVIDER, CODEX_SEARCH_URL, externalWebAccess, mapCodexSearchResponse, } from './search.ts';
export { VIEW_IMAGE_TOOL_NAME } from './view-image.ts';
export { installCodexModelSwitchAdapters } from './model-switch-adapter.ts';
export { GENERATE_IMAGE_TOOL_NAME, generateImageTool } from './generate-image.ts';
export { createCodexPiAiProfile, CODEX_CHAT_BASE_URL, codexResponsesApi } from './pi-ai-profile.ts';
export { CodexWebAuth } from './codex-web-auth.ts';
export declare const name = "llm-codex";
export declare const inject: string[];
export interface Config {
    streamIdleTimeoutMs?: number;
    models: Volatile<CodexCatalogModel[] | undefined>;
    enableSearch: Volatile<boolean>;
    enableImageTool: Volatile<boolean>;
    enableImageGeneration: Volatile<boolean>;
    searchModel: Volatile<string>;
    imageGenerationModel: Volatile<string>;
    searchMode: Volatile<CodexSearchMode>;
    searchContextSize: Volatile<CodexSearchContextSize>;
    searchMaxOutputTokens: Volatile<number>;
    retryPolicy?: RetryPolicyConfig;
    /** Set false when Model Switch owns stable tool names, preventing legacy duplicates. */
    registerLegacyTools?: boolean;
}
interface RuntimeConfig {
    streamIdleTimeoutMs?: number;
    models?: VolatileSnapshot<CodexCatalogModel[] | undefined>;
    enableSearch?: boolean;
    enableImageTool?: boolean;
    enableImageGeneration?: boolean;
    searchModel?: string;
    imageGenerationModel?: string;
    searchMode?: CodexSearchMode;
    searchContextSize?: CodexSearchContextSize;
    searchMaxOutputTokens?: number;
    retryPolicy?: RetryPolicyConfig;
    registerLegacyTools?: boolean;
}
type ConfigInput = Omit<RuntimeConfig, 'models'> & {
    models?: CodexCatalogModel[];
};
export declare const Config: z<ConfigInput, Config>;
export declare function resolveAdapterOptions(config: Config | RuntimeConfig): CodexConnectionOptions;
export declare function createCodexManagementRpcHandler(ctx: Context, auth: CodexWebAuth, fetchModels?: () => Promise<readonly CodexCatalogModel[]>, getConfig?: () => RuntimeConfig): ConnectionRpcHandler;
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=index.d.ts.map