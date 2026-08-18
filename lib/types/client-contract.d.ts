/** Browser-safe constants and JSON decoders shared by Host and client faces. */
import type { CodexCatalogModel } from './catalog.ts';
export type { CodexCatalogModel } from './catalog.ts';
/** Settings namespace owned by this plugin. */
export declare const CODEX_SETTINGS_NAMESPACE = "llm-codex";
/** Public DSH provider route. Distinct from pi-ai's internal `openai-codex` id. */
export declare const CODEX_PROVIDER = "codex";
/** Default maximum idle interval while a stream read is outstanding. */
export declare const CODEX_DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300000;
/** Private Connection RPC channel used for catalog save. */
export declare const CODEX_RPC_CHANNEL = "/codex";
/** Atomic settings-save endpoint. */
export declare const CODEX_SAVE_ENDPOINT = "settings/save";
/** Plugin-owned status endpoint consumed by its browser half. */
export declare const CODEX_AUTH_STATUS_PATH = "/plugins/dsh-llm-codex/auth/status";
/** Plugin-owned browser-login endpoint consumed by its browser half. */
export declare const CODEX_AUTH_LOGIN_PATH = "/plugins/dsh-llm-codex/auth/login";
/** Plugin-owned logout endpoint consumed by its browser half. */
export declare const CODEX_AUTH_LOGOUT_PATH = "/plugins/dsh-llm-codex/auth/logout";
/** Search modes accepted by the Codex standalone search endpoint. */
export type CodexSearchMode = 'cached' | 'indexed' | 'live';
/** Search-context sizes accepted by the Codex standalone search endpoint. */
export type CodexSearchContextSize = 'low' | 'medium' | 'high';
/** Default model used by the standalone search endpoint. */
export declare const DEFAULT_CODEX_SEARCH_MODEL = "gpt-5.6-luna";
/** Default search mode, matching the official local Codex client. */
export declare const DEFAULT_CODEX_SEARCH_MODE: CodexSearchMode;
/** Default provider search-context size. */
export declare const DEFAULT_CODEX_SEARCH_CONTEXT_SIZE: CodexSearchContextSize;
/** Default output budget for the standalone search response. */
export declare const DEFAULT_CODEX_SEARCH_MAX_OUTPUT_TOKENS = 10000;
/** Settings fields presented by the package's Web configuration card. */
export interface CodexSettingsView {
    /** Stream idle timeout in milliseconds. */
    streamIdleTimeoutMs: number;
    /** Displayed conversation-picker catalog. */
    models: readonly CodexCatalogModel[];
    /** Register the optional standalone Codex search provider. */
    enableSearch: boolean;
    /** Register the optional image-loading tool. */
    enableImageTool: boolean;
    /** Model used for auxiliary standalone searches. */
    searchModel: string;
    /** Cached, indexed, or live web access. */
    searchMode: CodexSearchMode;
    /** Amount of search context returned by the provider. */
    searchContextSize: CodexSearchContextSize;
    /** Maximum generated tokens returned by the standalone search endpoint. */
    searchMaxOutputTokens: number;
}
/** Atomic editable-settings payload sent by the browser face. */
export interface CodexSaveRequest {
    models: readonly CodexCatalogModel[];
    enableSearch: boolean;
    enableImageTool: boolean;
    searchModel: string;
    searchMode: CodexSearchMode;
    searchContextSize: CodexSearchContextSize;
    searchMaxOutputTokens: number;
    expectedRevision: number;
}
/** Host reply after an accepted settings save. */
export interface CodexSaveResult {
    settings: CodexSettingsView;
    revision: number;
}
/** One quota window expressed as remaining capacity for direct UI rendering. */
export interface CodexRateLimitWindow {
    readonly remainingPercent: number;
    readonly windowSeconds: number;
}
/** One separately metered Codex quota bucket. */
export interface CodexRateLimit {
    readonly id: string;
    readonly name?: string;
    readonly windows: readonly CodexRateLimitWindow[];
}
/** Optional exact prepaid-credit balance returned by ChatGPT. */
export interface CodexCredits {
    readonly unlimited: boolean;
    readonly balance?: string;
}
/** Optional exact workspace member spend limit returned by ChatGPT. */
export interface CodexIndividualLimit {
    readonly limit: string;
    readonly used: string;
    readonly remaining: string;
    readonly remainingPercent: number;
}
/** Secret-free quota projection returned to the browser. */
export interface CodexUsage {
    readonly rateLimits: readonly CodexRateLimit[];
    readonly credits?: CodexCredits;
    readonly individualLimit?: CodexIndividualLimit;
}
/** Host auth JSON. `loading` is client-only and never crosses the wire. */
export type CodexHostAuthStatus = {
    status: 'signed-out';
} | {
    status: 'signing-in';
} | {
    status: 'reauth-required';
    message: string;
} | {
    status: 'signed-in';
    usage: CodexUsage;
    quotaError?: string;
} | {
    status: 'error';
    message: string;
};
/** Browser-facing account snapshot, including the pre-fetch loading state. */
export type CodexAccountStatus = {
    status: 'loading';
} | CodexHostAuthStatus;
/** Host reply after Sign in with ChatGPT opens the system browser. */
export interface CodexAuthLoginReply {
    url: string;
}
/** Host reply after sign-out. */
export interface CodexAuthLogoutReply {
    ok: true;
}
export declare const DEFAULT_CODEX_SETTINGS: Readonly<CodexSettingsView>;
/** Decode one catalog row; unknown extra fields are ignored. */
export declare function decodeCodexCatalogModel(value: unknown): CodexCatalogModel | undefined;
/** Narrow a redacted settings payload before it enters React state. */
export declare function decodeCodexSettings(value: unknown): CodexSettingsView | undefined;
/** Decode a browser save request. */
export declare function decodeCodexSaveRequest(value: unknown): CodexSaveRequest | undefined;
/** Decode a Host save reply. */
export declare function decodeCodexSaveResult(value: unknown): CodexSaveResult | undefined;
/** Narrow a secret-free usage snapshot before it enters React state. */
export declare function decodeCodexUsage(value: unknown): CodexUsage | undefined;
/** Narrow the Host auth status. Token-shaped fields fail closed. */
export declare function decodeCodexAuthStatus(value: unknown): CodexHostAuthStatus | undefined;
/** Narrow the Host login reply. Only an http(s) system-browser URL is accepted. */
export declare function decodeCodexAuthLoginReply(value: unknown): CodexAuthLoginReply | undefined;
/** Narrow the Host logout reply. */
export declare function decodeCodexAuthLogoutReply(value: unknown): CodexAuthLogoutReply | undefined;
/** Frozen default catalog exported for tests and the picker. */
export declare const CODEX_CATALOG: readonly CodexCatalogModel[];
//# sourceMappingURL=client-contract.d.ts.map