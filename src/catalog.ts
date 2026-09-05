/**
 * Official Codex catalog plus first-class Fast and 1M rows.
 * Display ids are picker keys; wire ids are what ChatGPT receives.
 */

/** One model in the plugin's displayed or official catalog. */
export interface CodexCatalogModel {
  /** Picker id; Fast rows use `-fast`, 1M rows use `-1m`. */
  id: string
  /** Selector label; omission uses {@link id}. */
  name?: string
  /** Optional selector detail. */
  description?: string
  /** Combined request and response budget used by DSH compaction. */
  contextWindow?: number
  /** Per-request output capability for pi-ai; not a request cap. */
  maxTokens?: number
  /** Whether the model supports native thinking. */
  thinking?: boolean
  /** Chat-picker default when the conversation has not chosen a level. */
  defaultEffort?: CodexReasoningEffort
  /** Reasoning efforts advertised by the remote Codex catalog. */
  efforts?: CodexReasoningEffort[]
  /** Whether the model accepts image input. */
  vision?: boolean
  /** Legacy capability flag. Ignored at runtime; still decoded. */
  tools?: boolean
  /** First-class Fast row; chat sends `service_tier: "priority"`. */
  fast?: boolean
}

/** Suffix that marks a first-class Fast picker row. */
export const CODEX_FAST_SUFFIX = '-fast'
/** Suffix that marks a first-class 1M context picker row. */
export const CODEX_LARGE_CONTEXT_SUFFIX = '-1m'
/** Official Fast service tier sent on the wire. */
export const CODEX_FAST_SERVICE_TIER = 'priority' as const
/** Documented 1M context budget for official 5.6 large rows. */
export const CODEX_LARGE_CONTEXT_WINDOW = 1_000_000

/** Parsed picker id after stripping official Fast / context suffixes. */
export interface CodexPickerVariant {
  /** Wire model id sent to ChatGPT. */
  wireId: string
  /** Whether this row sends the Fast service tier. */
  fast: boolean
  /** Whether this row uses the 1M context budget. */
  largeContext: boolean
  /** Compaction budget implied by `-<n>k` / `-<n>m`, when present. */
  contextTokens?: number
}

/** Peel a trailing `-<n>k` / `-<n>m` context tier. Product names like `-max` stay. */
export function peelContextSuffix(id: string): { base: string, tokens?: number } {
  const match = /-(\d+)(k|m)$/iu.exec(id)
  if (match === null || match.index === 0) return { base: id }
  const n = Number(match[1])
  const unit = match[2]!.toLowerCase()
  return {
    base: id.slice(0, match.index),
    tokens: unit === 'm' ? n * 1_000_000 : n * 1_000,
  }
}

/** One official Codex model as shipped by the plugin snapshot. */
export interface CodexOfficialModel {
  id: string
  name: string
  vision: boolean
  thinking: true
  tools: true
  contextWindow: number
  maxContextWindow: number
  maxTokens: number
  fast: boolean
  largeContext: boolean
  thinkingLevelMap: Readonly<Record<string, string>>
}

const LEVELS_56 = Object.freeze({
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh',
  max: 'max',
  minimal: 'low',
})
const LEVELS_DEFAULT = Object.freeze({ xhigh: 'xhigh', high: 'high', minimal: 'low' })

