/**
 * Official Codex catalog plus first-class Fast rows.
 * Display ids are picker keys; wire ids are what ChatGPT receives.
 */
/** One model in the plugin's displayed or official catalog. */
export interface CodexCatalogModel {
    /** Picker id; Fast rows use a `-fast` suffix. */
    id: string;
    /** Selector label; omission uses {@link id}. */
    name?: string;
    /** Optional selector detail. */
    description?: string;
    /** Known combined request and response context capacity. */
    contextWindow?: number;
    /** Per-request output cap for this model. */
    maxTokens?: number;
    /** Whether the model supports native thinking. */
    thinking?: boolean;
    /** Whether the model accepts image input. */
    vision?: boolean;
    /** Whether the model supports tool calls. */
    tools?: boolean;
    /** First-class Fast row; chat sends `service_tier: "priority"`. */
    fast?: boolean;
}
/** Suffix that marks a first-class Fast picker row. */
export declare const CODEX_FAST_SUFFIX = "-fast";
/** Official Fast service tier sent on the wire. */
export declare const CODEX_FAST_SERVICE_TIER: "priority";
/** One official Codex model as shipped by pi-ai. */
export interface CodexOfficialModel {
    id: string;
    name: string;
    vision: boolean;
    thinking: true;
    tools: true;
    contextWindow: number;
    maxTokens: number;
    fast: boolean;
    thinkingLevelMap: Readonly<Record<string, string>>;
}
/** Official pi-ai openai-codex models, in picker order. */
export declare const CODEX_OFFICIAL_MODELS: readonly CodexOfficialModel[];
/** Default conversation-picker rows: Sol / Terra / Luna x normal + Fast. */
export declare const CODEX_DEFAULT_MODEL_IDS: readonly string[];
/** Official catalog plus Fast rows where the model advertises a speed tier. */
export declare function officialPickerCatalog(): CodexCatalogModel[];
/** Frozen default displayed subset. */
export declare function defaultDisplayedCatalog(): CodexCatalogModel[];
/** Look up the official model that backs a picker id, if any. */
export declare function officialModelFor(id: string): CodexOfficialModel | undefined;
/** Whether this picker id is a Fast variant of a model that supports it. */
export declare function isFastCatalogId(id: string): boolean;
/** Wire id and optional service tier for one picker row. */
export interface CodexWireTarget {
    wireId: string;
    serviceTier?: typeof CODEX_FAST_SERVICE_TIER;
}
/** Map a displayed catalog id onto the ChatGPT request. */
export declare function resolveWireModel(id: string): CodexWireTarget;
/** Merge a user-edited row with official metadata when the id is known. */
export declare function hydrateCatalogModel(model: CodexCatalogModel): CodexCatalogModel;
//# sourceMappingURL=catalog.d.ts.map