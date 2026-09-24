import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { shouldMountDshRuntime } from '../src/compatibility.ts'

const VERIFIED = new Set(['0.1.7-alpha.2', '0.1.7-rc.1'])

function logger(warnings: string[]) {
  return { warn(message: string): void { warnings.push(message) } }
}

describe('DSH forward compatibility policy', () => {
  it('warns once and still attempts an unverified future runtime', () => {
    const warnings: string[] = []
    let mountAttempts = 0
    const allowed = shouldMountDshRuntime(logger(warnings), 'test-plugin', '9.9.9', VERIFIED)
    if (allowed) mountAttempts += 1
    expect(mountAttempts).toBe(1)
    expect(warnings).toEqual(['[test-plugin] best-effort on unverified runtime 9.9.9'])
  })

  it('blocks only an explicitly reproduced version and leaves a visible reason', () => {
    const warnings: string[] = []
    let mountAttempts = 0
    const allowed = shouldMountDshRuntime(logger(warnings), 'test-plugin', '9.9.9', VERIFIED, {
      '9.9.9': 'reproduced startup failure in the test harness',
    })
    if (allowed) mountAttempts += 1
    expect(mountAttempts).toBe(0)
    expect(warnings).toEqual([
      '[test-plugin] blocked on DSH 9.9.9: reproduced startup failure in the test harness; see package.json#dsh.compatibility.blocklist',
    ])
  })

  it('does not warn for verified runtimes', () => {
    const warnings: string[] = []
    for (const version of VERIFIED) expect(shouldMountDshRuntime(logger(warnings), 'test-plugin', version, VERIFIED)).toBe(true)
    expect(warnings).toEqual([])
  })

  it('declares verified DSH releases and accepts the new host range', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      peerDependencies?: Record<string, string>
      dsh?: { compatibility?: { dshReleases?: Record<string, string> } }
    }
    const peers = Object.entries(manifest.peerDependencies ?? {}).filter(([name]) => name.startsWith('@deepseek-ai/dsh-'))
    expect(peers.length).toBeGreaterThan(0)
    for (const [name, range] of peers) expect(range, name).toBe('>=0.1.7-alpha.2')
    expect(manifest.dsh?.compatibility?.dshReleases).toEqual({ '0.1.7-alpha.2': 'compatible', '0.1.7-rc.1': 'compatible' })
  })
})
