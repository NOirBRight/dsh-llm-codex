/** Browser half: Codex setup inside Plugin configuration. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from 'dsh-llm-providers-ui/client'
import { createCodexUsageReader, dropPersistedUsageKeys } from 'dsh-llm-providers-ui/usage-readers'

/**
 * Register this card, its shared header ownership, quota reader, display name,
 * and active model count so the shared settings page needs no DOM probing.
 * @param ctx - client context carrying the Provider directory.
 * @param modelCount - reads the current active model count from plugin state.
 */
function installProviderDirectory(
  ctx: ClientContext,
  modelCount: () => number | undefined,
  extras: { catalogId: string, account: () => { state: 'connected' | 'configured' | 'unconnected' | 'unknown' } },
): void {
  ctx.inject(['providerDirectory'], scope => {
    scope.effect(() => {
      const declaration = Object.assign({
        key: CODEX_SETTINGS_NAMESPACE,
        name: 'Codex',
        header: 'shared' as const,
        detail: 'shared' as const,
        usage: createCodexUsageReader(),
        modelCount,
      }, {
        catalogId: extras.catalogId,
        account: extras.account,
      })
      return scope.providerDirectory.register(declaration as Parameters<typeof scope.providerDirectory.register>[0])
    }, 'dsh-llm-codex: provider directory registration')
  })
}

import {
  CODEX_RPC_ENDPOINT,
  CODEX_AUTH_STATUS_ENDPOINT,
  CODEX_AUTH_BEGIN_ENDPOINT,
  CODEX_AUTH_CANCEL_ENDPOINT,
  CODEX_AUTH_ATTEMPT_STATUS_ENDPOINT,
  CODEX_AUTH_LOGOUT_ENDPOINT,
  CODEX_SAVE_ENDPOINT,
  CODEX_MODELS_FETCH_ENDPOINT,
  CODEX_SETTINGS_NAMESPACE,
  CODEX_SETTINGS_ENTRY_ID,
  decodeCodexAuthLoginReply,
  decodeCodexAuthLogoutReply,
  decodeCodexAuthStatus,
  decodeCodexAuthAttemptStatus,
  decodeCodexSaveResult,
  decodeCodexSettings,
  decodeCodexModelCatalog,
} from '../client-contract.ts'
import { officialPickerCatalog } from '../catalog.ts'
import { CodexPluginCard } from './CodexPluginCard.tsx'
import type { CodexPluginCardFace } from './CodexPluginCard.tsx'
import { CodexModelPicker, CodexModelPickerController } from './CodexModelPicker.tsx'
import type { CodexModelPickerFace } from './CodexModelPicker.tsx'
import { en, zh } from './locales.ts'
import type { CodexSettingsKey } from './locales.ts'
import type { CodexSettingsView } from '../client-contract.ts'


declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Codex Plugin configuration copy. */
    'settings.codex': CodexSettingsKey
  }
}

export const name = 'dsh-llm-codex-client'
export const inject = ['slots', 'locale', 'connection', 'configForms']


