/**
 * Owner-only persistent OAuth credential storage.
 * The on-disk document is scoped to pi-ai's openai-codex provider id so
 * login() can persist tokens; the public DSH route remains `codex`.
 */
import type { Credential, CredentialInfo, CredentialStore } from '@earendil-works/pi-ai';
/** pi-ai provider id used by ChatGPT OAuth and this store. */
export declare const OPENAI_CODEX_PROVIDER = "openai-codex";
/** Basename of the OAuth document inside the Harness home. */
export declare const CODEX_AUTH_FILENAME = "codex-oauth.json";
/**
 * The stored credential cannot serve a request: the store refuses its file mode
 * or cannot parse it into a supported document. Says nothing about a transient
 * store failure (I/O, locking), which leaves the credential's usability unknown.
 */
export declare class CodexCredentialUnusableError extends Error {
    constructor(message: string);
}
/** Resolve the default OAuth document path. */
export declare function codexAuthPath(dshHome?: string): string;
/** File-backed pi-ai store scoped to the single OpenAI Codex provider. */
export declare class CodexCredentialStore implements CredentialStore {
    readonly filename: string;
    constructor(filename?: string);
    private readCurrent;
    read(providerId: string): Promise<Credential | undefined>;
    list(): Promise<readonly CredentialInfo[]>;
    modify(providerId: string, fn: (current: Credential | undefined) => Promise<Credential | undefined>): Promise<Credential | undefined>;
    delete(providerId: string): Promise<void>;
}
//# sourceMappingURL=store.d.ts.map