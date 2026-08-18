/** Shared Providers chrome: official DSH glyphs, auth row, chart skeleton. */

import type { CSSProperties, ReactNode } from 'react'

const LABELS = new Set(['LLM 供应商', 'LLM Providers', '供应商', 'Providers'])
const MARK = 'data-dsh-providers-icon'
const GLOBE_PATH = "M7.00018 0.353516C10.6708 0.353535 13.6468 3.32958 13.6469 7.00018C13.6468 10.6708 10.6708 13.6468 7.00018 13.6469C3.32957 13.6468 0.353535 10.6708 0.353516 7.00018C0.353535 3.32957 3.32957 0.353531 7.00018 0.353516ZM5.44643 7.59661C5.49463 8.97506 5.70762 10.191 6.02136 11.0793C6.20141 11.5891 6.40328 11.9585 6.59898 12.1889C6.79501 12.4196 6.93213 12.454 7.00018 12.454C7.06822 12.454 7.20533 12.4197 7.40138 12.1889C7.59708 11.9585 7.79895 11.589 7.979 11.0793C8.29274 10.191 8.50574 8.97506 8.55394 7.59661H5.44643ZM1.57861 7.59661C1.80785 9.70467 3.2386 11.4509 5.1715 12.1388C5.07135 11.9317 4.97972 11.7098 4.89746 11.477C4.53084 10.4391 4.30224 9.0828 4.25357 7.59661H1.57861ZM9.74679 7.59661C9.69813 9.0828 9.46952 10.4391 9.1029 11.477C9.0206 11.7099 8.92818 11.9316 8.82797 12.1388C10.7613 11.4511 12.1925 9.70496 12.4218 7.59661H9.74679ZM5.1706 1.8616C3.23814 2.54963 1.80876 4.29604 1.5795 6.40376H4.25357C4.30224 4.91756 4.53083 3.56129 4.89746 2.5234C4.97968 2.29066 5.07051 2.0686 5.1706 1.8616ZM7.00018 1.54637C6.93213 1.54638 6.79503 1.5807 6.59898 1.81145C6.40332 2.04177 6.20139 2.41058 6.02136 2.92012C5.70754 3.80851 5.49461 5.02499 5.44643 6.40376H8.55394C8.50575 5.025 8.29282 3.80851 7.979 2.92012C7.79898 2.41059 7.59705 2.04177 7.40138 1.81145C7.20531 1.58067 7.06823 1.54637 7.00018 1.54637ZM8.82887 1.8616C8.92902 2.0687 9.02064 2.29053 9.1029 2.5234C9.46953 3.56129 9.69812 4.91756 9.74679 6.40376H12.4209C12.1916 4.29575 10.7618 2.54943 8.82887 1.8616Z"
const REFRESH_PATH = "M1.272 6.21348C1.70645 3.08888 4.59169 0.908064 7.71634 1.34239C8.95495 1.51469 10.0438 2.07331 10.8814 2.87755L11.9458 1.81407C12.1347 1.6255 12.4572 1.75911 12.4575 2.02598V5.08751C12.4574 5.25303 12.3233 5.38731 12.1577 5.38731H9.0972C8.82993 5.38731 8.69629 5.06361 8.88528 4.87462L10.0327 3.72618C9.3732 3.09994 8.52006 2.66569 7.5513 2.53087C5.08313 2.18779 2.80376 3.91044 2.46048 6.37852C2.11747 8.84665 3.84009 11.1261 6.30814 11.4693C8.77612 11.8121 11.0557 10.0896 11.399 7.62169L11.9937 7.70372L12.5874 7.78673C12.153 10.9112 9.26756 13.0919 6.1431 12.6578C3.01854 12.2234 0.837738 9.33809 1.272 6.21348Z"

const NAV = '<path fill-rule="evenodd" clip-rule="evenodd" fill="currentColor" d="' + GLOBE_PATH + '"/>'

function patchNav(): void {
  if (typeof document === 'undefined') return
  for (const button of document.querySelectorAll('nav button')) {
    const label = [...button.querySelectorAll('span')].find(span => LABELS.has(span.textContent?.trim() ?? ''))
    if (label === undefined) continue
    const svg = button.querySelector('svg')
    if (svg === null || svg.getAttribute(MARK) === 'globe') continue
    svg.setAttribute(MARK, 'globe')
    svg.setAttribute('viewBox', '0 0 14 14')
    svg.setAttribute('fill', 'none')
    svg.innerHTML = NAV
  }
}

/** Use the official 14px globe glyph on the LLM 供应商 nav row. */
export function installProvidersNavIcon(): () => void {
  if (typeof document === 'undefined' || document.body === null) return () => {}
  ensureMotionStyles()
  let scheduled = false
  let frame = 0
  const flush = (): void => {
    scheduled = false
    frame = 0
    patchNav()
  }
  const observer = new MutationObserver(() => {
    if (scheduled) return
    scheduled = true
    frame = requestAnimationFrame(flush)
  })
  observer.observe(document.body, { childList: true, subtree: true })
  patchNav()
  return () => {
    observer.disconnect()
    if (frame !== 0) cancelAnimationFrame(frame)
    frame = 0
    scheduled = false
  }
}

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

export const providerHeaderStyle: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  minHeight: 68,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  border: 0,
  padding: '12px 14px',
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary)',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
}

/** Join connection status and model count: "已登录 · 8 个模型". */
export function formatProviderSummary(status: string, modelsLabel: string): string {
  return status.replace(/[。.]$/u, '') + ' · ' + modelsLabel
}

/** Fixed-height collapsed header: mark, title, status · count, chevron. */
export function ProviderCardHeader(props: {
  title: string
  mark: ReactNode
  summary: string
  open: boolean
  unsaved?: boolean
  unsavedLabel?: string
}): ReactNode {
  return (
    <>
      <span style={{ display: 'flex', minWidth: 0, flex: 1, flexDirection: 'column', gap: 4 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, lineHeight: 1 }}>
          <span style={{ width: 18, height: 18, flex: 'none', display: 'block', overflow: 'visible' }}>{props.mark}</span>
          <span style={{ lineHeight: '20px' }}>{props.title}</span>
        </span>
        <span
          style={{
            fontSize: 13,
            lineHeight: '18px',
            color: 'var(--dsw-alias-label-tertiary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {props.summary}
        </span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flex: 'none' }}>
        {props.unsaved === true && props.unsavedLabel !== undefined
          ? <span style={{ fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' }}>{props.unsavedLabel}</span>
          : null}
        <span aria-hidden="true" style={{ fontSize: 18, transform: props.open ? 'rotate(180deg)' : 'none' }}>⌄</span>
      </span>
    </>
  )
}
