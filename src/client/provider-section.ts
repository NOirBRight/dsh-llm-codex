/** Shared Settings > 供应商 section. First installed provider plugin wins the nav row. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { installProvidersNavIcon } from './provider-chrome.tsx'
import { ProvidersSection } from './ProvidersSection.tsx'

export const PROVIDERS_SECTION_ID = 'providers'
export const PROVIDERS_ITEM_SLOT = 'settings.provider.item'
export const PROVIDERS_LOCALE_NS = 'settings.providers'

/** Display order for installed provider cards. Absent plugins render nothing. */
export const PROVIDER_ITEM_ORDER = ['llm-cursor', 'llm-grok', 'llm-codex', 'llm-ollama'] as const

const copy = {
  zh: {
    nav: '供应商',
    title: '供应商',
    subtitle: '连接账号，并选择哪些模型出现在对话的模型列表里。',
    empty: '安装 Cursor、Grok、Codex 或 Ollama Cloud 后，在这里连接账号并选择模型。',
  },
  en: {
    nav: 'Providers',
    title: 'Providers',
    subtitle: 'Connect accounts and choose which models appear in the chat picker.',
    empty: 'Install Cursor, Grok, Codex, or Ollama Cloud to connect an account and pick models here.',
  },
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'settings.provider.item': { kind: 'keyed'; scope: 'root' }
  }
  interface LocaleNamespaceMap {
    'settings.providers': keyof typeof copy.en
  }
}

interface SlotsFace {
  inject(name: string, factory: () => (() => void) | void): void
  register(options: Record<string, unknown>, component: unknown): () => void
  entries(name: string): readonly { options: { id?: string } }[]
  subscribe?(name: string, listener: () => void): () => void
}

interface LocaleFace {
  register(namespace: string, dicts: { zh: Record<string, string>; en: Record<string, string> }): () => void
  bind(namespace: string): (key: string) => string
}

function isOccupied(slots: SlotsFace): boolean {
  return slots.entries('settings.section').some(entry => entry.options.id === PROVIDERS_SECTION_ID)
}

function duplicateSection(error: unknown): boolean {
  return error instanceof Error && /already has|requires options/.test(error.message)
}

/**
 * Register the shared 供应商 section when missing. Uninstalling every
 * provider plugin drops the nav row because only they call this helper.
 * @param ctx - browser plugin context (slots + locale).
 */
export function ensureProviderSection(ctx: ClientContext): void {
  const slots = ctx.slots as unknown as SlotsFace
  const locale = ctx.locale as unknown as LocaleFace

  ctx.slots.inject('settings.section', () => {
    let disposeSection: (() => void) | undefined
    let disposeLocale: (() => void) | undefined
    let disposeIcon: (() => void) | undefined

    const claim = (): void => {
      if (disposeSection !== undefined || isOccupied(slots)) return
      disposeLocale ??= locale.register(PROVIDERS_LOCALE_NS, copy)
      const t = locale.bind(PROVIDERS_LOCALE_NS)
      try {
        disposeSection = slots.register({
          name: 'settings.section',
          id: PROVIDERS_SECTION_ID,
          order: 12,
          label: () => t('nav'),
          locale: PROVIDERS_LOCALE_NS,
          children: { [PROVIDERS_ITEM_SLOT]: { kind: 'keyed', scope: 'root' } },
        }, ProvidersSection)
        disposeIcon ??= installProvidersNavIcon()
      } catch (error) {
        if (!duplicateSection(error)) throw error
      }
    }

    claim()
    const stop = slots.subscribe?.('settings.section', () => {
      if (!isOccupied(slots)) {
        disposeSection = undefined
        claim()
      }
    })
    return () => {
      stop?.()
      disposeIcon?.()
      disposeIcon = undefined
      disposeSection?.()
      disposeSection = undefined
      disposeLocale?.()
      disposeLocale = undefined
    }
  })
}
