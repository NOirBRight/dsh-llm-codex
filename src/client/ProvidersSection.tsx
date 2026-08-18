/** Settings > 供应商 page shell. Provider cards arrive through settings.provider.item. */

import type { CSSProperties, ReactNode } from 'react'
import { Fragment } from 'react'
import { PROVIDER_ITEM_ORDER, PROVIDERS_ITEM_SLOT, PROVIDERS_LOCALE_NS } from './provider-section.ts'

interface ProvidersSectionProps {
  renderSlot?: (name: string, slotProps: object, opts?: { entryKey?: string }) => ReactNode
  t?: (key: 'title' | 'subtitle' | 'empty') => string
}

const pageStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  width: '100%',
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--dsw-alias-label-primary)',
  fontSize: 16,
  fontWeight: 500,
  lineHeight: '24px',
}

const subtitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--dsw-alias-label-secondary)',
  fontSize: 13,
  lineHeight: '20px',
}

const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const emptyStyle: CSSProperties = {
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: 13,
  lineHeight: '20px',
}

/**
 * Render the shared providers page. Missing keys stay empty so an uninstalled
 * plugin does not occupy space; when every provider plugin is gone the section
 * registration itself is disposed and this page unmounts.
 */
export function ProvidersSection(props: ProvidersSectionProps): ReactNode {
  const t = props.t ?? ((key: 'title' | 'subtitle' | 'empty') => key)
  const renderSlot = props.renderSlot
  const items = PROVIDER_ITEM_ORDER.map(key => {
    const node = renderSlot?.(PROVIDERS_ITEM_SLOT, {}, { entryKey: key })
    return node == null ? null : <Fragment key={key}>{node}</Fragment>
  }).filter(Boolean)

  return (
    <div data-providers-section={PROVIDERS_LOCALE_NS} style={pageStyle}>
      <header>
        <h2 style={titleStyle}>{t('title')}</h2>
        <p style={subtitleStyle}>{t('subtitle')}</p>
      </header>
      {items.length > 0
        ? <div style={listStyle}>{items}</div>
        : <p style={emptyStyle}>{t('empty')}</p>}
    </div>
  )
}
