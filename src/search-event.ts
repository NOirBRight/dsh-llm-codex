/** Durable request event owned by the Codex search provider. */

import { createRequire } from 'node:module'
import { realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { KNOWN_SESSION_EVENT_TYPES } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-agent'
import type { CodexSearchRequestRecord } from './search.ts'

export const CODEX_SEARCH_MODEL_REQUEST_EVENT = 'web/codex-search-llm-request'

/** Event type written by `dsh-codex-connect`; registered so those logs still load. */
export const CODEX_CONNECT_SEARCH_MODEL_REQUEST_EVENT = 'web/openai-codex-search-llm-request'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'web/codex-search-llm-request': CodexSearchRequestRecord
    'web/openai-codex-search-llm-request': CodexSearchRequestRecord
  }
}

function addKnownEvents(types: Set<string>): void {
  types.add(CODEX_SEARCH_MODEL_REQUEST_EVENT)
  types.add(CODEX_CONNECT_SEARCH_MODEL_REQUEST_EVENT)
}

function hostSessionHref(): string | undefined {
  const entry = process.argv[1]
  if (entry === undefined) return undefined
  try {
    return pathToFileURL(createRequire(realpathSync(entry)).resolve('@deepseek-ai/dsh-session')).href
  } catch {
    return undefined
  }
}

export function installCodexSearchEvent(): void {
  if (!(KNOWN_SESSION_EVENT_TYPES instanceof Set)) {
    throw new Error('dsh-llm-codex: this Harness build does not expose an extensible session event vocabulary')
  }
  addKnownEvents(KNOWN_SESSION_EVENT_TYPES)
}

/** Register on the running `dsh` process copy, which a nested plugin install does not share. */
export async function installHostCodexSearchEvents(): Promise<void> {
  const href = hostSessionHref()
  if (href === undefined) return
  const host = await import(href) as { KNOWN_SESSION_EVENT_TYPES?: unknown }
  if (!(host.KNOWN_SESSION_EVENT_TYPES instanceof Set)) return
  addKnownEvents(host.KNOWN_SESSION_EVENT_TYPES)
}

export function recordCodexSearchRequest(ctx: Context, request: CodexSearchRequestRecord): void {
  ctx.get('agents')?.currentInitiator()?.session.append(CODEX_SEARCH_MODEL_REQUEST_EVENT, request)
}
