/** Same-origin Web settings routes for Codex OAuth. */
import type { IncomingMessage } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
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
interface LoginChallenge {
    url: string;
}
export interface CodexWebAuthOptions {
    challengeTimeoutMs?: number;
    openBrowser?: (url: string) => Promise<void>;
}
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
    constructor(store: CodexCredentialStore, options?: CodexWebAuthOptions);
    status(): Promise<CodexWebAuthStatus>;
    signIn(): Promise<LoginChallenge>;
    signOut(): Promise<void>;
    dispose(): Promise<void>;
    private start;
    private onEvent;
    private readStoredStatus;
    private rejectChallenge;
    private clearChallengeTimer;
    private cancelSignIn;
}
export declare function trustedRequest(req: IncomingMessage): boolean;
export declare function registerCodexAuthRoutes(ctx: Context, store: CodexCredentialStore): void;
export {};
//# sourceMappingURL=auth-routes.d.ts.map