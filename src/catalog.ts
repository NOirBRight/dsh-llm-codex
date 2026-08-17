/**
 * Official Codex catalog plus first-class Fast rows.
 * Display ids are picker keys; wire ids are what ChatGPT receives.
 */

/** One model in the plugin's displayed or official catalog. */
export interface CodexCatalogModel {
  /** Picker id; Fast rows use a `-fast` suffix. */
  id: string
  /** Selector label; omission uses {@link id}. */
  name?: string
  /** Optional selector detail. */
  description?: string
  /** Known combined request and response context capacity. */
  contextWindow?: number
  /** Per-request output cap for this model. */
  maxTokens?: number
  /** Whether the model supports native thinking. */
  thinking?: boolean
  /** Whether the model accepts image input. */
  vision?: boolean
  /** Whether the model supports tool calls. */
  tools?: boolean
  /** First-class Fast row; chat sends `service_tier: "priority"`. */
  fast?: boolean
}

/** Suffix that marks a first-class Fast picker row. */
export const CODEX_FAST_SUFFIX = '-fast'
/** Official Fast service tier sent on the wire. */
export const CODEX_FAST_SERVICE_TIER = 'priority' as const

/** One official Codex model as shipped by pi-ai. */
export interface CodexOfficialModel {
  id: string
  name: string
  vision: boolean
  thinking: true
  tools: true
  contextWindow: number
  maxTokens: number
  fast: boolean
  thinkingLevelMap: Readonly<Record<string, string>>
}

const LEVELS_56 = Object.freeze({ xhigh: 'xhigh', max: 'max', minimal: 'low' })
const LEVELS_DEFAULT = Object.freeze({ xhigh: 'xhigh', minimal: 'low' })

/** Official pi-ai openai-codex models, in picker order. */
export const CODEX_OFFICIAL_MODELS: readonly CodexOfficialModel[] = Object.freeze([
  Object.freeze({
    id: 'gpt-5.6-sol',
    name: 'GPT-5.6 Sol',
    vision: true,
    thinking: true,
    tools: true,
    contextWindow: 272_000,
    maxTokens: 128_000,
    fast: true,
    thinkingLevelMap: LEVELS_56,
  }),
  Object.freeze({
    id: 'gpt-5.6-terra',
    name: 'GPT-5.6 Terra',
    vision: true,
    thinking: true,
    tools: true,
    contextWindow: 272_000,
    maxTokens: 128_000,
    fast: true,
    thinkingLevelMap: LEVELS_56,
  }),
  Object.freeze({
    id: 'gpt-5.6-luna',
    name: 'GPT-5.6 Luna',
    vision: true,
    thinking: true,
    tools: true,
    contextWindow: 272_000,
    maxTokens: 128_000,
    fast: true,
    thinkingLevelMap: LEVELS_56,
  }),
  Object.freeze({
    id: 'gpt-5.5',
    name: 'GPT-5.5',
    vision: true,
    thinking: true,
    tools: true,
    contextWindow: 272_000,
    maxTokens: 128_000,
    fast: true,
    thinkingLevelMap: LEVELS_DEFAULT,
  }),
  Object.freeze({
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    vision: true,
    thinking: true,
    tools: true,
    contextWindow: 272_000,
    maxTokens: 128_000,
    fast: true,
    thinkingLevelMap: LEVELS_DEFAULT,
  }),
  Object.freeze({
    id: 'gpt-5.4-mini',
    name: 'GPT-5.4 mini',
    vision: true,
    thinking: true,
    tools: true,
    contextWindow: 272_000,
    maxTokens: 128_000,
    fast: false,
    thinkingLevelMap: LEVELS_DEFAULT,
  }),
  Object.freeze({
    id: 'gpt-5.3-codex-spark',
    name: 'GPT-5.3 Codex Spark',
    vision: false,
    thinking: true,
    tools: true,
    contextWindow: 128_000,
    maxTokens: 128_000,
    fast: false,
    thinkingLevelMap: LEVELS_DEFAULT,
  }),
])

