/** Browser half: Codex setup inside Plugin configuration. */

import type { ClientContext, SettingsScopeSnapshot } from './shim.js'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import {
  CODEX_RPC_CHANNEL,
  CODEX_SETTINGS_READ_ENDPOINT,
  CODEX_AUTH_STATUS_ENDPOINT,
  CODEX_AUTH_BEGIN_ENDPOINT,
  CODEX_AUTH_CANCEL_ENDPOINT,
  CODEX_AUTH_ATTEMPT_STATUS_ENDPOINT,
  CODEX_AUTH_LOGOUT_ENDPOINT,
  CODEX_SAVE_ENDPOINT,
  CODEX_SETTINGS_NAMESPACE,
  decodeCodexAuthLoginReply,
  decodeCodexAuthLogoutReply,
  decodeCodexAuthStatus,
  decodeCodexAuthAttemptStatus,
  decodeCodexSaveResult,
} from '../client-contract.ts'
import type { CodexSettingsView } from '../client-contract.ts'
import { officialPickerCatalog } from '../catalog.ts'
import { CodexPluginCard } from './CodexPluginCard.tsx'
import type { CodexPluginCardFace } from './CodexPluginCard.tsx'
import { CodexModelPicker, CodexModelPickerController } from './CodexModelPicker.tsx'
import type { CodexModelPickerFace } from './CodexModelPicker.tsx'
import { en, zh } from './locales.ts'
import type { CodexSettingsKey } from './locales.ts'


declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'settings.provider.item': { kind: 'keyed'; scope: 'root' }
  }
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Codex Plugin configuration copy. */
    'settings.codex': CodexSettingsKey
  }
}

export const name = 'dsh-llm-codex-client'
export const inject = ['slots', 'locale', 'connection']


