/** Durable request event owned by the Codex search provider. */
import type { Context } from '@deepseek-ai/cordis';
import type { CodexSearchRequestRecord } from './search.ts';
export declare const CODEX_SEARCH_MODEL_REQUEST_EVENT = "web/codex-search-llm-request";
/** Event type written by `dsh-codex-connect`; registered so those logs still load. */
export declare const CODEX_CONNECT_SEARCH_MODEL_REQUEST_EVENT = "web/openai-codex-search-llm-request";
declare module '@deepseek-ai/dsh-session/types' {
    interface SessionEventMap {
        'web/codex-search-llm-request': CodexSearchRequestRecord;
        'web/openai-codex-search-llm-request': CodexSearchRequestRecord;
    }
}
export declare function installCodexSearchEvent(): void;
/** Register on the running `dsh` process copy, which a nested plugin install does not share. */
export declare function installHostCodexSearchEvents(): Promise<void>;
export declare function recordCodexSearchRequest(ctx: Context, request: CodexSearchRequestRecord): void;
//# sourceMappingURL=search-event.d.ts.map