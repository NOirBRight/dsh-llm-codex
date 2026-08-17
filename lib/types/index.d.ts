/**
 * Register the `codex` provider, ChatGPT OAuth, sortable catalog, and
 * optional search / view_image capabilities.
 * @module dsh-llm-codex
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection';
import type { RetryPolicyConfig } from '@deepseek-ai/dsh-llm';
import type { CodexConnectionOptions } from './adapter.ts';
import type { CodexCatalogModel, CodexSearchContextSize, CodexSearchMode } from './client-contract.ts';
export { CodexAdapter, resolveCodexAccessToken } from './adapter.ts';
export type { CodexAdapterOptions, CodexConnectionOptions } from './adapter.ts';
export { CODEX_CATALOG, CODEX_DEFAULT_STREAM_IDLE_TIMEOUT_MS, CODEX_PROVIDER, CODEX_RPC_CHANNEL, CODEX_SAVE_ENDPOINT, CODEX_SETTINGS_NAMESPACE, CODEX_AUTH_STATUS_PATH, CODEX_AUTH_LOGIN_PATH, CODEX_AUTH_LOGOUT_PATH, DEFAULT_CODEX_SETTINGS, DEFAULT_CODEX_SEARCH_CONTEXT_SIZE, DEFAULT_CODEX_SEARCH_MAX_OUTPUT_TOKENS, DEFAULT_CODEX_SEARCH_MODE, DEFAULT_CODEX_SEARCH_MODEL, decodeCodexSettings, decodeCodexSaveRequest, decodeCodexSaveResult, decodeCodexCatalogModel, } from './client-contract.ts';
export type { CodexCatalogModel, CodexSaveRequest, CodexSaveResult, CodexSearchContextSize, CodexSearchMode, CodexSettingsView, } from './client-contract.ts';
export { CODEX_FAST_SERVICE_TIER, CODEX_FAST_SUFFIX, CODEX_OFFICIAL_MODELS, defaultDisplayedCatalog, officialPickerCatalog, resolveWireModel, hydrateCatalogModel, } from './catalog.ts';
export { applyCodexWirePayload, applyCodexCatalogWire } from './service-tier.ts';
export { CodexCredentialStore, CODEX_AUTH_FILENAME, OPENAI_CODEX_PROVIDER, codexAuthPath, } from './store.ts';
export { loginCodex, logoutCodex, codexAuthStatus } from './auth.ts';
export type { CodexAuthStatus } from './auth.ts';
export { CODEX_USAGE_URL, parseCodexUsage, readCodexRateLimits, CodexReauthRequiredError, isCodexReauthRequiredError, } from './usage.ts';
export type { CodexCredits, CodexIndividualLimit, CodexRateLimit, CodexRateLimitWindow, CodexUsage, } from './usage.ts';
export { CodexSearchProvider, CODEX_BASE_URL, CODEX_SEARCH_PROVIDER, CODEX_SEARCH_URL, externalWebAccess, mapCodexSearchResponse, } from './search.ts';
export { VIEW_IMAGE_TOOL_NAME } from './view-image.ts';
export { createCodexPiAiProfile, CODEX_CHAT_BASE_URL, codexResponsesApi } from './pi-ai-profile.ts';
export { registerCodexAuthRoutes, trustedRequest, CodexWebAuth } from './auth-routes.ts';
export declare const name = "llm-codex";
export declare const inject: string[];
export interface Config {
    streamIdleTimeoutMs?: number;
    models?: CodexCatalogModel[];
    enableSearch?: boolean;
    enableImageTool?: boolean;
    searchModel?: string;
    searchMode?: CodexSearchMode;
    searchContextSize?: CodexSearchContextSize;
    searchMaxOutputTokens?: number;
    retryPolicy?: RetryPolicyConfig;
}
export declare const Config: z<Config>;
export declare function resolveAdapterOptions(config: Config): CodexConnectionOptions;
export declare function createCodexRpcHandler(ctx: Context): ConnectionRpcHandler;
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=index.d.ts.map