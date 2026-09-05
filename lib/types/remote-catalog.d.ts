/** Authenticated Codex model discovery with a DSH-local fallback cache. */
import type { CodexCatalogModel } from './catalog.ts';
import type { CodexCredentialStore } from './store.ts';
export declare const CODEX_MODELS_URL = "https://chatgpt.com/backend-api/codex/models";
export declare const CODEX_MODEL_CACHE_FILENAME = "codex-models.json";
/** Fetch the live catalog, persist it locally, and fall back to the last known/static rows offline. */
export declare function refreshCodexModelCatalog(store: CodexCredentialStore, request?: typeof fetch): Promise<CodexCatalogModel[]>;
//# sourceMappingURL=remote-catalog.d.ts.map