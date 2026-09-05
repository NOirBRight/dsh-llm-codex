import { describe, expect, it } from 'vitest'
import { shouldMountDshRuntime } from '../src/compatibility.ts'

const VERIFIED = new Set(['0.1.2-alpha.4', '0.1.2-rc.1'])

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

  it('does not warn for a verified runtime', () => {
    const warnings: string[] = []
    expect(shouldMountDshRuntime(logger(warnings), 'test-plugin', '0.1.2-rc.1', VERIFIED)).toBe(true)
    expect(warnings).toEqual([])
  })
})
