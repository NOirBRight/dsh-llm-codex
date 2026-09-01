/**
 * Alpha.1 compatibility for Codex Search's durable auxiliary request event.
 * @module dsh-llm-codex/search-alpha1-compat
 */

import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { KNOWN_SESSION_EVENT_TYPES, SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-agent'
import type { CodexSearchRequestRecord } from './search.ts'

/** The Codex auxiliary request event written by this package. */
export const CODEX_SEARCH_MODEL_REQUEST_EVENT = 'web/codex-search-llm-request'

/** The request event written by the retired Codex connector. */
export const CODEX_CONNECT_SEARCH_MODEL_REQUEST_EVENT = 'web/openai-codex-search-llm-request'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'web/codex-search-llm-request': CodexSearchRequestRecord
    'web/openai-codex-search-llm-request': CodexSearchRequestRecord
  }
}

const EVENTS = [CODEX_SEARCH_MODEL_REQUEST_EVENT, CODEX_CONNECT_SEARCH_MODEL_REQUEST_EVENT] as const
const ALPHA1_SESSION_FORMAT_VERSION = 0

export type CodexSearchAlpha1AdapterResult = { ok: true } | { ok: false; reason: string }

/** Inputs for CodexSearchAlpha1Adapter. */
export interface CodexSearchAlpha1AdapterOptions {
  /** Context used for the one Search-degradation diagnostic. */
  readonly context?: Context
  /** Local event vocabulary; defaults to the official session export. */
  readonly localVocabulary?: unknown
  /** Process argument vector; defaults to the current process vector. */
  readonly argv?: readonly string[]
  /** Test or embedding seam for the resolved Host session module. */
  readonly hostSessionModule?: unknown
  /** Loader for a resolved Host session module. */
  readonly loadHostSession?: (href: string) => Promise<unknown>
  /** Diagnostic sink; defaults to the context logger or console. */
  readonly log?: (message: string) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Installs the alpha.1 session vocabulary needed by Codex Search.
 *
 * The adapter is the only module that resolves the Host session copy or mutates
 * a session event vocabulary. Event registration is additive and remains valid
 * for the lifetime of the process.
 */
export class CodexSearchAlpha1Adapter {
  private readonly context: Context | undefined
  private readonly localVocabulary: unknown
  private readonly argv: readonly string[]
  private readonly hostSessionModule: unknown
  private readonly loadHostSession: ((href: string) => Promise<unknown>) | undefined
  private readonly logSink: ((message: string) => void) | undefined
  private readonly logged = new Set<'local' | 'host'>()

  /**
   * @param options - local and Host compatibility inputs.
   */
  constructor(options: CodexSearchAlpha1AdapterOptions = {}) {
    this.context = options.context
    this.localVocabulary = options.localVocabulary === undefined ? KNOWN_SESSION_EVENT_TYPES : options.localVocabulary
    this.argv = options.argv ?? process.argv
    this.hostSessionModule = options.hostSessionModule
    this.loadHostSession = options.loadHostSession
    this.logSink = options.log
  }

  /**
   * Install both the local and Host alpha.1 vocabularies.
   * @returns whether Search may be registered.
   */
  async install(): Promise<CodexSearchAlpha1AdapterResult> {
    const local = this.installVocabulary(this.localVocabulary, 'local', SESSION_FORMAT_VERSION)
    if (!local.ok) return local
    return this.installHostVocabulary()
  }

  /**
   * Install the local alpha.1 vocabulary.
   * @returns whether the local vocabulary is usable.
   */
  installLocal(): CodexSearchAlpha1AdapterResult {
    return this.installVocabulary(this.localVocabulary, 'local', SESSION_FORMAT_VERSION)
  }

  /**
   * Install the Host process's alpha.1 vocabulary.
   * @returns whether the Host vocabulary is usable.
   */
  async installHost(): Promise<CodexSearchAlpha1AdapterResult> {
    return this.installHostVocabulary()
  }

  private async installHostVocabulary(): Promise<CodexSearchAlpha1AdapterResult> {
    if (this.hostSessionModule !== undefined) {
      return this.installHostModule(this.hostSessionModule)
    }
    const href = this.hostSessionHref()
    if (href === undefined) {
      return this.fail('host', 'Host session module is not resolvable (missing process.argv[1])')
    }
    try {
      const host = await (this.loadHostSession?.(href) ?? import(href))
      return this.installHostModule(host)
    } catch (error: unknown) {
      return this.fail('host', 'Host session module resolution failed: ' + errorMessage(error))
    }
  }

  private installHostModule(value: unknown): CodexSearchAlpha1AdapterResult {
    if (!isRecord(value)) return this.fail('host', 'Host session module is not an object')
    return this.installVocabulary(
      value['KNOWN_SESSION_EVENT_TYPES'],
      'host',
      value['SESSION_FORMAT_VERSION'],
    )
  }

  private hostSessionHref(): string | undefined {
    const entry = this.argv[1]
    if (entry === undefined || entry.length === 0) return undefined
    try {
      return pathToFileURL(createRequire(realpathSync(entry)).resolve('@deepseek-ai/dsh-session')).href
    } catch {
      return undefined
    }
  }

  private installVocabulary(value: unknown, scope: 'local' | 'host', version: unknown): CodexSearchAlpha1AdapterResult {
    if (version !== ALPHA1_SESSION_FORMAT_VERSION) {
      return this.fail(scope, scope + ' session format is not the official alpha.1 version')
    }
    if (!(value instanceof Set)) {
      return this.fail(scope, scope + ' session event vocabulary is not a mutable Set')
    }
    if (Object.isFrozen(value) || !Object.isExtensible(value)) {
      return this.fail(scope, scope + ' session event vocabulary is frozen or readonly')
    }
    try {
      for (const type of EVENTS) {
        if (Set.prototype.has.call(value, type)) continue
        value.add(type)
        if (!Set.prototype.has.call(value, type)) throw new Error('Set.add did not persist')
      }
      return { ok: true }
    } catch (error: unknown) {
      return this.fail(scope, scope + ' session event vocabulary could not be updated: ' + errorMessage(error))
    }
  }

  private fail(scope: 'local' | 'host', reason: string): CodexSearchAlpha1AdapterResult {
    if (!this.logged.has(scope)) {
      this.logged.add(scope)
      const message = 'dsh-llm-codex: Search disabled — ' + reason
      if (this.logSink !== undefined) this.logSink(message)
      else if (this.context !== undefined) this.context.logger.warn(message)
      else console.warn(message)
    }
    return { ok: false, reason }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Append the secret-free auxiliary request before dispatch. */
export function recordCodexSearchRequest(ctx: Context, request: CodexSearchRequestRecord): void {
  ctx.get('agents')?.currentInitiator()?.session.append(CODEX_SEARCH_MODEL_REQUEST_EVENT, request)
}
