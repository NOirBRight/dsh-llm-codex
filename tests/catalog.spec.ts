import { describe, expect, it } from 'vitest'
import {
  CODEX_DEFAULT_MODEL_IDS,
  defaultDisplayedCatalog,
  hydrateCatalogModel,
  officialPickerCatalog,
  resolveWireModel,
} from '../src/catalog.ts'
import { decodeCodexSettings, DEFAULT_CODEX_SETTINGS } from '../src/client-contract.ts'

describe('official Codex catalog', () => {
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

  it('maps Fast picker ids onto the official wire model and priority tier', () => {
    expect(resolveWireModel('gpt-5.6-sol-fast')).toEqual({
      wireId: 'gpt-5.6-sol',
      serviceTier: 'priority',
    })
    expect(resolveWireModel('gpt-5.6-sol')).toEqual({ wireId: 'gpt-5.6-sol' })
  })

  it('hydrates official metadata onto user-edited rows', () => {
    expect(hydrateCatalogModel({ id: 'gpt-5.6-luna-fast' })).toMatchObject({
      id: 'gpt-5.6-luna-fast',
      name: 'GPT-5.6 Luna Fast',
      vision: true,
      fast: true,
      contextWindow: 272_000,
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
  })

  it('rejects duplicate catalog ids', () => {
    expect(decodeCodexSettings({
      models: [{ id: 'gpt-5.6-sol' }, { id: 'gpt-5.6-sol' }],
    })).toBeUndefined()
  })
})
