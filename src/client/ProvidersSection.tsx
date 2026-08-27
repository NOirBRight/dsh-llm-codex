/** Settings > 供应商 page shell. Provider cards arrive through settings.provider.item. */

import { Fragment, useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { PROVIDER_ITEM_ORDER, PROVIDERS_ITEM_SLOT, PROVIDERS_LOCALE_NS } from './provider-section.ts'

interface ProvidersSectionProps {
  renderSlot?: (name: string, slotProps: object, opts?: { entryKey?: string }) => ReactNode
  t?: (key: 'title' | 'subtitle' | 'empty') => string
  /** Live keyed contributions; preferred order first, unknown plugins append. */
  registeredKeys?: readonly string[]
}

const pageStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 16, width: '100%',
}
const titleStyle: CSSProperties = {
  margin: 0, color: 'var(--dsw-alias-label-primary)', fontSize: 16, fontWeight: 500, lineHeight: '24px',
}
const subtitleStyle: CSSProperties = {
  margin: '4px 0 0', color: 'var(--dsw-alias-label-secondary)', fontSize: 13, lineHeight: '20px',
}
const listStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 }
const emptyStyle: CSSProperties = { color: 'var(--dsw-alias-label-tertiary)', fontSize: 13, lineHeight: '20px' }

/** Stable known order, then any keyed card the owner did not know about. */
export function orderedProviderItemKeys(registeredKeys: readonly string[] = []): string[] {
  const registered = [...new Set(registeredKeys.filter(key => key.length > 0))]
  if (registered.length === 0) return [...PROVIDER_ITEM_ORDER]
  const preferred = PROVIDER_ITEM_ORDER.filter(key => registered.includes(key))
  const extra = registered.filter(key => !(PROVIDER_ITEM_ORDER as readonly string[]).includes(key))
  return [...preferred, ...extra]
}

/** Bind the shared page to the live keyed-slot ledger so new plugins appear without a whitelist bump. */
export function bindProvidersSection(
  listRegisteredKeys: () => readonly string[],
  subscribe?: (listener: () => void) => (() => void) | undefined,
): (props: ProvidersSectionProps) => ReactNode {
  return function BoundProvidersSection(props: ProvidersSectionProps): ReactNode {
    const [, bump] = useState(0)
    useEffect(() => subscribe?.(() => bump(n => n + 1)) ?? (() => {}), [subscribe, listRegisteredKeys])
    return <ProvidersSection {...props} registeredKeys={listRegisteredKeys()} />
  }
}

/** Render installed provider cards. Unknown plugins append after the preferred order. */
export function ProvidersSection(props: ProvidersSectionProps): ReactNode {
  const t = props.t ?? ((key: 'title' | 'subtitle' | 'empty') => key)
  const renderSlot = props.renderSlot
  const keys = orderedProviderItemKeys(props.registeredKeys)
  const items = keys.map(key => {
    const node = renderSlot?.(PROVIDERS_ITEM_SLOT, {}, { entryKey: key })
    return node == null ? null : <Fragment key={key}>{node}</Fragment>
  }).filter(Boolean)

  return (
    <div data-providers-section={PROVIDERS_LOCALE_NS} style={pageStyle}>
      <header>
        <h2 style={titleStyle}>{t('title')}</h2>
        <p style={subtitleStyle}>{t('subtitle')}</p>
      </header>
      {items.length > 0 ? <div style={listStyle}>{items}</div> : <p style={emptyStyle}>{t('empty')}</p>}
    </div>
  )
}