/** Default conversation-picker rows: Sol / Terra / Luna x normal + Fast. */
export const CODEX_DEFAULT_MODEL_IDS: readonly string[] = Object.freeze([
  'gpt-5.6-sol',
  'gpt-5.6-sol-fast',
  'gpt-5.6-terra',
  'gpt-5.6-terra-fast',
  'gpt-5.6-luna',
  'gpt-5.6-luna-fast',
])

function rowOf(official: CodexOfficialModel, fast: boolean): CodexCatalogModel {
  return {
    id: fast ? official.id + CODEX_FAST_SUFFIX : official.id,
    name: fast ? official.name + ' Fast' : official.name,
    thinking: official.thinking,
    vision: official.vision,
    tools: official.tools,
    contextWindow: official.contextWindow,
    maxTokens: official.maxTokens,
    ...fast ? { fast: true } : {},
  }
}

/** Official catalog plus Fast rows where the model advertises a speed tier. */
export function officialPickerCatalog(): CodexCatalogModel[] {
  const rows: CodexCatalogModel[] = []
  for (const model of CODEX_OFFICIAL_MODELS) {
    rows.push(rowOf(model, false))
    if (model.fast) rows.push(rowOf(model, true))
  }
  return rows
}

/** Frozen default displayed subset. */
export function defaultDisplayedCatalog(): CodexCatalogModel[] {
  const allowed = new Set(CODEX_DEFAULT_MODEL_IDS)
  return officialPickerCatalog().filter(model => allowed.has(model.id))
}

/** Look up the official model that backs a picker id, if any. */
export function officialModelFor(id: string): CodexOfficialModel | undefined {
  const wireId = id.endsWith(CODEX_FAST_SUFFIX) ? id.slice(0, -CODEX_FAST_SUFFIX.length) : id
  return CODEX_OFFICIAL_MODELS.find(model => model.id === wireId)
}

/** Default reasoning effort for a displayed row. Fast rows share their base model's policy. */
export function defaultCodexReasoningEffort(id: string): 'high' | 'xhigh' | 'max' {
  switch (officialModelFor(id)?.id) {
    case 'gpt-5.6-luna': return 'max'
    case 'gpt-5.6-terra': return 'xhigh'
    case 'gpt-5.6-sol': return 'high'
    default: return 'xhigh'
  }
}

/** Whether this picker id is a Fast variant of a model that supports it. */
export function isFastCatalogId(id: string): boolean {
  if (!id.endsWith(CODEX_FAST_SUFFIX)) return false
  return officialModelFor(id)?.fast === true
}

/** Wire id and optional service tier for one picker row. */
export interface CodexWireTarget {
  wireId: string
  serviceTier?: typeof CODEX_FAST_SERVICE_TIER
}

/** Map a displayed catalog id onto the ChatGPT request. */
export function resolveWireModel(id: string): CodexWireTarget {
  if (id.endsWith(CODEX_FAST_SUFFIX)) {
    return { wireId: id.slice(0, -CODEX_FAST_SUFFIX.length), serviceTier: CODEX_FAST_SERVICE_TIER }
  }
  return { wireId: id }
}

/** Merge a user-edited row with official metadata when the id is known. */
export function hydrateCatalogModel(model: CodexCatalogModel): CodexCatalogModel {
  const official = officialModelFor(model.id)
  const fast = isFastCatalogId(model.id)
  if (official === undefined) {
    return {
      id: model.id,
      ...model.name === undefined ? {} : { name: model.name },
      ...model.description === undefined ? {} : { description: model.description },
      ...model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow },
      ...model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens },
      ...model.thinking === undefined ? {} : { thinking: model.thinking },
      ...model.vision === undefined ? {} : { vision: model.vision },
      ...model.tools === undefined ? {} : { tools: model.tools },
      ...fast ? { fast: true } : {},
    }
  }
  return {
    id: model.id,
    name: model.name ?? (fast ? official.name + ' Fast' : official.name),
    thinking: model.thinking ?? official.thinking,
    vision: model.vision ?? official.vision,
    tools: model.tools ?? official.tools,
    contextWindow: model.contextWindow ?? official.contextWindow,
    maxTokens: model.maxTokens ?? official.maxTokens,
    ...fast ? { fast: true } : {},
    ...model.description === undefined ? {} : { description: model.description },
  }
}
