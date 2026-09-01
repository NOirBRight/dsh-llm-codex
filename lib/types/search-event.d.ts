/**
 * Alpha.1 compatibility for Codex Search's durable auxiliary request event.
 * @module dsh-llm-codex/search-alpha1-compat
 */
import type { Context } from '@deepseek-ai/cordis';
import type { CodexSearchRequestRecord } from './search.ts';
/** The Codex auxiliary request event written by this package. */
export declare const CODEX_SEARCH_MODEL_REQUEST_EVENT = "web/codex-search-llm-request";
/** The request event written by the retired Codex connector. */
export declare const CODEX_CONNECT_SEARCH_MODEL_REQUEST_EVENT = "web/openai-codex-search-llm-request";
declare module '@deepseek-ai/dsh-session/types' {
    interface SessionEventMap {
        'web/codex-search-llm-request': CodexSearchRequestRecord;
        'web/openai-codex-search-llm-request': CodexSearchRequestRecord;
    }
}
export type CodexSearchAlpha1AdapterResult = {
    ok: true;
} | {
    ok: false;
    reason: string;
};
/** Inputs for CodexSearchAlpha1Adapter. */
export interface CodexSearchAlpha1AdapterOptions {
    /** Context used for the one Search-degradation diagnostic. */
    readonly context?: Context;
    /** Local event vocabulary; defaults to the official session export. */
    readonly localVocabulary?: unknown;
    /** Process argument vector; defaults to the current process vector. */
    readonly argv?: readonly string[];
    /** Test or embedding seam for the resolved Host session module. */
    readonly hostSessionModule?: unknown;
    /** Loader for a resolved Host session module. */
    readonly loadHostSession?: (href: string) => Promise<unknown>;
    /** Diagnostic sink; defaults to the context logger or console. */
    readonly log?: (message: string) => void;
}
/**
 * Installs the alpha.1 session vocabulary needed by Codex Search.
 *
 * The adapter is the only module that resolves the Host session copy or mutates
 * a session event vocabulary. Event registration is additive and remains valid
 * for the lifetime of the process.
 */
export declare class CodexSearchAlpha1Adapter {
    private readonly context;
    private readonly localVocabulary;
    private readonly argv;
    private readonly hostSessionModule;
    private readonly loadHostSession;
    private readonly logSink;
    private readonly logged;
    /**
     * @param options - local and Host compatibility inputs.
     */
    constructor(options?: CodexSearchAlpha1AdapterOptions);
    /**
     * Install both the local and Host alpha.1 vocabularies.
     * @returns whether Search may be registered.
     */
    install(): Promise<CodexSearchAlpha1AdapterResult>;
    /**
     * Install the local alpha.1 vocabulary.
     * @returns whether the local vocabulary is usable.
     */
    installLocal(): CodexSearchAlpha1AdapterResult;
    /**
     * Install the Host process's alpha.1 vocabulary.
     * @returns whether the Host vocabulary is usable.
     */
    installHost(): Promise<CodexSearchAlpha1AdapterResult>;
    private installHostVocabulary;
    private installHostModule;
    private hostSessionHref;
    private installVocabulary;
    private fail;
}
/** Append the secret-free auxiliary request before dispatch. */
export declare function recordCodexSearchRequest(ctx: Context, request: CodexSearchRequestRecord): void;
//# sourceMappingURL=search-event.d.ts.map