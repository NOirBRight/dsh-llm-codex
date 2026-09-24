/** Shared Codex OAuth orchestration for the authenticated plugin RPC. */
import type { CodexCredentialStore } from './store.ts';
import { CODEX_REAUTH_REQUIRED_MESSAGE } from './usage.ts';
import type { CodexUsage } from './usage.ts';
export declare const CODEX_AUTH_URL_TIMEOUT_MS = 30000;
export type CodexWebAuthStatus = {
    status: 'signed-out';
} | {
    status: 'signing-in';
} | {
    status: 'reauth-required';
    message: typeof CODEX_REAUTH_REQUIRED_MESSAGE;
} | {
    status: 'signed-in';
    usage: CodexUsage;
    quotaError?: string;
} | {
    status: 'error';
    message: string;
};
export interface LoginChallenge {
    /** Browser OAuth URL, when the provider uses browser authorization. */
    url?: string;
    /** Headless device verification URI and user code. */
    verificationUri?: string;
    userCode?: string;
    expiresAt?: number;
    attemptId?: string;
}
export interface CodexWebAuthOptions {
    challengeTimeoutMs?: number;
    openBrowser?: (url: string) => Promise<void>;
}
/** Redact token-shaped text from one failure message bound for a client. */
export declare function safeMessage(error: unknown): string;
export declare class CodexWebAuth {
    private readonly store;
    private state;
    private operation;
    private cancellation;
    private challenge;
    private challengeWaiters;
    private challengeTimer;
    private readonly challengeTimeoutMs;
    private readonly openBrowser;
    private loginMethod;
    private attemptId;
    private usageRefresh;
    private readonly attempts;
    constructor(store: CodexCredentialStore, options?: CodexWebAuthOptions);
    status(refresh?: boolean): Promise<CodexWebAuthStatus>;
    signIn(method?: 'browser' | 'device_code'): Promise<LoginChallenge>;
    attemptStatus(attemptId: string): 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'missing';
    cancel(attemptId?: string): boolean;
    signOut(): Promise<void>;
    dispose(): Promise<void>;
    private start;
    private onEvent;
    private readStoredStatus;
    private refreshUsage;
    private rememberAttempt;
    private rejectChallenge;
    private clearChallengeTimer;
    private cancelSignIn;
}
//# sourceMappingURL=codex-web-auth.d.ts.map