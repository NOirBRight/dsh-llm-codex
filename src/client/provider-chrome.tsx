/** Shared Providers chrome: official DSH glyphs, auth row, chart skeleton. */

import type { CSSProperties, ReactNode } from 'react'

const REFRESH_PATH = "M1.272 6.21348C1.70645 3.08888 4.59169 0.908064 7.71634 1.34239C8.95495 1.51469 10.0438 2.07331 10.8814 2.87755L11.9458 1.81407C12.1347 1.6255 12.4572 1.75911 12.4575 2.02598V5.08751C12.4574 5.25303 12.3233 5.38731 12.1577 5.38731H9.0972C8.82993 5.38731 8.69629 5.06361 8.88528 4.87462L10.0327 3.72618C9.3732 3.09994 8.52006 2.66569 7.5513 2.53087C5.08313 2.18779 2.80376 3.91044 2.46048 6.37852C2.11747 8.84665 3.84009 11.1261 6.30814 11.4693C8.77612 11.8121 11.0557 10.0896 11.399 7.62169L11.9937 7.70372L12.5874 7.78673C12.153 10.9112 9.26756 13.0919 6.1431 12.6578C3.01854 12.2234 0.837738 9.33809 1.272 6.21348Z"

function ensureMotionStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById('dsh-provider-motion') !== null) return
  const style = document.createElement('style')
  style.id = 'dsh-provider-motion'
  style.textContent = [
    '@keyframes dsh-provider-spin{to{transform:rotate(360deg)}}',
    '@keyframes dsh-provider-shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}',
  ].join('')
  document.head.appendChild(style)
}

const iconButtonStyle: CSSProperties = {
  boxSizing: 'border-box',
  width: 28,
  height: 28,
  padding: 0,
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 999,
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flex: 'none',
}

const authRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
}

const trackStyle: CSSProperties = {
  boxSizing: 'border-box',
  height: 14,
  overflow: 'hidden',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 14%, transparent)',
}

const shimmerStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  background: 'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--dsw-alias-label-primary) 22%, transparent) 50%, transparent 100%)',
  backgroundSize: '200% 100%',
  animation: 'dsh-provider-shimmer 1.25s ease-in-out infinite',
}

const chipStyle: CSSProperties = {
  display: 'inline-block',
  height: 12,
  borderRadius: 4,
  background: 'linear-gradient(90deg, color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent) 0%, color-mix(in srgb, var(--dsw-alias-label-primary) 22%, transparent) 50%, color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent) 100%)',
  backgroundSize: '200% 100%',
  animation: 'dsh-provider-shimmer 1.25s ease-in-out infinite',
}

/** Account status on the left, sign-in / sign-out on the right. */
export function AuthToolbar(props: { status: ReactNode; action: ReactNode }): ReactNode {
  return (
    <div style={authRowStyle}>
      <div style={{ minWidth: 0, flex: 1 }}>{props.status}</div>
      <div style={{ flex: 'none' }}>{props.action}</div>
    </div>
  )
}

/** Official `ic_ds_refresh_outline_14` glyph; spins while refreshing. */
export function RefreshIcon(props: { spinning?: boolean }): ReactNode {
  ensureMotionStyles()
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      style={props.spinning === true ? { animation: 'dsh-provider-spin 0.8s linear infinite' } : undefined}
    >
      <path fill="currentColor" d={REFRESH_PATH} />
    </svg>
  )
}

/** Icon-only refresh control used by every provider usage block. */
export function UsageRefreshButton(props: {
  spinning: boolean
  disabled?: boolean
  label: string
  busyLabel: string
  onClick: () => void
}): ReactNode {
  return (
    <button
      type="button"
      style={iconButtonStyle}
      disabled={props.disabled === true}
      aria-label={props.spinning ? props.busyLabel : props.label}
      onClick={props.onClick}
    >
      <RefreshIcon spinning={props.spinning} />
    </button>
  )
}

/** Quota chart skeleton: same 14px tracks as live bars, with a moving sheen. */
export function UsageSkeleton(props: { rows?: number }): ReactNode {
  ensureMotionStyles()
  const rows = props.rows ?? 2
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ ...chipStyle, width: index === 0 ? 92 : 78 }} />
            <span style={{ ...chipStyle, width: 36 }} />
          </div>
          <div style={trackStyle}>
            <span style={shimmerStyle} />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Title + official refresh glyph used above usage bars.
 * @param props.title - localized usage heading.
 * @param props.spinning - whether a refresh is in flight.
 * @param props.disabled - when true, the refresh button is inert.
 * @param props.refreshLabel - idle aria-label.
 * @param props.busyLabel - aria-label while spinning.
 * @param props.onRefresh - fetch handler.
 * @param props.error - short failure hint shown left of the button.
 * @returns the usage block heading row.
 */
