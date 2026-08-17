/**
 * Codex standalone web search over the dsh web provider seam.
 */
import type { WebSearchProvider, WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web';
import type { CodexCredentialStore } from './store.ts';
import { DEFAULT_CODEX_SEARCH_CONTEXT_SIZE, DEFAULT_CODEX_SEARCH_MAX_OUTPUT_TOKENS, DEFAULT_CODEX_SEARCH_MODE, DEFAULT_CODEX_SEARCH_MODEL } from './client-contract.ts';
import type { CodexSearchContextSize, CodexSearchMode } from './client-contract.ts';
export { DEFAULT_CODEX_SEARCH_CONTEXT_SIZE, DEFAULT_CODEX_SEARCH_MAX_OUTPUT_TOKENS, DEFAULT_CODEX_SEARCH_MODE, DEFAULT_CODEX_SEARCH_MODEL, };
export type { CodexSearchContextSize, CodexSearchMode };
export declare const CODEX_SEARCH_PROVIDER = "codex";
export declare const CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
export declare const CODEX_SEARCH_URL = "https://chatgpt.com/backend-api/codex/alpha/search";
interface SearchRequestBody {
    readonly id: string;
    readonly model: string;
    readonly input: readonly [
        {
            readonly type: 'message';
            readonly role: 'user';
            readonly content: readonly [{
                readonly type: 'input_text';
                readonly text: string;
            }];
        }
    ];
    readonly commands: {
        readonly search_query: readonly [{
            readonly q: string;
        }];
    };
    readonly settings: {
        readonly search_context_size: CodexSearchContextSize;
        readonly allowed_callers: readonly ['direct'];
        readonly external_web_access: boolean | 'indexed';
    };
    readonly max_output_tokens: number;
}
export interface CodexSearchRequestRecord {
    readonly endpoint: typeof CODEX_SEARCH_URL;
    readonly body: SearchRequestBody;
}
export interface CodexSearchProviderOptions {
    readonly credentials: CodexCredentialStore;
    readonly model: string;
    readonly mode: CodexSearchMode;
    readonly contextSize: CodexSearchContextSize;
    readonly maxOutputTokens: number;
    readonly resolveRequestId: () => string;
    readonly recordRequest?: (request: CodexSearchRequestRecord) => void;
}
export declare function externalWebAccess(mode: CodexSearchMode): boolean | 'indexed';
export declare function mapCodexSearchResponse(value: unknown): WebSearchResult;
export declare class CodexSearchProvider implements WebSearchProvider {
    private readonly options;
    readonly id = "codex";
    private readonly models;
    constructor(options: CodexSearchProviderOptions);
    available(): boolean;
    search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>;
}
//# sourceMappingURL=search.d.ts.map