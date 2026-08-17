/** Live ChatGPT Codex rate-limit usage for the browser account page. */
import type { CodexUsage } from './client-contract.ts';
import type { CodexCredentialStore } from './store.ts';
export type { CodexCredits, CodexIndividualLimit, CodexRateLimit, CodexRateLimitWindow, CodexUsage, } from './client-contract.ts';
export declare const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
export declare const CODEX_REAUTH_REQUIRED_CODE: "CODEX_REAUTH_REQUIRED";
export declare const CODEX_REAUTH_REQUIRED_MESSAGE = "Codex authorization must be renewed";
export declare class CodexReauthRequiredError extends Error {
    readonly code: "CODEX_REAUTH_REQUIRED";
    constructor();
}
export declare function isCodexReauthRequiredError(error: unknown): error is CodexReauthRequiredError;
/** Convert the provider response into the small secret-free object sent to the browser. */
export declare function parseCodexUsage(value: unknown): CodexUsage;
/** Read current quota without issuing a model request. */
export declare function readCodexRateLimits(store: CodexCredentialStore): Promise<CodexUsage>;
//# sourceMappingURL=usage.d.ts.map