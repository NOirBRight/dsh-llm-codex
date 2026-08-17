import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { OAuthCredential } from '@earendil-works/pi-ai'
import { CodexCredentialStore, OPENAI_CODEX_PROVIDER } from '../src/store.ts'

let root: string | undefined

afterEach(async () => {
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

function credential(access = 'access-secret'): OAuthCredential {
  return {
    type: 'oauth',
    access,
    refresh: 'refresh-secret',
    expires: Date.now() + 60_000,
    accountId: 'account-1',
  }
}

async function store(): Promise<CodexCredentialStore> {
  root = await mkdtemp(join(tmpdir(), 'dsh-llm-codex-'))
  return new CodexCredentialStore(join(root, 'codex-oauth.json'))
}

describe('CodexCredentialStore', () => {
  it('persists, lists, clones, and removes one OAuth credential owner-only', async () => {
    const auth = await store()
    expect(await auth.read(OPENAI_CODEX_PROVIDER)).toBeUndefined()

    await auth.modify(OPENAI_CODEX_PROVIDER, () => Promise.resolve(credential()))
    expect(await auth.list()).toEqual([{ providerId: OPENAI_CODEX_PROVIDER, type: 'oauth' }])
    const first = await auth.read(OPENAI_CODEX_PROVIDER)
    expect(first).toMatchObject({ type: 'oauth', accountId: 'account-1' })
    if (first?.type !== 'oauth') throw new Error('expected OAuth credential')
    first.access = 'mutated-only-in-caller'
    expect(await auth.read(OPENAI_CODEX_PROVIDER)).toMatchObject({ access: 'access-secret' })
    if (process.platform !== 'win32') expect((await stat(auth.filename)).mode & 0o777).toBe(0o600)

    await auth.delete(OPENAI_CODEX_PROVIDER)
    expect(await auth.list()).toEqual([])
  })

  it('ignores other provider ids', async () => {
    const auth = await store()
    expect(await auth.read('openai')).toBeUndefined()
    await expect(auth.modify('openai', () => Promise.resolve(credential()))).rejects.toThrow(/does not own/)
  })
})