/** Official Codex models, in picker order. 1M rows are opt-in for the 5.6 family. */
export const CODEX_OFFICIAL_MODELS: readonly CodexOfficialModel[] = Object.freeze([
  Object.freeze({
    id: 'gpt-5.6-sol',
    name: 'GPT-5.6 Sol',
    vision: true,
    thinking: true,
    tools: true,
    contextWindow: 272_000,
    maxContextWindow: CODEX_LARGE_CONTEXT_WINDOW,
    maxTokens: 128_000,
    fast: true,
    largeContext: true,
    thinkingLevelMap: LEVELS_56,
  }),
  Object.freeze({
    id: 'gpt-5.6-terra',
    name: 'GPT-5.6 Terra',
    vision: true,
    thinking: true,
    tools: true,
    contextWindow: 272_000,
    maxContextWindow: CODEX_LARGE_CONTEXT_WINDOW,
    maxTokens: 128_000,
    fast: true,
    largeContext: true,
    thinkingLevelMap: LEVELS_56,
  }),
  Object.freeze({
    id: 'gpt-5.6-luna',
    name: 'GPT-5.6 Luna',
    vision: true,
    thinking: true,
    tools: true,
    contextWindow: 272_000,
    maxContextWindow: CODEX_LARGE_CONTEXT_WINDOW,
    maxTokens: 128_000,
    fast: true,
    largeContext: true,
    thinkingLevelMap: LEVELS_56,
  }),
  Object.freeze({
    id: 'gpt-5.5',
    name: 'GPT-5.5',
    vision: true,
    thinking: true,
    tools: true,
    contextWindow: 272_000,
    maxContextWindow: 272_000,
    maxTokens: 128_000,
    fast: true,
    largeContext: false,
    thinkingLevelMap: LEVELS_DEFAULT,
  }),
  Object.freeze({
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    vision: true,
    thinking: true,
    tools: true,
    contextWindow: 272_000,
    maxContextWindow: CODEX_LARGE_CONTEXT_WINDOW,
    maxTokens: 128_000,
    fast: true,
    largeContext: false,
    thinkingLevelMap: LEVELS_DEFAULT,
  }),
  Object.freeze({
    id: 'gpt-5.4-mini',
    name: 'GPT-5.4 mini',
    vision: true,
    thinking: true,
    tools: true,
    contextWindow: 272_000,
    maxContextWindow: 272_000,
    maxTokens: 128_000,
    fast: false,
    largeContext: false,
    thinkingLevelMap: LEVELS_DEFAULT,
  }),
  Object.freeze({
    id: 'gpt-5.3-codex-spark',
    name: 'GPT-5.3 Codex Spark',
    vision: false,
    thinking: true,
    tools: true,
    contextWindow: 128_000,
    maxContextWindow: 128_000,
    maxTokens: 128_000,
    fast: false,
    largeContext: false,
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

/** Every reasoning level Codex can expose through this plugin, in UI order. */
export const CODEX_REASONING_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const
export type CodexReasoningEffort = typeof CODEX_REASONING_EFFORTS[number]

/** Whether an untrusted value names a supported Codex reasoning level. */
export function isCodexReasoningEffort(value: string): value is CodexReasoningEffort {
  return (CODEX_REASONING_EFFORTS as readonly string[]).includes(value)
}

/** Stable order for the Default thinking dropdown. */
export const CODEX_EFFORT_ORDER = CODEX_REASONING_EFFORTS

/** Short labels for advertised Codex reasoning levels. */
export const CODEX_EFFORT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
})

function officialByWireId(id: string): CodexOfficialModel | undefined {
  return CODEX_OFFICIAL_MODELS.find(model => model.id === id)
}

/**
 * Split a picker id into the ChatGPT wire id plus Fast / context flags.
 * Generic `-<n>k` / `-<n>m` rows (including `-1m`) peel to the wire id and
 * carry a compaction budget. Product names such as `-max` are not peeled.
 */
export function parseCodexPickerId(id: string): CodexPickerVariant {
  let rest = id
  let fast = false
  if (rest.endsWith(CODEX_FAST_SUFFIX) && rest.length > CODEX_FAST_SUFFIX.length) {
    rest = rest.slice(0, -CODEX_FAST_SUFFIX.length)
    fast = true
  }
  const tier = peelContextSuffix(rest)
  rest = tier.base
  const official = officialByWireId(rest)
  const largeContext = tier.tokens === CODEX_LARGE_CONTEXT_WINDOW
  return {
    wireId: official?.id ?? rest,
    fast,
    largeContext,
    ...tier.tokens === undefined ? {} : { contextTokens: tier.tokens },
  }
}

function variantName(official: CodexOfficialModel, variant: { fast: boolean, largeContext: boolean }): string {
  return [official.name, ...variant.largeContext ? ['1M'] : [], ...variant.fast ? ['Fast'] : []].join(' ')
}

function variantId(official: CodexOfficialModel, variant: { fast: boolean, largeContext: boolean }): string {
  return official.id
    + (variant.largeContext ? CODEX_LARGE_CONTEXT_SUFFIX : '')
    + (variant.fast ? CODEX_FAST_SUFFIX : '')
}

function rowOf(official: CodexOfficialModel, variant: { fast: boolean, largeContext: boolean }): CodexCatalogModel {
  return {
    id: variantId(official, variant),
    name: variantName(official, variant),
    thinking: official.thinking,
    vision: official.vision,
    tools: official.tools,
    contextWindow: variant.largeContext ? CODEX_LARGE_CONTEXT_WINDOW : official.contextWindow,
    maxTokens: official.maxTokens,
    ...variant.fast ? { fast: true } : {},
  }
}

/** Official catalog plus Fast and 1M rows where the model advertises them. */
export function officialPickerCatalog(): CodexCatalogModel[] {
  const rows: CodexCatalogModel[] = []
  for (const model of CODEX_OFFICIAL_MODELS) {
    rows.push(rowOf(model, { fast: false, largeContext: false }))
    if (model.fast) rows.push(rowOf(model, { fast: true, largeContext: false }))
    if (model.largeContext) {
      rows.push(rowOf(model, { fast: false, largeContext: true }))
      if (model.fast) rows.push(rowOf(model, { fast: true, largeContext: true }))
    }
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
  return officialByWireId(parseCodexPickerId(id).wireId)
}

/** Official non-Fast wire ids that accept image input, used as generate_image routers. */
export function officialImageGenerationModels(): readonly CodexOfficialModel[] {
  return CODEX_OFFICIAL_MODELS.filter(model => model.vision)
}

/** Default reasoning effort for a displayed row. Fast / 1M rows share the base policy. */
export function defaultCodexReasoningEffort(id: string): CodexReasoningEffort {
  switch (officialModelFor(id)?.id) {
    case 'gpt-5.6-luna': return 'max'
    case 'gpt-5.6-terra': return 'xhigh'
    case 'gpt-5.6-sol': return 'high'
    default: return 'xhigh'
  }
}

/** Reasoning levels shown when Default thinking is available. */
export function effortsForCodexModel(model: CodexCatalogModel): readonly CodexReasoningEffort[] {
  if (model.thinking === false) return []
  const official = officialModelFor(model.id)
  if (official !== undefined) {
    const keys = new Set(Object.keys(official.thinkingLevelMap))
    keys.add(defaultCodexReasoningEffort(model.id))
    if (model.defaultEffort !== undefined) keys.add(model.defaultEffort)
    return CODEX_EFFORT_ORDER.filter(effort => keys.has(effort))
  }
  if (model.thinking === true) {
    const advertised = model.efforts === undefined ? undefined : new Set(model.efforts)
    return CODEX_EFFORT_ORDER.filter(effort => advertised?.has(effort) ?? effort !== 'minimal')
  }
  return []
}

/** Whether this picker id is a Fast variant of a model that supports it. */
export function isFastCatalogId(id: string): boolean {
  const parsed = parseCodexPickerId(id)
  if (!parsed.fast) return false
  const official = officialByWireId(parsed.wireId)
  return official === undefined || official.fast === true
}

/** Whether this picker id is a 1M variant of an official large-context model. */
export function isLargeContextCatalogId(id: string): boolean {
  const parsed = parseCodexPickerId(id)
  return parsed.largeContext && officialByWireId(parsed.wireId)?.largeContext === true
}

/** Wire id and optional service tier for one picker row. */
export interface CodexWireTarget {
  wireId: string
  serviceTier?: typeof CODEX_FAST_SERVICE_TIER
}

/** Map a displayed catalog id onto the ChatGPT request. */
export function resolveWireModel(id: string): CodexWireTarget {
  const parsed = parseCodexPickerId(id)
  return {
    wireId: parsed.wireId,
    ...parsed.fast ? { serviceTier: CODEX_FAST_SERVICE_TIER } : {},
  }
}

/** Merge a user-edited row with official metadata when the id is known. */
export function hydrateCatalogModel(model: CodexCatalogModel): CodexCatalogModel {
  const parsed = parseCodexPickerId(model.id)
  const official = officialByWireId(parsed.wireId)
  const fast = parsed.fast && (official === undefined || official.fast === true)
  const largeContext = parsed.largeContext && official?.largeContext === true
  const impliedWindow = parsed.contextTokens
    ?? (largeContext ? CODEX_LARGE_CONTEXT_WINDOW : undefined)
  const contextWindow = model.contextWindow ?? impliedWindow
  if (official === undefined) {
    return {
      id: model.id,
      ...model.name === undefined ? {} : { name: model.name },
      ...model.description === undefined ? {} : { description: model.description },
      ...contextWindow === undefined ? {} : { contextWindow },
      ...model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens },
      ...model.thinking === undefined ? {} : { thinking: model.thinking },
      ...model.defaultEffort === undefined ? {} : { defaultEffort: model.defaultEffort },
      ...model.efforts === undefined ? {} : { efforts: model.efforts },
      ...model.vision === undefined ? {} : { vision: model.vision },
      ...model.tools === undefined ? {} : { tools: model.tools },
      ...fast ? { fast: true } : {},
    }
  }
  return {
    id: model.id,
    name: model.name ?? variantName(official, { fast, largeContext }),
    thinking: model.thinking ?? official.thinking,
    vision: model.vision ?? official.vision,
    tools: model.tools ?? official.tools,
    contextWindow: model.contextWindow ?? impliedWindow ?? official.contextWindow,
    maxTokens: model.maxTokens ?? official.maxTokens,
    ...fast ? { fast: true } : {},
    ...model.defaultEffort === undefined ? {} : { defaultEffort: model.defaultEffort },
    ...model.efforts === undefined ? {} : { efforts: model.efforts },
    ...model.description === undefined ? {} : { description: model.description },
  }
}
