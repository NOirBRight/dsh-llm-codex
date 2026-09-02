import { describe, expect, it } from 'vitest'
import type { SettingsScope, SettingsScopeSnapshot } from '../src/client/settings-scope.ts'

describe('SettingsScope structural contract', () => {
  it('accepts the Alpha.4 host settings scope', () => {
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
