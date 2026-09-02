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
export interface CodexSearchProviderOptions {
    readonly credentials: CodexCredentialStore;
    readonly model: string;
    readonly mode: CodexSearchMode;
    readonly contextSize: CodexSearchContextSize;
    readonly maxOutputTokens: number;
    readonly resolveRequestId: () => string;
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