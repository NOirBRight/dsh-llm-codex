/**
 * Official Codex catalog plus first-class Fast and 1M rows.
 * Display ids are picker keys; wire ids are what ChatGPT receives.
 */
/** One model in the plugin's displayed or official catalog. */
export interface CodexCatalogModel {
    /** Picker id; Fast rows use `-fast`, 1M rows use `-1m`. */
    id: string;
    /** Selector label; omission uses {@link id}. */
    name?: string;
    /** Optional selector detail. */
    description?: string;
    /** Combined request and response budget used by DSH compaction. */
    contextWindow?: number;
    /** Per-request output capability for pi-ai; not a request cap. */
    maxTokens?: number;
    /** Whether the model supports native thinking. */
    thinking?: boolean;
    /** Chat-picker default when the conversation has not chosen a level. */
    defaultEffort?: string;
    /** Whether the model accepts image input. */
    vision?: boolean;
    /** Legacy capability flag. Ignored at runtime; still decoded. */
    tools?: boolean;
    /** First-class Fast row; chat sends `service_tier: "priority"`. */
    fast?: boolean;
}
/** Suffix that marks a first-class Fast picker row. */
export declare const CODEX_FAST_SUFFIX = "-fast";
/** Suffix that marks a first-class 1M context picker row. */
export declare const CODEX_LARGE_CONTEXT_SUFFIX = "-1m";
/** Official Fast service tier sent on the wire. */
export declare const CODEX_FAST_SERVICE_TIER: "priority";
/** Documented 1M context budget for official 5.6 large rows. */
export declare const CODEX_LARGE_CONTEXT_WINDOW = 1000000;
/** Parsed picker id after stripping official Fast / 1M suffixes. */
export interface CodexPickerVariant {
    /** Wire model id sent to ChatGPT. */
    wireId: string;
    /** Whether this row sends the Fast service tier. */
    fast: boolean;
    /** Whether this row uses the 1M context budget. */
    largeContext: boolean;
}
/** One official Codex model as shipped by the plugin snapshot. */
export interface CodexOfficialModel {
    id: string;
    name: string;
    vision: boolean;
    thinking: true;
    tools: true;
    contextWindow: number;
    maxContextWindow: number;
    maxTokens: number;
    fast: boolean;
    largeContext: boolean;
    thinkingLevelMap: Readonly<Record<string, string>>;
}
/** Official Codex models, in picker order. 1M rows are opt-in for the 5.6 family. */
export declare const CODEX_OFFICIAL_MODELS: readonly CodexOfficialModel[];
/** Default conversation-picker rows: Sol / Terra / Luna x normal + Fast. */
export declare const CODEX_DEFAULT_MODEL_IDS: readonly string[];
/** Stable order for the Default thinking dropdown. */
export declare const CODEX_EFFORT_ORDER: readonly ["minimal", "low", "medium", "high", "xhigh", "max", "ultra"];
/** Short labels for advertised Codex reasoning levels. */
export declare const CODEX_EFFORT_LABELS: Readonly<Record<string, string>>;
/**
 * Split a picker id into the ChatGPT wire id plus Fast / 1M flags.
 * Unknown ids keep historical `-fast` stripping and ignore `-1m`.
 */
export declare function parseCodexPickerId(id: string): CodexPickerVariant;
/** Official catalog plus Fast and 1M rows where the model advertises them. */
export declare function officialPickerCatalog(): CodexCatalogModel[];
/** Frozen default displayed subset. */
export declare function defaultDisplayedCatalog(): CodexCatalogModel[];
/** Look up the official model that backs a picker id, if any. */
export declare function officialModelFor(id: string): CodexOfficialModel | undefined;
/** Official non-Fast wire ids that accept image input, used as generate_image routers. */
export declare function officialImageGenerationModels(): readonly CodexOfficialModel[];
/** Default reasoning effort for a displayed row. Fast / 1M rows share the base policy. */
export declare function defaultCodexReasoningEffort(id: string): 'high' | 'xhigh' | 'max';
/** Reasoning levels shown when Default thinking is available. */
export declare function effortsForCodexModel(model: CodexCatalogModel): readonly string[];
/** Whether this picker id is a Fast variant of a model that supports it. */
export declare function isFastCatalogId(id: string): boolean;
/** Whether this picker id is a 1M variant of an official large-context model. */
export declare function isLargeContextCatalogId(id: string): boolean;
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