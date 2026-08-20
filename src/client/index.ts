/** Browser half: Codex setup inside Plugin configuration. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import {
  CODEX_AUTH_LOGIN_PATH,
  CODEX_AUTH_LOGOUT_PATH,
  CODEX_AUTH_STATUS_PATH,
  CODEX_RPC_CHANNEL,
  CODEX_SAVE_ENDPOINT,
  CODEX_SETTINGS_NAMESPACE,
  decodeCodexAuthLoginReply,
  decodeCodexAuthLogoutReply,
  decodeCodexAuthStatus,
  decodeCodexSaveResult,
  decodeCodexSettings,
} from '../client-contract.ts'
import type { CodexSettingsView } from '../client-contract.ts'
import { officialPickerCatalog } from '../catalog.ts'
import { ensureProviderSection } from './provider-section.ts'
import { CodexPluginCard } from './CodexPluginCard.tsx'
import type { CodexPluginCardFace } from './CodexPluginCard.tsx'
import { CodexModelPicker, CodexModelPickerController } from './CodexModelPicker.tsx'
import type { CodexModelPickerFace } from './CodexModelPicker.tsx'
import { en, zh } from './locales.ts'
import type { CodexSettingsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Codex Plugin configuration copy. */
    'settings.codex': CodexSettingsKey
  }
}

export const name = 'dsh-llm-codex-client'
export const inject = ['slots', 'locale', 'connection', 'settingsScope']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function jsonRequest<T>(path: string, method: string, decode: (value: unknown) => T | undefined, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { accept: 'application/json', 'cache-control': 'no-store' },
    cache: 'no-store',
    credentials: 'same-origin',
    ...signal === undefined ? {} : { signal },
  })
  const value: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const message = isRecord(value) && typeof value['error'] === 'string'
      ? value['error']
      : 'HTTP ' + String(response.status)
    throw new Error(message)
  }
  const decoded = decode(value)
  if (decoded === undefined) throw new Error('invalid response')
  return decoded
}

export function apply(ctx: ClientContext): void {
  const localeNamespace = 'settings.codex'
  ctx.effect(
    () => ctx.locale.register(localeNamespace, { zh, en }),
    'dsh-llm-codex: Plugin configuration copy',
  )
  const t = ctx.locale.bind(localeNamespace) as CodexPluginCardFace['t']
  const scope = ctx.settingsScope.bind<CodexSettingsView>({
    namespace: CODEX_SETTINGS_NAMESPACE,
    decode: decodeCodexSettings,
  })
  const picker = new CodexModelPickerController()
  const { rpc } = ctx.get('connection') as unknown as ConnectionHandle

  const readAuthStatus: CodexPluginCardFace['readAuthStatus'] = async (signal) => {
    return jsonRequest(CODEX_AUTH_STATUS_PATH, 'GET', decodeCodexAuthStatus, signal)
  }

  const startAuth: CodexPluginCardFace['startAuth'] = async () => {
    return jsonRequest(CODEX_AUTH_LOGIN_PATH, 'POST', decodeCodexAuthLoginReply)
  }

  const logout: CodexPluginCardFace['logout'] = async () => {
    await jsonRequest(CODEX_AUTH_LOGOUT_PATH, 'POST', decodeCodexAuthLogoutReply)
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

  ensureProviderSection(ctx)
  ctx.slots.inject('settings.provider.item', () => ctx.slots.register({
    name: 'settings.provider.item',
    key: CODEX_SETTINGS_NAMESPACE,
    locale: localeNamespace,
    inject: (): CodexPluginCardFace => ({
      t,
      hooks: { codexSettings: scope },
      startAuth,
      readAuthStatus,
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
