import { describe, expect, it } from 'vitest'
import {
  CODEX_DEFAULT_MODEL_IDS,
  defaultCodexReasoningEffort,
  defaultDisplayedCatalog,
  hydrateCatalogModel,
  officialImageGenerationModels,
  officialPickerCatalog,
  resolveWireModel,
} from '../src/catalog.ts'
import { decodeCodexSettings, DEFAULT_CODEX_SETTINGS } from '../src/client-contract.ts'

describe('official Codex catalog', () => {
  it('lists vision official models for image generation and excludes Spark', () => {
    const ids = officialImageGenerationModels().map(model => model.id)
    expect(ids).toContain('gpt-5.6-luna')
    expect(ids).toContain('gpt-5.5')
    expect(ids).not.toContain('gpt-5.3-codex-spark')
    expect(ids.some(id => id.endsWith('-fast'))).toBe(false)
  })

  it('defaults to Sol / Terra / Luna x normal + Fast', () => {
    expect(defaultDisplayedCatalog().map(model => model.id)).toEqual([...CODEX_DEFAULT_MODEL_IDS])
  })

  it('exposes Fast only for models that advertise a speed tier', () => {
    const ids = officialPickerCatalog().map(model => model.id)
    expect(ids).toContain('gpt-5.6-sol-fast')
    expect(ids).toContain('gpt-5.5-fast')
    expect(ids).toContain('gpt-5.4-fast')
    expect(ids).not.toContain('gpt-5.4-mini-fast')
    expect(ids).not.toContain('gpt-5.3-codex-spark-fast')
  })

  it('exposes 1M rows only for official 5.6 models', () => {
    const ids = officialPickerCatalog().map(model => model.id)
    expect(ids).toContain('gpt-5.6-sol-1m')
    expect(ids).toContain('gpt-5.6-sol-1m-fast')
    expect(ids).toContain('gpt-5.6-terra-1m')
    expect(ids).toContain('gpt-5.6-luna-1m-fast')
    expect(ids).not.toContain('gpt-5.5-1m')
    expect(ids).not.toContain('gpt-5.4-1m')
    expect(ids).not.toContain('gpt-5.3-codex-spark-1m')
    expect(defaultDisplayedCatalog().map(model => model.id)).not.toContain('gpt-5.6-sol-1m')
  })

  it('maps Fast and 1M picker ids onto the official wire model', () => {
    expect(resolveWireModel('gpt-5.6-sol-fast')).toEqual({
      wireId: 'gpt-5.6-sol',
      serviceTier: 'priority',
    })
    expect(resolveWireModel('gpt-5.6-sol-1m')).toEqual({ wireId: 'gpt-5.6-sol' })
    expect(resolveWireModel('gpt-5.6-sol-1m-fast')).toEqual({
      wireId: 'gpt-5.6-sol',
      serviceTier: 'priority',
    })
    expect(resolveWireModel('gpt-5.6-sol')).toEqual({ wireId: 'gpt-5.6-sol' })
  })

  it('sets the requested per-model reasoning defaults for normal and Fast rows', () => {
    expect(defaultCodexReasoningEffort('gpt-5.6-luna')).toBe('max')
    expect(defaultCodexReasoningEffort('gpt-5.6-luna-fast')).toBe('max')
    expect(defaultCodexReasoningEffort('gpt-5.6-terra')).toBe('xhigh')
    expect(defaultCodexReasoningEffort('gpt-5.6-terra-fast')).toBe('xhigh')
    expect(defaultCodexReasoningEffort('gpt-5.6-sol')).toBe('high')
    expect(defaultCodexReasoningEffort('gpt-5.6-sol-fast')).toBe('high')
    expect(defaultCodexReasoningEffort('gpt-5.5')).toBe('xhigh')
    expect(defaultCodexReasoningEffort('gpt-5.4-mini')).toBe('xhigh')
    expect(defaultCodexReasoningEffort('gpt-5.3-codex-spark')).toBe('xhigh')
  })

  it('hydrates official metadata onto user-edited rows', () => {
    expect(hydrateCatalogModel({ id: 'gpt-5.6-luna-fast' })).toMatchObject({
      id: 'gpt-5.6-luna-fast',
      name: 'GPT-5.6 Luna Fast',
      vision: true,
      fast: true,
      contextWindow: 272_000,
    })
    expect(hydrateCatalogModel({ id: 'gpt-5.6-sol-1m' })).toMatchObject({
      id: 'gpt-5.6-sol-1m',
      name: 'GPT-5.6 Sol 1M',
      contextWindow: 1_000_000,
    })
    expect(hydrateCatalogModel({ id: 'gpt-5.6-sol-1m-fast' })).toMatchObject({
      name: 'GPT-5.6 Sol 1M Fast',
      fast: true,
      contextWindow: 1_000_000,
    })
    expect(hydrateCatalogModel({ id: 'gpt-5.3-codex-spark' })).toMatchObject({
      vision: false,
      contextWindow: 128_000,
    })
  })

  it('fills omitted settings with the frozen defaults', () => {
    const decoded = decodeCodexSettings({})
    expect(decoded).toEqual(DEFAULT_CODEX_SETTINGS)
    expect(decoded?.models.map(model => model.id)).toEqual([...CODEX_DEFAULT_MODEL_IDS])
    expect(decoded?.searchModel).toBe('gpt-5.6-luna')
    expect(decoded?.enableSearch).toBe(false)
    expect(decoded?.enableImageTool).toBe(false)
    expect(decoded?.enableImageGeneration).toBe(false)
    expect(decoded?.imageGenerationModel).toBe('gpt-5.6-luna')
  })

  it('rejects duplicate catalog ids', () => {
    expect(decodeCodexSettings({
      models: [{ id: 'gpt-5.6-sol' }, { id: 'gpt-5.6-sol' }],
    })).toBeUndefined()
  })
})