export function UsageHeader(props: {
  title: ReactNode
  spinning: boolean
  disabled?: boolean
  refreshLabel: string
  busyLabel: string
  onRefresh: () => void
  error?: string
}): ReactNode {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, lineHeight: '18px' }}>{props.title}</h3>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: 'none' }}>
        {props.error !== undefined && props.error.length > 0
          ? <span style={{ fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-state-error-primary)' }}>{props.error}</span>
          : null}
        <UsageRefreshButton
          spinning={props.spinning}
          disabled={props.disabled === true}
          label={props.refreshLabel}
          busyLabel={props.busyLabel}
          onClick={props.onRefresh}
        />
      </span>
    </div>
  )
}

/** Format a usage stamp as a compact local clock, e.g. "12:04". */
export function formatUsageClock(at: Date): string {
  return at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}

function interpolateCopy(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/gu, (_match, key: string) => String(params[key] ?? ''))
}

function chineseLocale(locales?: string | readonly string[]): boolean {
  const locale = typeof locales === 'string'
    ? locales
    : locales?.[0] ?? (typeof navigator === 'undefined' ? undefined : navigator.language)
  return typeof locale === 'string' && /^zh\b/iu.test(locale)
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** Official grok.com form: 2026年8月20日 11:35. English stays a short local datetime. */
export function formatResetStamp(iso: string, locales?: string | readonly string[]): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return iso
  if (chineseLocale(locales)) {
    return String(at.getFullYear()) + '年' + String(at.getMonth() + 1) + '月' + String(at.getDate()) + '日 ' + pad2(at.getHours()) + ':' + pad2(at.getMinutes())
  }
  return new Intl.DateTimeFormat(locales as string | string[] | undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at)
}

/** Official Cursor form: Sep 16 / 9月16日. */
export function formatResetDate(iso: string, locales?: string | readonly string[]): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return iso
  if (chineseLocale(locales)) {
    return String(at.getMonth() + 1) + '月' + String(at.getDate()) + '日'
  }
  return new Intl.DateTimeFormat(locales as string | string[] | undefined, {
    month: 'short',
    day: 'numeric',
  }).format(at)
}

/** Whole days until reset when at least one day remains; otherwise the datetime form is used. */
export function remainingResetDays(iso: string, now = Date.now()): number | undefined {
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return undefined
  const dayMs = 24 * 60 * 60 * 1000
  const days = Math.round((at - now) / dayMs)
  return days >= 1 ? days : undefined
}

/** Localized reset line matching official dashboards. */
export function resetLabelOf(
  iso: string | undefined,
  copy: { at: string, atDays: string },
  now?: number,
): string | undefined {
  if (iso === undefined) return undefined
  const locales = copy.at.includes('重置') ? 'zh-CN' : 'en'
  const days = remainingResetDays(iso, now)
  if (days !== undefined) {
    return interpolateCopy(copy.atDays, { date: formatResetDate(iso, locales), count: days })
  }
  return interpolateCopy(copy.at, { time: formatResetStamp(iso, locales) })
}

/** Official-style reset caption under a usage bar. */
export function UsageResetAt(props: { label: string | undefined }): ReactNode {
  if (props.label === undefined || props.label.length === 0) return null
  return (
    <p
      style={{
        margin: 0,
        fontSize: 12,
        lineHeight: '18px',
        color: 'var(--dsw-alias-label-tertiary)',
      }}
    >
      {props.label}
    </p>
  )
}

/**
 * Last successful usage read, right-aligned under the bars.
 * @param props.at - when the last successful snapshot arrived.
 * @param props.label - already-localized "12:04 已更新".
 * @returns the stamp, or nothing before the first success.
 */
export function UsageUpdatedAt(props: { at: Date | undefined; label: string }): ReactNode {
  if (props.at === undefined) return null
  return (
    <p
      style={{
        margin: 0,
        textAlign: 'right',
        fontSize: 12,
        lineHeight: '18px',
        color: 'var(--dsw-alias-label-tertiary)',
      }}
    >
      {props.label}
    </p>
  )
}

/** Shared selected-A header: monochrome role badge plus segmented remaining-quota meter.
 * Re-exported from the built dsh-llm-providers-ui/provider-ui artifact; this
 * module keeps the local auth/usage helpers that are not part of the shared API.
 */
export {
  ProviderCardHeader,
  ProviderQuotaMeter,
  normalizeQuotaRemaining,
  providerUiCss,
} from 'dsh-llm-providers-ui/provider-ui';
export type {
  ProviderCardHeaderProps,
  ProviderCardRole,
  ProviderQuotaMeterProps,
  ProviderQuotaState,
} from 'dsh-llm-providers-ui/provider-ui';
