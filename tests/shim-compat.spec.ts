import { describe, expect, it } from 'vitest'
import type { SettingsScope, SettingsScopeSnapshot } from '../src/client/shim.ts'

describe('SettingsScope shim structural compatibility', () => {
  it('exposes a snapshot shape compatible with rc and alpha hosts', () => {
    const snap: SettingsScopeSnapshot<string> = {
      status: 'ready',
      value: 'hello',
      base: { hello: true },
      user: { hello: true },
      revision: 42,
      writable: true,
      mode: 'host',
    }
    expect(snap.status).toBe('ready')
    expect(snap.value).toBe('hello')
    expect(snap.revision).toBe(42)
    // loading and unavailable variants also satisfy the union
    const loading: SettingsScopeSnapshot<string> = {
      status: 'loading',
      value: undefined,
      base: undefined,
      user: undefined,
      revision: undefined,
      writable: true,
      mode: 'host',
    }
    expect(loading.status).toBe('loading')
    const unavailable: SettingsScopeSnapshot<string> = {
      status: 'unavailable',
      value: undefined,
      base: undefined,
      user: undefined,
      revision: undefined,
      writable: false,
      mode: 'memory',
    }
    expect(unavailable.writable).toBe(false)
    expect(unavailable.mode).toBe('memory')
  })

  it('exposes a scope contract matching the official Host surface', async () => {
    let notify: (() => void) | undefined
    const scope: SettingsScope<number> = {
      getSnapshot: () => ({
        status: 'ready',
        value: 1,
        base: 0,
        user: 1,
        revision: 1,
        writable: true,
        mode: 'host',
      }),
      subscribe: (listener: () => void) => {
        notify = listener
        return () => { notify = undefined }
      },
      set: async (field: string, value: unknown) => {
        expect(typeof field).toBe('string')
        expect(value).toBeDefined()
      },
      unset: async (field: string) => {
        expect(typeof field).toBe('string')
      },
    }
    const snap = scope.getSnapshot()
    expect(snap.value).toBe(1)
    let called = false
    const dispose = scope.subscribe(() => { called = true })
    notify?.()
    expect(called).toBe(true)
    dispose()
    await scope.set('field', 123)
    await scope.unset('field')
  })

  it('client scope object from shim is assignable to SettingsScope', async () => {
    // Mirrors src/client/index.ts local scope shape
    type View = { models: string[] }
    let current: SettingsScopeSnapshot<View> = {
      status: 'loading',
      value: undefined,
      base: undefined,
      user: undefined,
      revision: undefined,
      writable: true,
      mode: 'host',
    }
    const listeners = new Set<() => void>()
    const scope: SettingsScope<View> = {
      getSnapshot: () => current,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      set: async () => { throw new Error('Use management settings/save') },
      unset: async () => { throw new Error('Use management settings/save') },
    }
    expect(scope.getSnapshot().status).toBe('loading')
    current = { ...current, status: 'ready', value: { models: ['a'] }, revision: 1 }
    listeners.forEach(l => l())
    expect(scope.getSnapshot().value?.models).toEqual(['a'])
  })
})
