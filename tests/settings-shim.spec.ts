import { describe, expect, it } from 'vitest'
import type { SettingsScope, SettingsScopeSnapshot } from '../src/client/shim.ts'

describe('SettingsScope shim structural compatibility', () => {
  it('accepts published RC and alpha1 scope objects', () => {
    const snapshot: SettingsScopeSnapshot<string> = {
      status: 'ready', value: 'value', base: undefined, user: undefined,
      revision: 1, writable: true, mode: 'host',
    }
    const rcScope: SettingsScope<string> = {
      getSnapshot: () => snapshot,
      subscribe: () => () => {},
      set: async () => {},
      unset: async () => {},
    }
    const alphaScope = { ...rcScope, mutate: async () => {} }
    const compatible: SettingsScope<string> = alphaScope
    expect(compatible.getSnapshot().value).toBe('value')
    expect(typeof alphaScope.mutate).toBe('function')
  })
})