export function apply(ctx: ClientContext): void {
  const localeNamespace = 'settings.codex'
  ctx.effect(
    () => ctx.locale.register(localeNamespace, { zh, en }),
    'dsh-llm-codex: Plugin configuration copy',
  )
  const t = ctx.locale.bind(localeNamespace) as CodexPluginCardFace['t']
  const picker = new CodexModelPickerController()
  const { rpc, isLoopback } = ctx.get('connection') as unknown as ConnectionHandle
  let currentSnapshot: SettingsScopeSnapshot<CodexSettingsView> = { status: 'loading', value: undefined, base: undefined, user: undefined, revision: undefined, writable: true, mode: 'host' }
  const listeners = new Set<() => void>()
  const scope = {
    getSnapshot: () => currentSnapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) },
    set: async () => { throw new Error('Use Codex management settings/save') },
    unset: async () => { throw new Error('Use Codex management settings/save') },
  }
  const refreshSettings = async (): Promise<void> => {
    const result = await rpc.call(CODEX_RPC_CHANNEL, CODEX_SETTINGS_READ_ENDPOINT, {})
    if (!result.ok) throw new Error(result.error.message)
    const value = decodeCodexSaveResult(result.value)
    if (value === undefined) throw new Error('invalid settings/read response')
    currentSnapshot = { ...currentSnapshot, status: 'ready', value: value.settings, revision: value.revision }
    listeners.forEach(listener => listener())
  }
  void refreshSettings().catch(() => { currentSnapshot = { ...currentSnapshot, status: 'unavailable' }; listeners.forEach(listener => listener()) })

  const readAuthStatus: CodexPluginCardFace['readAuthStatus'] = async (signal) => {
    const result = await rpc.call(CODEX_RPC_CHANNEL, CODEX_AUTH_STATUS_ENDPOINT, {}, signal)
    if (!result.ok) throw new Error(result.error.message)
    const decoded = decodeCodexAuthStatus(result.value)
    if (decoded === undefined) throw new Error('invalid auth status')
    return decoded
  }

  const startAuth: CodexPluginCardFace['startAuth'] = async () => {
    // Reserve the popup synchronously in the click handler; browsers block late opens.
    const authWindow = window.open('about:blank', '_blank')
    // Retain the WindowProxy for navigation while preventing reverse-tab access.
    if (authWindow !== null) authWindow.opener = null
    const result = await rpc.call(CODEX_RPC_CHANNEL, CODEX_AUTH_BEGIN_ENDPOINT, {
      method: isLoopback ? 'browser' : 'device_code',
    })
    if (!result.ok) throw new Error(result.error.message)
    const decoded = decodeCodexAuthLoginReply(result.value)
    if (decoded === undefined) throw new Error('invalid auth challenge')
    const destination = decoded.url ?? decoded.verificationUri
    if (destination !== undefined && authWindow !== null) {
      authWindow.location.href = destination
    }
    return decoded
  }

  const readAuthAttemptStatus: CodexPluginCardFace['readAuthAttemptStatus'] = async (attemptId) => {
    const result = await rpc.call(CODEX_RPC_CHANNEL, CODEX_AUTH_ATTEMPT_STATUS_ENDPOINT, { attemptId })
    if (!result.ok) throw new Error(result.error.message)
    const decoded = decodeCodexAuthAttemptStatus(result.value)
    if (decoded === undefined) throw new Error('invalid auth attempt status')
    return decoded
  }

  const cancelAuth: CodexPluginCardFace['cancelAuth'] = async (attemptId) => {
    const result = await rpc.call(CODEX_RPC_CHANNEL, CODEX_AUTH_CANCEL_ENDPOINT, { attemptId })
    if (!result.ok) throw new Error(result.error.message)
  }

  const logout: CodexPluginCardFace['logout'] = async () => {
    const result = await rpc.call(CODEX_RPC_CHANNEL, CODEX_AUTH_LOGOUT_ENDPOINT, {})
    if (!result.ok || decodeCodexAuthLogoutReply(result.value) === undefined) throw new Error(result.ok ? 'invalid logout response' : result.error.message)
  }

  const fetchModels: CodexPluginCardFace['fetchModels'] = async () => officialPickerCatalog()

  const saveConfiguration: CodexPluginCardFace['saveConfiguration'] = async (settings) => {
    const snapshot = scope.getSnapshot()
    if (snapshot.revision === undefined) throw new Error(t('requestFailed'))
    const saved = await rpc.call(CODEX_RPC_CHANNEL, CODEX_SAVE_ENDPOINT, {
      models: settings.models,
      enableSearch: settings.enableSearch,
      enableImageTool: settings.enableImageTool,
      enableImageGeneration: settings.enableImageGeneration,
      searchModel: settings.searchModel,
      imageGenerationModel: settings.imageGenerationModel,
      searchMode: settings.searchMode,
      searchContextSize: settings.searchContextSize,
      searchMaxOutputTokens: settings.searchMaxOutputTokens,
      expectedRevision: snapshot.revision,
    })
    if (!saved.ok) throw new Error(saved.error.message)
    const accepted = decodeCodexSaveResult(saved.value)
    if (accepted === undefined) throw new Error(t('requestFailed'))
    currentSnapshot = { ...currentSnapshot, status: 'ready', value: accepted.settings, revision: accepted.revision }
    listeners.forEach(listener => listener())
    return accepted
  }

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'codex-model-picker',
    order: 100,
    inject: (): CodexModelPickerFace => ({
      t,
      hooks: { codexModelPicker: picker },
      closePicker: picker.close,
      togglePickerModel: picker.toggle,
      adoptPickerModels: picker.adopt,
    }),
  }, CodexModelPicker))
  ctx.slots.inject('settings.provider.item', () => ctx.slots.register({
    name: 'settings.provider.item',
    key: CODEX_SETTINGS_NAMESPACE,
    locale: localeNamespace,
    inject: (): CodexPluginCardFace => ({
      t,
      hooks: { codexSettings: scope },
      startAuth,
      readAuthStatus,
      cancelAuth,
      readAuthAttemptStatus,
      logout,
      fetchModels,
      saveConfiguration,
      beginModelPicker: (initiallyPicked, onAdopt) => { picker.begin(onAdopt, initiallyPicked) },
      completeModelPicker: candidates => { picker.complete(candidates) },
      failModelPicker: message => { picker.fail(message) },
      closeModelPicker: picker.close,
    }),
  }, CodexPluginCard))

}
