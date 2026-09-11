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
/**
 * Whether one failure means the Codex credential is missing or no longer
 * usable, rather than a transport or provider failure.
 * @param error - value caught from credential resolution or a usage read.
 * @returns true when the account cannot serve quota until it signs in again.
 */
export declare function isCodexCredentialFailure(error: unknown): boolean;
/**
 * Whether one failure confirms the stored credential cannot be used. Only a
 * refusal this process can observe directly counts: a document the store will
 * not serve. Credential resolution wraps store failures, so the causes are
 * walked; a token refresh that fails on the network stays unconfirmed, because
 * its failure says nothing about whether the credential is still valid.
 * @param error - value caught from credential resolution.
 * @returns true only for a credential the store itself rejected.
 */
export declare function isCodexCredentialUnusableError(error: unknown): boolean;
/** Convert the provider response into the small secret-free object sent to the browser. */
export declare function parseCodexUsage(value: unknown, now?: number): CodexUsage;
/** Read current quota without issuing a model request. */
export declare function readCodexRateLimits(store: CodexCredentialStore): Promise<CodexUsage>;
//# sourceMappingURL=usage.d.ts.map