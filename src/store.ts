/**
 * Owner-only persistent OAuth credential storage.
 * The on-disk document is scoped to pi-ai's openai-codex provider id so
 * login() can persist tokens; the public DSH route remains `codex`.
 */

import { mkdir, readFile, rm, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { Credential, CredentialInfo, CredentialStore, OAuthCredential } from '@earendil-works/pi-ai'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'

/** pi-ai provider id used by ChatGPT OAuth and this store. */
export const OPENAI_CODEX_PROVIDER = 'openai-codex'
/** Basename of the OAuth document inside the Harness home. */
export const CODEX_AUTH_FILENAME = 'codex-oauth.json'
const AUTH_FORMAT_VERSION = 1

interface AuthDocument {
  version: typeof AUTH_FORMAT_VERSION
  credential: OAuthCredential
}

function isENOENT(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'ENOENT'
}

async function assertOwnerOnly(filename: string): Promise<void> {
  let mode: number
  try {
    mode = (await stat(filename)).mode
  } catch (error) {
    if (isENOENT(error)) return
    throw error
  }
  if (process.platform === 'win32') return
  if ((mode & 0o077) !== 0) {
    throw new Error(
      `codex: ${filename} is readable beyond its owner (mode ${(mode & 0o777).toString(8)});`
      + ` run "chmod 600 ${filename}" before starting again`,
    )
  }
}

function parseDocument(text: string, filename: string): AuthDocument {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error(`codex: ${filename} is not valid JSON`)
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`codex: ${filename} must contain an object`)
  }
  const document = value as Record<string, unknown>
  if (document['version'] !== AUTH_FORMAT_VERSION) {
    throw new Error(`codex: ${filename} has unsupported auth format version ${String(document['version'])}`)
  }
  if (Object.keys(document).some(key => key !== 'version' && key !== 'credential')) {
    throw new Error(`codex: ${filename} contains an unknown top-level field`)
  }
  const raw = document['credential']
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`codex: ${filename} credential must be an object`)
  }
  const credential = raw as Record<string, unknown>
  if (Object.keys(credential).some(key => !['type', 'access', 'refresh', 'expires', 'accountId'].includes(key))) {
    throw new Error(`codex: ${filename} credential contains an unknown field`)
  }
  if (credential['type'] !== 'oauth') throw new Error(`codex: ${filename} credential type must be oauth`)
  for (const key of ['access', 'refresh', 'accountId'] as const) {
    if (typeof credential[key] !== 'string' || credential[key].length === 0) {
      throw new Error(`codex: ${filename} credential ${key} must be a non-empty string`)
    }
  }
  if (typeof credential['expires'] !== 'number' || !Number.isFinite(credential['expires']) || credential['expires'] <= 0) {
    throw new Error(`codex: ${filename} credential expires must be a positive finite number`)
  }
  return { version: AUTH_FORMAT_VERSION, credential: credential as unknown as OAuthCredential }
}

function cloneCredential(credential: OAuthCredential): OAuthCredential {
  return structuredClone(credential)
}

/** Resolve the default OAuth document path. */
export function codexAuthPath(dshHome?: string): string {
  return resolve(join(resolveDshHome(dshHome), CODEX_AUTH_FILENAME))
}

/** File-backed pi-ai store scoped to the single OpenAI Codex provider. */
export class CodexCredentialStore implements CredentialStore {
  readonly filename: string

  constructor(filename: string = codexAuthPath()) {
    this.filename = resolve(filename)
  }

  private async readCurrent(): Promise<OAuthCredential | undefined> {
    await assertOwnerOnly(this.filename)
    let text: string
    try {
      text = await readFile(this.filename, 'utf8')
    } catch (error) {
      if (isENOENT(error)) return undefined
      throw error
    }
    return cloneCredential(parseDocument(text, this.filename).credential)
  }

  async read(providerId: string): Promise<Credential | undefined> {
    return providerId === OPENAI_CODEX_PROVIDER ? this.readCurrent() : undefined
  }

  async list(): Promise<readonly CredentialInfo[]> {
    return await this.readCurrent() === undefined
      ? []
      : [{ providerId: OPENAI_CODEX_PROVIDER, type: 'oauth' }]
  }

  async modify(
    providerId: string,
    fn: (current: Credential | undefined) => Promise<Credential | undefined>,
  ): Promise<Credential | undefined> {
    if (providerId !== OPENAI_CODEX_PROVIDER) {
      throw new Error(`codex: credential store does not own provider "${providerId}"`)
    }
    await mkdir(dirname(this.filename), { recursive: true, mode: 0o700 })
    return withFileLock(this.filename, async () => {
      const current = await this.readCurrent()
      const candidate = await fn(current)
      if (candidate === undefined) return current
      const document = parseDocument(JSON.stringify({
        version: AUTH_FORMAT_VERSION,
        credential: candidate,
      }), this.filename)
      await writeFileAtomic(this.filename, `${JSON.stringify(document, null, 2)}\n`, {
        mode: 0o600,
        dirMode: 0o700,
      })
      return cloneCredential(document.credential)
    })
  }

  async delete(providerId: string): Promise<void> {
    if (providerId !== OPENAI_CODEX_PROVIDER) return
    await mkdir(dirname(this.filename), { recursive: true, mode: 0o700 })
    await withFileLock(this.filename, () => rm(this.filename, { force: true }))
  }
}