export function apply(ctx: ClientContext): void {

  const localeNamespace = 'settings.codex'
  ctx.effect(
    () => ctx.locale.register(localeNamespace, { zh, en }),
    'dsh-llm-codex: Plugin configuration copy',
  )
  const t = ctx.locale.bind(localeNamespace) as CodexPluginCardFace['t']
  const picker = new CodexModelPickerController()
  const { rpc, isLoopback } = ctx.get('connection') as unknown as ConnectionHandle
  const settingsForm = ctx.configForms.get<Partial<CodexSettingsView>>(CODEX_SETTINGS_ENTRY_ID)
  const callCodex = (endpoint: string, payload: unknown, signal?: AbortSignal) =>
    rpc.call('/api', CODEX_RPC_ENDPOINT, { endpoint, payload }, signal)
  const account = { state: 'unknown' as 'connected' | 'configured' | 'unconnected' | 'unknown' }
  let closed = false
  const publishAccount = (state: typeof account.state): void => {
    if (closed || account.state === state) return
    account.state = state
    try { ctx.get('providerDirectory')?.update(CODEX_SETTINGS_NAMESPACE) } catch { /* providerDirectory is optional in lab */ }
  }
  installProviderDirectory(ctx, () => decodeCodexSettings(settingsForm.getSnapshot().value)?.models.length, {
    catalogId: 'codex',
    account: () => ({ state: account.state }),
  })

  let authGeneration = 0
  /** Purge every bundle copy, even without providerDirectory. Stale reads check currency first. */
  const invalidateUsageCache = (): void => {
    dropPersistedUsageKeys([CODEX_SETTINGS_NAMESPACE])
    try { ctx.get('providerDirectory')?.invalidateUsage(CODEX_SETTINGS_NAMESPACE) } catch { /* providerDirectory is optional in lab */ }
  }

  const readAuthStatus: CodexPluginCardFace['readAuthStatus'] = async (signal) => {
    const generation = authGeneration
    const result = await callCodex(CODEX_AUTH_STATUS_ENDPOINT, { refresh: true }, signal)
    if (!result.ok) throw new Error(result.error.message)
    const decoded = decodeCodexAuthStatus(result.value)
    if (decoded === undefined) throw new Error('invalid auth status')
    if (generation !== authGeneration || closed) return decoded
    if (decoded.status === 'signed-out') invalidateUsageCache()
    publishAccount(decoded.status === 'signed-in' ? 'connected' : 'unconnected')
    return decoded
  }

  const startAuth: CodexPluginCardFace['startAuth'] = async () => {
    // Reserve the popup synchronously in the click handler; browsers block late opens.
    const authWindow = window.open('about:blank', '_blank')
    // Retain the WindowProxy for navigation while preventing reverse-tab access.
    if (authWindow !== null) authWindow.opener = null
    const result = await callCodex(CODEX_AUTH_BEGIN_ENDPOINT, {
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
    const generation = authGeneration
    const result = await callCodex(CODEX_AUTH_ATTEMPT_STATUS_ENDPOINT, { attemptId })
    if (!result.ok) throw new Error(result.error.message)
    const decoded = decodeCodexAuthAttemptStatus(result.value)
    if (decoded === undefined) throw new Error('invalid auth attempt status')
    if (generation !== authGeneration || closed) return decoded
    if (decoded.status === 'succeeded') {
      authGeneration += 1
      invalidateUsageCache()
      publishAccount('connected')
    }
    return decoded
  }

  const cancelAuth: CodexPluginCardFace['cancelAuth'] = async (attemptId) => {
    const result = await callCodex(CODEX_AUTH_CANCEL_ENDPOINT, { attemptId })
    if (!result.ok) throw new Error(result.error.message)
  }

  const logout: CodexPluginCardFace['logout'] = async () => {
    const result = await callCodex(CODEX_AUTH_LOGOUT_ENDPOINT, {})
    if (!result.ok || decodeCodexAuthLogoutReply(result.value) === undefined) throw new Error(result.ok ? 'invalid logout response' : result.error.message)
    authGeneration += 1
    invalidateUsageCache()
    publishAccount('unconnected')
  }

  const fetchModels: CodexPluginCardFace['fetchModels'] = async () => {
    const result = await callCodex(CODEX_MODELS_FETCH_ENDPOINT, {})
    const models = result.ok ? decodeCodexModelCatalog(result.value) : undefined
    return models ?? officialPickerCatalog()
  }

  const saveConfiguration: CodexPluginCardFace['saveConfiguration'] = async (settings) => {
    const snapshot = settingsForm.getSnapshot()
    if (snapshot.revision === undefined) throw new Error(t('requestFailed'))
    const saved = await callCodex(CODEX_SAVE_ENDPOINT, {
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
    return accepted
  }

  ctx.effect(() => {
    const ac = new AbortController()
    void readAuthStatus(ac.signal).catch(() => { /* overview stays unknown until a later card read */ })
    return () => {
      ac.abort()
      closed = true
    }
  }, 'dsh-llm-codex: account snapshot')

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
      hooks: { codexSettings: settingsForm },
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
