import { readFile } from 'node:fs/promises'
  import { describe, expect, it } from 'vitest'
import { KNOWN_SESSION_EVENT_TYPES } from '@deepseek-ai/dsh-session'
import {
  CODEX_CONNECT_SEARCH_MODEL_REQUEST_EVENT,
  CODEX_SEARCH_MODEL_REQUEST_EVENT,
  installCodexSearchEvent,
} from '../src/search-event.ts'
import { externalWebAccess, mapCodexSearchResponse } from '../src/search.ts'

describe('installCodexSearchEvent', () => {
  it('registers this plugin event and dsh-codex-connect history events', () => {
    installCodexSearchEvent()
    expect(KNOWN_SESSION_EVENT_TYPES.has(CODEX_SEARCH_MODEL_REQUEST_EVENT)).toBe(true)
    expect(KNOWN_SESSION_EVENT_TYPES.has(CODEX_CONNECT_SEARCH_MODEL_REQUEST_EVENT)).toBe(true)
  })
})

describe('externalWebAccess', () => {
  it('maps official Codex search modes onto the standalone field', () => {
    expect(externalWebAccess('cached')).toBe(false)
    expect(externalWebAccess('indexed')).toBe('indexed')
    expect(externalWebAccess('live')).toBe(true)
  })
})

describe('search isolation', () => {
  it('never writes the global search route or default model', async () => {
    const source = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/agent-default-model/)
    expect(source).not.toMatch(/web\.searchProvider|searchProvider/)
  })
})

describe('mapCodexSearchResponse', () => {
  it('keeps text output and unique http citations', () => {
    expect(mapCodexSearchResponse({
      output: 'Sol is a Codex model.',
      results: [
        { type: 'text_result', url: 'https://example.com/a', title: 'A', snippet: 'one' },
        { type: 'text_result', url: 'https://example.com/a', title: 'dup' },
        { type: 'other', url: 'https://example.com/skip' },
        { type: 'text_result', url: 'javascript:alert(1)' },
      ],
    })).toEqual({
      content: 'Sol is a Codex model.',
      sources: [{ url: 'https://example.com/a', title: 'A', snippet: 'one' }],
      truncated: false,
    })
  })

  it('rejects a payload without string output', () => {
    expect(() => mapCodexSearchResponse({ results: [] })).toThrow(/without string output/)
  })
})
