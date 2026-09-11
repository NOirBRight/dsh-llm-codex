/** Codex Plugin configuration card: ChatGPT login, usage, and an editable catalog. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { SettingsScope, SettingsScopeSnapshot } from './settings-scope.js'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import {
  CODEX_EFFORT_LABELS,
  CODEX_OFFICIAL_MODELS,
  defaultCodexReasoningEffort,
  effortsForCodexModel,
  officialImageGenerationModels,
  officialModelFor,
} from '../catalog.ts'
import type { CodexCatalogModel, CodexReasoningEffort } from '../catalog.ts'
import type {
  CodexAccountStatus,
  CodexSaveResult,
  CodexSearchContextSize,
  CodexSearchMode,
  CodexSettingsView,
  CodexUsage,
} from '../client-contract.ts'
import { CODEX_SETTINGS_NAMESPACE } from '../client-contract.ts'
import type { CodexSettingsKey } from './locales.ts'
import { BrandMark } from './BrandMark.tsx'
import { AuthToolbar, ProviderCardHeader, ProviderQuotaMeter, UsageHeader, UsageSkeleton, UsageUpdatedAt, formatUsageClock, providerUiCss, providerQuotaHeaderProps, resetLabelOf, useProviderQuotaCache } from './provider-chrome.tsx'
import type { ProviderQuotaState } from './provider-chrome.tsx'
import { SortableList } from 'dsh-llm-providers-ui/sortable'
import { ProviderDetail, providerDetailCopy, type ProviderItemSlotContext } from 'dsh-llm-providers-ui/provider-detail'


/** Display name recorded with the cached headline quota. */
const USAGE_PROVIDER_NAME = 'Codex'
import {
  ModelCatalogCapabilities,
  ModelCatalogDetails,
  ModelCatalogRow,
  fieldStyle,
  inputStyle,
  labelStyle,
  modelContentStyle,
  rowInputStyle,
  selectStyle,
} from './model-catalog-ui.tsx'

export type { CodexAccountStatus }

/** First re-read delay while a signed-in account has not published usable quota yet. */
const USAGE_SETTLE_START_MS = 1_500

/** Steady quota re-read cadence, and the ceiling on settle backoff: retrying never outpaces normal polling. */
const USAGE_POLL_INTERVAL_MS = 60_000

export interface CodexPluginCardFace {
  t: (key: CodexSettingsKey) => string
  hooks: {
    codexSettings: SettingsScope<CodexSettingsView>
  }
  readAuthStatus: (signal?: AbortSignal) => Promise<CodexAccountStatus>
  startAuth: () => Promise<{ url?: string; verificationUri?: string; userCode?: string; expiresAt?: number; attemptId?: string }>
  logout: () => Promise<void>
  cancelAuth: (attemptId?: string) => Promise<void>
  readAuthAttemptStatus: (attemptId: string) => Promise<{ status: 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'missing' }>
  fetchModels: () => Promise<readonly CodexCatalogModel[]>
  saveConfiguration: (settings: CodexSettingsView) => Promise<CodexSaveResult>
  beginModelPicker: (initiallyPicked: ReadonlySet<string>, onAdopt: (models: readonly CodexCatalogModel[]) => void) => void
  completeModelPicker: (candidates: readonly CodexCatalogModel[]) => void
  failModelPicker: (message: string) => void
  closeModelPicker: () => void
}

export type CodexPluginCardProps =
  PropsRuntime<'settings.provider.item'>
  & InjectFace<CodexPluginCardFace>
  // Present only on the settings page; an older host renders the legacy card.
  & Partial<ProviderItemSlotContext>

interface ModelDraft {
  rowId: string
  id: string
  name?: string
  thinking?: boolean
  vision?: boolean
  defaultEffort?: CodexReasoningEffort
  efforts?: CodexReasoningEffort[]
  contextWindow: string
  fast?: boolean
}

type CapabilityDraft = Pick<
  CodexSettingsView,
  'enableSearch' | 'enableImageTool' | 'enableImageGeneration' | 'searchModel' | 'imageGenerationModel' | 'searchMode' | 'searchContextSize' | 'searchMaxOutputTokens'
>

const cardStyle: CSSProperties = {
  overflow: 'hidden',
  fontFamily: 'var(--dsw-font-family)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 10,
  background: 'var(--dsw-alias-bg-module-platform)',
}
const bodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  borderTop: '1px solid var(--dsw-alias-border-l2)',
  padding: '16px 14px 18px',
}
const sectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 }
const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 600,
  color: 'var(--dsw-alias-label-primary)',
}
const hintStyle: CSSProperties = { margin: 0, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' }

const statusStyle: CSSProperties = { margin: 0, fontSize: 13, color: 'var(--dsw-alias-label-secondary)' }
const errorStyle: CSSProperties = { ...statusStyle, color: 'var(--dsw-alias-state-error-primary)' }
const buttonStyle: CSSProperties = {
  alignSelf: 'flex-start',
  minHeight: 34,
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 18,
  padding: '6px 14px',
  background: 'var(--dsw-alias-bg-layer-1)',
  color: 'var(--dsw-alias-label-primary)',
  font: 'inherit',
  cursor: 'pointer',
}
const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: 'var(--dsw-alias-button-primary-fill)',
  background: 'var(--dsw-alias-button-primary-fill)',
  color: 'var(--dsw-alias-label-primary-foreground)',
}


const actionsStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }
const iconButtonStyle: CSSProperties = {
  boxSizing: 'border-box',
  width: 28,
  height: 28,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 'none',
  border: 0,
  borderRadius: 6,
  padding: 0,
  background: 'transparent',
  color: 'var(--dsw-alias-label-tertiary)',
  font: 'inherit',
  cursor: 'pointer',
}
const disclosureStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  border: 0,
  padding: 0,
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary)',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
}


const checkboxStyle: CSSProperties = {
  accentColor: 'var(--dsw-alias-brand-primary)',
}
/* Selected-A quota meters come from the shared ProviderQuotaMeter; no local bar track. */

let nextModelRow = 0

function newModelRowId(): string {
  nextModelRow += 1
  return 'codex-model-row-' + String(nextModelRow)
}

function integerOf(text: string): number | undefined {
  const trimmed = text.trim()
  if (trimmed.length === 0) return undefined
  if (!/^[1-9]\d*$/u.test(trimmed)) return Number.NaN
  const value = Number(trimmed)
  return Number.isSafeInteger(value) ? value : Number.NaN
}

function modelDraftOf(model: CodexCatalogModel): ModelDraft {
  return {
    rowId: newModelRowId(),
    id: model.id,
    contextWindow: model.contextWindow === undefined ? '' : String(model.contextWindow),
    ...model.name === undefined ? {} : { name: model.name },
    ...model.thinking === undefined ? {} : { thinking: model.thinking },
    ...model.vision === undefined ? {} : { vision: model.vision },
    ...model.defaultEffort === undefined ? {} : { defaultEffort: model.defaultEffort },
    ...model.efforts === undefined ? {} : { efforts: model.efforts },
    ...model.fast === undefined ? {} : { fast: model.fast },
  }
}

function modelSettingsOf(draft: ModelDraft): CodexCatalogModel {
  const contextWindow = integerOf(draft.contextWindow)
  return {
    id: draft.id.trim(),
    ...draft.name === undefined || draft.name.trim().length === 0 ? {} : { name: draft.name.trim() },
    ...draft.thinking === undefined ? {} : { thinking: draft.thinking },
    ...draft.vision === undefined ? {} : { vision: draft.vision },
    ...draft.defaultEffort === undefined ? {} : { defaultEffort: draft.defaultEffort },
    ...draft.efforts === undefined ? {} : { efforts: draft.efforts },
    ...contextWindow === undefined || Number.isNaN(contextWindow) ? {} : { contextWindow },
    ...draft.fast === undefined ? {} : { fast: draft.fast },
  }
}

function imageGenerationPickerModels(selected: string): readonly { id: string, name: string }[] {
  const models = officialImageGenerationModels()
  if (selected.length === 0 || models.some(model => model.id === selected)) return models
  return [...models, { id: selected, name: selected }]
}

function capabilityOf(value: CodexSettingsView): CapabilityDraft {
  return {
    enableSearch: value.enableSearch,
    enableImageTool: value.enableImageTool,
    enableImageGeneration: value.enableImageGeneration,
    searchModel: value.searchModel,
    imageGenerationModel: value.imageGenerationModel,
    searchMode: value.searchMode,
    searchContextSize: value.searchContextSize,
    searchMaxOutputTokens: value.searchMaxOutputTokens,
  }
}

function sameDraft(left: readonly ModelDraft[], right: readonly ModelDraft[]): boolean {
  return JSON.stringify(left.map(modelSettingsOf)) === JSON.stringify(right.map(modelSettingsOf))
}

function modelFailure(models: readonly ModelDraft[]): boolean {
  const ids = new Set<string>()
  for (const model of models) {
    const id = model.id.trim()
    if (id.length === 0 || ids.has(id)) return true
    if (Number.isNaN(integerOf(model.contextWindow))) return true
    ids.add(id)
  }
  return false
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback
}

function interpolate(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/gu, (_match, key: string) => String(params[key] ?? ''))
}

function windowLabel(seconds: number, t: CodexPluginCardFace['t']): string {
  if (seconds === 5 * 60 * 60) return t('fiveHourLimit')
  if (seconds === 7 * 24 * 60 * 60) return t('weeklyLimit')
  const hours = seconds / (60 * 60)
  return Number.isInteger(hours) ? interpolate(t('hourLimit'), { count: hours }) : t('usageWindow')
}

/** Headline remaining quota from real auth/usage; null when no window is available (never synthetic). */
function headerQuotaOf(auth: CodexAccountStatus, lastUsage: CodexUsage | undefined, t: CodexPluginCardFace['t']): ProviderQuotaState | null {
  const usage = auth.status === 'signed-in' ? auth.usage : lastUsage
  const first = usage?.rateLimits[0]
  const window = first?.windows[0]
  if (first === undefined || window === undefined) return null
  const remaining = window.remainingPercent
  if (!Number.isFinite(remaining) || remaining < 0 || remaining > 100) return null
  const label = windowLabel(window.windowSeconds, t)
  const displayLabel = first.name === undefined || first.windows.length === 1
    ? first.name ?? label
    : first.name + ' · ' + label
  const detail = resetLabelOf(window.resetsAt, { at: t('usageResetAt'), atDays: t('usageResetAtDays') })
  return { remainingPercent: remaining, label: displayLabel, ...detail === undefined ? {} : { detail } }
}

function Capability({ label, checked, disabled, onChange }: {
  label: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}): ReactNode {
  return (
    <label style={{ ...labelStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <input
        type="checkbox"
        style={checkboxStyle}
        checked={checked}
        disabled={disabled}
        onChange={(event) => { onChange(event.target.checked) }}
      />
      {label}
    </label>
  )
}

function IconChevron({ open }: { open: boolean }): ReactNode {
  return (
    <svg
      width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden
      style={{ flex: 'none', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms ease' }}
    >
      <path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconTrash(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9a1 1 0 001 .9h4.6a1 1 0 001-.9L12 4M6.5 6.8v4.4M9.5 6.8v4.4"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

function DeviceCodeRow({ code, t }: { code: string; t: CodexPluginCardFace['t'] }): ReactNode {
  const [copied, setCopied] = useState(false)
  const timeout = useRef<number | undefined>(undefined)
  useEffect(() => () => {
    if (timeout.current !== undefined) window.clearTimeout(timeout.current)
  }, [])
  const fallbackCopy = (): void => {
    const textarea = document.createElement('textarea')
    textarea.value = code
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
  const copy = async (): Promise<void> => {
    try { await navigator.clipboard?.writeText(code) } catch { fallbackCopy() }
    if (timeout.current !== undefined) window.clearTimeout(timeout.current)
    setCopied(true)
    timeout.current = window.setTimeout(() => setCopied(false), 1800)
  }
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <code style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2 }}>{code}</code>
    <button type="button" style={buttonStyle} onClick={() => { void copy() }}>{copied ? t('copied') : t('copyCode')}</button>
  </div>
}

function UsageLimits({ usage, quotaError, t }: {
  usage: CodexUsage
  quotaError?: string
  t: CodexPluginCardFace['t']
}): ReactNode {
  if (quotaError !== undefined) return <p style={hintStyle}>{t('quotaUnavailable')}</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {usage.rateLimits.map(limit => (
        <div key={limit.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {limit.windows.map(window => {
            const remaining = window.remainingPercent
            if (!Number.isFinite(remaining) || remaining < 0 || remaining > 100) return null
            const label = windowLabel(window.windowSeconds, t)
            const displayLabel = limit.name === undefined || limit.windows.length === 1
              ? limit.name ?? label
              : limit.name + ' · ' + label
            const detail = resetLabelOf(window.resetsAt, {
              at: t('usageResetAt'),
              atDays: t('usageResetAtDays'),
            })
            return (
              <ProviderQuotaMeter
                key={label + String(window.windowSeconds)}
                remainingPercent={remaining}
                label={displayLabel}
                {...detail === undefined ? {} : { detail }}
              />
            )
          })}
        </div>
      ))}
      {usage.credits === undefined
        ? null
        : (
          <p style={hintStyle}>
            {usage.credits.unlimited
              ? t('unlimited')
              : usage.credits.balance === undefined
                ? t('credits')
                : interpolate(t('exactRemaining'), { remaining: usage.credits.balance, limit: usage.credits.balance })}
          </p>
        )}
    </div>
  )
}

export function CodexPluginCard(props: CodexPluginCardProps): ReactNode {
  const { t, readAuthStatus, readAuthAttemptStatus, startAuth, logout, cancelAuth, fetchModels } = props
  const snapshot = props.useCodexSettings((value: SettingsScopeSnapshot<CodexSettingsView>) => value)
  const [open, setOpen] = useState(false)
  const initial = useMemo(
    () => snapshot.value === undefined ? undefined : snapshot.value.models.map(modelDraftOf),
    [snapshot.value],
  )
  const [source, setSource] = useState<ModelDraft[] | undefined>(initial)
  const [draft, setDraft] = useState<ModelDraft[] | undefined>(initial)
  const [capabilities, setCapabilities] = useState<CapabilityDraft | undefined>(
    snapshot.value === undefined ? undefined : capabilityOf(snapshot.value),
  )
  const [sourceRevision, setSourceRevision] = useState<number | undefined>(snapshot.revision)
  const [auth, setAuth] = useState<CodexAccountStatus>({ status: 'loading' })
  /** True once a status read has answered: before that, "loading" is only the initial state. */
  const [authAnswered, setAuthAnswered] = useState(false)
  const [authChallenge, setAuthChallenge] = useState<{ url?: string; verificationUri?: string; userCode?: string; attemptId?: string } | undefined>()
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [modelSort, setModelSort] = useState(false)
  const [expandedModels, setExpandedModels] = useState<ReadonlySet<string>>(new Set())
  const [quotaRefreshing, setQuotaRefreshing] = useState(false)
  const [lastUsage, setLastUsage] = useState<CodexUsage | undefined>(undefined)
  const [usageUpdatedAt, setUsageUpdatedAt] = useState<Date | undefined>(undefined)
  const [refreshError, setRefreshError] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const mounted = useRef(true)
  const authAttempt = useRef(0)
  const title = t('title')
  const signingIn = auth.status === 'signing-in'
  const disabled = snapshot.status !== 'ready' || !snapshot.writable || busy
  const dirtyModels = source !== undefined && draft !== undefined && !sameDraft(source, draft)
  const dirtyCaps = snapshot.value !== undefined && capabilities !== undefined
    && JSON.stringify(capabilityOf(snapshot.value)) !== JSON.stringify(capabilities)
  const dirty = dirtyModels || dirtyCaps
  const invalidModels = draft !== undefined && modelFailure(draft)
  const invalidCaps = capabilities !== undefined && (
    capabilities.searchModel.trim().length === 0
    || capabilities.imageGenerationModel.trim().length === 0
    || !Number.isInteger(capabilities.searchMaxOutputTokens)
    || capabilities.searchMaxOutputTokens < 1
  )
  const invalid = invalidModels || invalidCaps
  const customModels = snapshot.user !== undefined && Object.prototype.hasOwnProperty.call(snapshot.user, 'models')

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (snapshot.status !== 'ready' || snapshot.value === undefined) return
    if (snapshot.revision === sourceRevision) return
    if (dirty) return
    const next = snapshot.value.models.map(modelDraftOf)
    setSource(next)
    setDraft(next)
    setCapabilities(capabilityOf(snapshot.value))
    setSourceRevision(snapshot.revision)
  }, [dirty, snapshot.revision, snapshot.status, snapshot.value, sourceRevision])

  useEffect(() => () => { props.closeModelPicker() }, [props.closeModelPicker])

  /** Fold one account-status answer into the card's state. */
  const applyAuthStatus = useCallback((next: CodexAccountStatus): void => {
    setAuthAnswered(true)
    setAuth(next)
    if (next.status !== 'signing-in') setAuthChallenge(undefined)
    if (next.status === 'signed-in') {
      if (next.quotaError === undefined) {
        setLastUsage(next.usage)
        setUsageUpdatedAt(new Date())
        setRefreshError(undefined)
      } else {
        setRefreshError(t('usageRefreshFailed'))
      }
    } else if (next.status === 'signed-out') {
      // Authoritative sign-out clears local usage state, not merely hides it:
      // retained lastUsage would otherwise resurrect as live quota on a later
      // reauth whose own read errors or reports no usable windows.
      setLastUsage(undefined)
      setUsageUpdatedAt(undefined)
      setRefreshError(undefined)
    }
  }, [t])

  const refreshAuth = useCallback(async (signal?: AbortSignal, spin = false): Promise<void> => {
    if (spin) setQuotaRefreshing(true)
    // Generation guard: a superseded read (sign-out, sign-in, unmount) must not
    // resurrect old-account usage into state or the persisted headline cache.
    const attempt = authAttempt.current
    try {
      const next = await readAuthStatus(signal)
      if (!liveAuthAttempt(attempt) || !mounted.current || signal?.aborted === true) return
      applyAuthStatus(next)
    } catch (error: unknown) {
      if (liveAuthAttempt(attempt) && signal?.aborted !== true) {
        setRefreshError(t('usageRefreshFailed'))
        setAuth(current => current.status === 'signed-in'
          ? current
          : { status: 'error', message: messageOf(error, t('statusFailed')) })
      }
    } finally {
      if (spin && mounted.current) setQuotaRefreshing(false)
    }
  }, [applyAuthStatus, readAuthStatus, t])

  // Header quota loads collapsed on mount; expansion reuses it and never refires the same read.
  useEffect(() => {
    const controller = new AbortController()
    void refreshAuth(controller.signal)
    return () => { controller.abort() }
  }, [refreshAuth])

  const liveQuota = headerQuotaOf(auth, lastUsage, t)
  // Signed-in and holding a usable headline window: the header is settled. Anything else —
  // a provider that has not published quota since the sign-in, or a read that failed — is
  // transient and must not wait out the 60s interval before the header can fill in.
  const usageSettled = refreshError === undefined && liveQuota !== null

  /**
   * Re-read while the header is withheld with nothing scheduled: 1.5s doubling up to the
   * steady interval, until a usable window arrives. The loop stops on settle, on any status
   * change, on collapse, and on unmount, so a card that is closed — or one whose account
   * never publishes a window — leaves no read running in the background; expanding it
   * resumes settling. Retrying renders nothing by itself: every attempt still passes the
   * generation guard, so a failing read keeps the previous account's quota withheld.
   */
  useEffect(() => {
    if (!open || auth.status !== 'signed-in' || usageSettled) return
    const controller = new AbortController()
    let stopped = false
    const settle = async (): Promise<void> => {
      let delay = USAGE_SETTLE_START_MS
      while (!stopped && mounted.current) {
        await new Promise(resolve => { window.setTimeout(resolve, delay) })
        if (stopped || !mounted.current) return
        await refreshAuth(controller.signal)
        if (stopped || !mounted.current) return
        delay = Math.min(delay * 2, USAGE_POLL_INTERVAL_MS)
      }
    }
    void settle()
    return () => { stopped = true; controller.abort() }
  }, [open, auth.status, refreshAuth, usageSettled])

  useEffect(() => {
    if (!open) return
    const interval = auth.status === 'signing-in'
      ? 1000
      : auth.status === 'signed-in' && usageSettled ? USAGE_POLL_INTERVAL_MS : undefined
    if (interval === undefined) return
    const controller = new AbortController()
    const timer = window.setInterval(() => { void refreshAuth(controller.signal) }, interval)
    return () => {
      window.clearInterval(timer)
      controller.abort()
    }
  }, [open, auth.status, refreshAuth, usageSettled])

  useEffect(() => {
    if (!open || auth.status !== 'signing-in' || authChallenge?.attemptId === undefined) return
    const attemptId = authChallenge.attemptId
    let stopped = false
    const poll = async (): Promise<void> => {
      try {
        const result = await readAuthAttemptStatus(attemptId)
        if (stopped || !mounted.current) return
        if (result.status === 'succeeded') {
          // Applying the signed-in status reruns this effect, which stops the poll;
          // quota settling then belongs to the settle effect.
          await refreshAuth()
          return
        }
        if (result.status === 'failed') setAuth({ status: 'error', message: t('signInFailed') })
        else if (result.status === 'cancelled' || result.status === 'missing') setAuth({ status: 'signed-out' })
      } catch { /* generic status polling remains the safe fallback */ }
    }
    void poll()
    const timer = window.setInterval(() => { void poll() }, 1000)
    return () => { stopped = true; window.clearInterval(timer) }
  }, [auth.status, authChallenge?.attemptId, open, readAuthAttemptStatus, refreshAuth, t])

  const patchDraft = (models: ModelDraft[]): void => {
    setDraft(models)
    setFailure(undefined)
    setNotice(undefined)
  }

  const nextAuthAttempt = (): number => {
    const attempt = authAttempt.current + 1
    authAttempt.current = attempt
    return attempt
  }
  const liveAuthAttempt = (attempt: number): boolean => mounted.current && attempt === authAttempt.current

  const onSignIn = async (): Promise<void> => {
    const attempt = nextAuthAttempt()
    setAuthBusy(true)
    setAuthChallenge(undefined)
    setAuth({ status: 'signing-in' })
    try {
      const challenge = await startAuth()
      if (liveAuthAttempt(attempt)) {
        setAuthChallenge({
          ...(challenge.url === undefined ? {} : { url: challenge.url }),
          ...(challenge.verificationUri === undefined ? {} : { verificationUri: challenge.verificationUri }),
          ...(challenge.userCode === undefined ? {} : { userCode: challenge.userCode }),
          ...(challenge.attemptId === undefined ? {} : { attemptId: challenge.attemptId }),
        })
      }
    } catch (error: unknown) {
      if (liveAuthAttempt(attempt)) setAuth({ status: 'error', message: messageOf(error, t('signInFailed')) })
    } finally {
      if (liveAuthAttempt(attempt)) setAuthBusy(false)
    }
  }

  const onCancelAuth = async (): Promise<void> => {
    const attempt = nextAuthAttempt()
    setAuthBusy(true)
    try {
      await cancelAuth(authChallenge?.attemptId)
      if (liveAuthAttempt(attempt)) {
        setAuth({ status: 'signed-out' })
        setAuthChallenge(undefined)
      }
    } catch (error: unknown) {
      if (liveAuthAttempt(attempt)) setAuth({ status: 'error', message: messageOf(error, t('signInFailed')) })
    } finally {
      if (liveAuthAttempt(attempt)) setAuthBusy(false)
    }
  }

  const onSignOut = async (): Promise<void> => {
    const attempt = nextAuthAttempt()
    setAuthBusy(true)
    try {
      await logout()
      if (liveAuthAttempt(attempt)) {
        setAuth({ status: 'signed-out' })
        setAuthChallenge(undefined)
        setLastUsage(undefined)
        setUsageUpdatedAt(undefined)
        setRefreshError(undefined)
      }
    } catch (error: unknown) {
      if (liveAuthAttempt(attempt)) setAuth({ status: 'error', message: messageOf(error, t('signOutFailed')) })
    } finally {
      if (liveAuthAttempt(attempt)) setAuthBusy(false)
    }
  }

  const chooseFromOfficial = async (): Promise<void> => {
    if (draft === undefined) return
    const currentModels = draft.map(modelSettingsOf)
    const initiallyPicked = new Set(currentModels.map(model => model.id))
    setFetching(true)
    setFailure(undefined)
    setNotice(undefined)
    props.beginModelPicker(initiallyPicked, selected => {
      setDraft((current) => {
        if (current === undefined) return current
        const currentById = new Map(current.map(model => [model.id.trim(), model]))
        const next = new Map<string, ModelDraft>()
        for (const candidate of selected) {
          const existing = currentById.get(candidate.id)
          const discovered = modelDraftOf(candidate)
          next.set(candidate.id, existing === undefined
            ? discovered
            : { ...existing, ...discovered, rowId: existing.rowId })
        }
        return [...next.values()]
      })
      setCatalogOpen(true)
      setFailure(undefined)
      setNotice(undefined)
    })
    try {
      const found = await fetchModels()
      if (found.length === 0) {
        const message = t('fetchEmpty')
        props.failModelPicker(message)
        setFailure(message)
        return
      }
      const foundIds = new Set(found.map(model => model.id))
      const currentOnly = currentModels.filter(model => !foundIds.has(model.id))
      props.completeModelPicker([...found, ...currentOnly])
    } catch (error: unknown) {
      const message = messageOf(error, t('requestFailed'))
      props.failModelPicker(message)
      setFailure(message)
    } finally {
      setFetching(false)
    }
  }

  const discard = (): void => {
    if (source !== undefined) setDraft(source.map(model => ({ ...model })))
    if (snapshot.value !== undefined) setCapabilities(capabilityOf(snapshot.value))
    setFailure(undefined)
    setNotice(undefined)
  }

  const save = async (): Promise<void> => {
    if (draft === undefined || snapshot.value === undefined || capabilities === undefined || invalid) return
    setBusy(true)
    setFailure(undefined)
    setNotice(undefined)
    try {
      const accepted = await props.saveConfiguration({
        ...snapshot.value,
        ...capabilities,
        models: draft.map(modelSettingsOf),
      })
      const next = accepted.settings.models.map(modelDraftOf)
      setSource(next)
      setDraft(next)
      setCapabilities(capabilityOf(accepted.settings))
      setSourceRevision(accepted.revision)
      setNotice(t('saved'))
    } catch (error: unknown) {
      setFailure(messageOf(error, t('requestFailed')))
    } finally {
      setBusy(false)
    }
  }

  const statusLabel = signingIn
    ? t('signingIn')
    : auth.status === 'signed-in'
      ? t('signedIn')
      : auth.status === 'reauth-required'
        ? t('reauthRequired')
        : auth.status === 'error'
          ? auth.message
          : auth.status === 'loading'
            ? t('authLoading')
            : t('signedOut')
  const modelCount = Array.isArray(draft) ? draft.length : snapshot.value?.models?.length
  const headerModels = modelCount === undefined ? '' : t('summaryModels').replace('{count}', String(modelCount))
  // Unknown auth is loading, not signed out: only an authoritative verdict earns On/Off.
  const headerStatus = auth.status === 'signed-in' ? t('summaryOn') : auth.status === 'signed-out' ? t('summaryOff') : auth.status === 'error' ? t('statusFailed') : t('authLoading')
  // The verdict gates the entire header quota, not only the persisted fallback: stale
  // local lastUsage must not look fresh on error or unsupported either. The shared
  // cache supplies the first frame, and only a known sign-out drops the stored entry.
  const quotaUnsupported = auth.status === 'signed-in' && usageUpdatedAt !== undefined && liveQuota === null
  const quotaWithheld = auth.status === 'signed-out' || auth.status === 'reauth-required' || refreshError !== undefined || quotaUnsupported
  const headerQuota: ProviderQuotaState | null = useProviderQuotaCache(CODEX_SETTINGS_NAMESPACE, USAGE_PROVIDER_NAME, liveQuota, {
    answered: authAnswered,
    signedOut: auth.status === 'signed-out' || auth.status === 'reauth-required',
    withheld: quotaWithheld,
  })
  // Both the loading frame and the settled frame carry the meter; a settled query without
  // usable quota shows the unavailable dash instead.
  const quotaProps = providerQuotaHeaderProps(headerQuota, {
    dashLabel: t('usage'),
    settled: auth.status === 'signed-in' && (refreshError !== undefined || usageUpdatedAt !== undefined),
  })

  if (snapshot.status === 'unavailable') {
    return (
      <li style={cardStyle} data-provider-card="" data-provider-role="llm">
        <style>{providerUiCss}</style>
        <button type="button" data-provider-card-header="" aria-expanded={open} onClick={() => { setOpen(!open) }}>
          <ProviderCardHeader title={title} mark={<BrandMark />} summary={headerModels} status={headerStatus} open={open} role="llm" />
        </button>
        {open ? <div style={bodyStyle} data-provider-body=""><p style={statusStyle} role="status">{t('remoteAccess')}</p></div> : null}
      </li>
    )
  }

  if (snapshot.status !== 'ready' || draft === undefined || capabilities === undefined) {
    return (
      <li style={cardStyle} data-provider-card="" data-provider-role="llm">
        <style>{providerUiCss}</style>
        <button type="button" data-provider-card-header="" aria-expanded={open} onClick={() => { setOpen(!open) }}>
          <ProviderCardHeader title={title} mark={<BrandMark />} summary={headerModels} status={headerStatus} open={open} role="llm" {...quotaProps} />
        </button>
        {open ? <div style={bodyStyle} data-provider-body=""><p style={statusStyle}>{t('loading')}</p></div> : null}
      </li>
    )
  }

  // Prototype C pieces, shared by the legacy card and the migrated detail.
  const modelsList = (
    <>
                    <SortableList
                      items={draft}
                      getId={item => item.rowId}
                      disabled={disabled}
                      sorting={modelSort}
                      moveButtons={modelSort}
                      dragLabel={(item, index) => {
                        const label = item.id.trim().length > 0 ? item.id.trim() : String(index + 1)
                        return t('dragModel') + ': ' + label
                      }}
                      moveUpLabel={(item, index) => {
                        const label = item.id.trim().length > 0 ? item.id.trim() : String(index + 1)
                        return t('moveUp') + ': ' + label
                      }}
                      moveDownLabel={(item, index) => {
                        const label = item.id.trim().length > 0 ? item.id.trim() : String(index + 1)
                        return t('moveDown') + ': ' + label
                      }}
                      onReorder={patchDraft}
                      renderItem={(item, index) => {
                        const expanded = expandedModels.has(item.rowId)
                        const label = item.id.trim().length > 0 ? item.id.trim() : String(index + 1)
                        return (
                          <div data-model-row={label} data-provider-model="" style={modelContentStyle}>
                            <input
                              style={rowInputStyle}
                              value={item.id}
                              placeholder={t('modelId')}
                              aria-label={t('modelId') + ' ' + String(index + 1)}
                              disabled={disabled}
                              onChange={(event) => {
                                patchDraft(draft.map((model, at) => at === index ? { ...model, id: event.target.value } : model))
                              }}
                            />
                            <input
                              style={rowInputStyle}
                              value={item.name ?? ''}
                              placeholder={t('modelName')}
                              aria-label={t('modelName') + ' ' + String(index + 1)}
                              disabled={disabled}
                              onChange={(event) => {
                                const name = event.target.value
                                patchDraft(draft.map((model, at) => {
                                  if (at !== index) return model
                                  const next = { ...model }
                                  if (name.length === 0) delete next.name
                                  else next.name = name
                                  return next
                                }))
                              }}
                            />
                            <button
                              type="button"
                              style={iconButtonStyle}
                              aria-label={t('modelDetails') + ': ' + label}
                              aria-expanded={expanded}
                              title={t('modelDetails')}
                              onClick={() => {
                                setExpandedModels((current) => {
                                  const next = new Set(current)
                                  if (!next.delete(item.rowId)) next.add(item.rowId)
                                  return next
                                })
                              }}
                            >
                              <IconChevron open={expanded} />
                            </button>
                            <button
                              type="button"
                              style={iconButtonStyle}
                              disabled={disabled}
                              aria-label={t('remove') + ' ' + label}
                              title={t('remove')}
                              onClick={() => { patchDraft(draft.filter((_, at) => at !== index)) }}
                            >
                              <IconTrash />
                            </button>
                            {expanded
                              ? (
                                <ModelCatalogDetails>
                                  <ModelCatalogRow>
                                    <label style={fieldStyle}>
                                      <span style={labelStyle}>{t('contextWindow')}</span>
                                      <input
                                        style={inputStyle}
                                        inputMode="numeric"
                                        placeholder={officialModelFor(item.id.trim()) === undefined ? t('contextWindowDefault') : undefined}
                                        value={item.contextWindow}
                                        disabled={disabled}
                                        aria-label={t('contextWindow')}
                                        onChange={(event) => {
                                          const contextWindow = event.target.value
                                          patchDraft(draft.map((model, at) => at === index ? { ...model, contextWindow } : model))
                                        }}
                                      />
                                    </label>
                                  </ModelCatalogRow>
                                  <ModelCatalogCapabilities>
                                    <Capability label={t('vision')} checked={item.vision === true} disabled={disabled} onChange={(checked) => {
                                      patchDraft(draft.map((model, at) => at === index ? { ...model, vision: checked } : model))
                                    }} />
                                    <Capability label={t('thinking')} checked={item.thinking === true} disabled={disabled} onChange={(checked) => {
                                      patchDraft(draft.map((model, at) => {
                                        if (at !== index) return model
                                        const next = { ...model, thinking: checked }
                                        if (!checked) delete next.defaultEffort
                                        return next
                                      }))
                                    }} />
                                    {(() => {
                                      const efforts = effortsForCodexModel(modelSettingsOf(item))
                                      if (efforts.length === 0) return null
                                      const suggested = officialModelFor(item.id.trim()) === undefined
                                        ? efforts[0]
                                        : defaultCodexReasoningEffort(item.id.trim())
                                      return (
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...labelStyle }}>
                                          <span style={labelStyle}>{t('defaultEffort')}</span>
                                          <select
                                            style={selectStyle}
                                            value={item.defaultEffort ?? suggested ?? ''}
                                            disabled={disabled}
                                            aria-label={t('defaultEffort')}
                                            onChange={(event) => {
                                              const effort = efforts.find(entry => entry === event.target.value)
                                              patchDraft(draft.map((model, at) => {
                                                if (at !== index) return model
                                                const next = { ...model }
                                                if (effort === undefined) delete next.defaultEffort
                                                else next.defaultEffort = effort
                                                return next
                                              }))
                                            }}
                                          >
                                            {efforts.map(effort => (
                                              <option key={effort} value={effort}>{CODEX_EFFORT_LABELS[effort] ?? effort}</option>
                                            ))}
                                          </select>
                                        </label>
                                      )
                                    })()}
                                  </ModelCatalogCapabilities>
                                </ModelCatalogDetails>
                              )
                              : null}
                          </div>
                        )
                      }}
                    />
                    <button
                      type="button"
                      style={{ ...buttonStyle, alignSelf: 'flex-start' }}
                      disabled={disabled}
                      onClick={() => {
                        const model = modelDraftOf({ id: '', name: '' })
                        patchDraft([...draft, model])
                        setExpandedModels(current => new Set(current).add(model.rowId))
                      }}
                    >
                      {t('addModel')}
                    </button>
    </>
  )
  const authChallengeBlock = (
    <>
              {authChallenge !== undefined
                ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {authChallenge.userCode === undefined
                        ? null
                        : <><p style={hintStyle}>{t('deviceInstructions')}</p><DeviceCodeRow key={authChallenge.userCode} code={authChallenge.userCode} t={t} /></>}
                      {authChallenge.verificationUri === undefined
                        ? authChallenge.url === undefined ? null : <a href={authChallenge.url} target="_blank" rel="noreferrer">{t('openChatGPT')}</a>
                        : <a href={authChallenge.verificationUri} target="_blank" rel="noreferrer">{t('openDevicePage')}</a>}
                    </div>
                  )
                : null}
    </>
  )
  const capabilitiesSection = (
            <section style={sectionStyle}>
              <h3 style={sectionTitleStyle}>{t('capabilities')}</h3>
              <p style={hintStyle}>{t('capabilitiesIntro')}</p>
              <Capability
                label={t('enableSearch')}
                checked={capabilities.enableSearch}
                disabled={disabled}
                onChange={(checked) => { setCapabilities({ ...capabilities, enableSearch: checked }); setNotice(undefined) }}
              />
              <p style={hintStyle}>{t('enableSearchHelp')}</p>
              {capabilities.enableSearch
                ? (
                  <>
                    <label style={labelStyle}>
                      {t('searchModel')}
                      <select
                        style={inputStyle}
                        value={capabilities.searchModel}
                        disabled={disabled}
                        onChange={(event) => { setCapabilities({ ...capabilities, searchModel: event.target.value }); setNotice(undefined) }}
                      >
                        {CODEX_OFFICIAL_MODELS.map(model => (
                          <option key={model.id} value={model.id}>{model.name}</option>
                        ))}
                      </select>
                    </label>
                    <label style={labelStyle}>
                      {t('searchMode')}
                      <select
                        style={inputStyle}
                        value={capabilities.searchMode}
                        disabled={disabled}
                        onChange={(event) => {
                          setCapabilities({ ...capabilities, searchMode: event.target.value as CodexSearchMode })
                          setNotice(undefined)
                        }}
                      >
                        <option value="cached">{t('modeCached')}</option>
                        <option value="indexed">{t('modeIndexed')}</option>
                        <option value="live">{t('modeLive')}</option>
                      </select>
                    </label>
                    <label style={labelStyle}>
                      {t('searchContextSize')}
                      <select
                        style={inputStyle}
                        value={capabilities.searchContextSize}
                        disabled={disabled}
                        onChange={(event) => {
                          setCapabilities({ ...capabilities, searchContextSize: event.target.value as CodexSearchContextSize })
                          setNotice(undefined)
                        }}
                      >
                        <option value="low">{t('contextLow')}</option>
                        <option value="medium">{t('contextMedium')}</option>
                        <option value="high">{t('contextHigh')}</option>
                      </select>
                    </label>
                    <label style={labelStyle}>
                      {t('searchMaxOutputTokens')}
                      <input
                        style={inputStyle}
                        type="number"
                        min={1}
                        step={1}
                        value={capabilities.searchMaxOutputTokens}
                        disabled={disabled}
                        onChange={(event) => {
                          setCapabilities({ ...capabilities, searchMaxOutputTokens: Number(event.target.value) })
                          setNotice(undefined)
                        }}
                      />
                    </label>
                  </>
                )
                : null}
              <Capability
                label={t('enableImageTool')}
                checked={capabilities.enableImageTool}
                disabled={disabled}
                onChange={(checked) => { setCapabilities({ ...capabilities, enableImageTool: checked }); setNotice(undefined) }}
              />
              <p style={hintStyle}>{t('enableImageToolHelp')}</p>
              <Capability
                label={t('enableImageGeneration')}
                checked={capabilities.enableImageGeneration}
                disabled={disabled}
                onChange={(checked) => { setCapabilities({ ...capabilities, enableImageGeneration: checked }); setNotice(undefined) }}
              />
              <p style={hintStyle}>{t('enableImageGenerationHelp')}</p>
              {capabilities.enableImageGeneration
                ? (
                  <label style={labelStyle}>
                    {t('imageGenerationModel')}
                    <select
                      style={inputStyle}
                      value={capabilities.imageGenerationModel}
                      disabled={disabled}
                      onChange={(event) => { setCapabilities({ ...capabilities, imageGenerationModel: event.target.value }); setNotice(undefined) }}
                    >
                      {imageGenerationPickerModels(capabilities.imageGenerationModel).map(model => (
                        <option key={model.id} value={model.id}>{model.name}</option>
                      ))}
                    </select>
                  </label>
                )
                : null}
            </section>
  )
  const draftBlock = (
    <>
            {invalidModels ? <p style={errorStyle}>{t('invalidModel')}</p> : null}
            {invalidCaps && capabilities.searchModel.trim().length === 0 ? <p style={errorStyle}>{t('invalidSearchModel')}</p> : null}
            {invalidCaps && capabilities.imageGenerationModel.trim().length === 0 ? <p style={errorStyle}>{t('invalidImageGenerationModel')}</p> : null}
            {invalidCaps && capabilities.searchModel.trim().length > 0 && capabilities.imageGenerationModel.trim().length > 0 ? <p style={errorStyle}>{t('invalidSearchTokens')}</p> : null}
            {failure !== undefined ? <p style={errorStyle}>{failure}</p> : null}
            {notice !== undefined ? <p style={hintStyle}>{notice}</p> : null}
            <div style={actionsStyle}>
              <button type="button" style={buttonStyle} disabled={disabled || !dirty} onClick={discard}>{t('discard')}</button>
              <button type="button" style={primaryButtonStyle} disabled={disabled || !dirty || invalid} onClick={() => { void save() }}>
                {busy ? t('saving') : t('save')}
              </button>
            </div>
    </>
  )


  // Prototype C detail: the shared template owns the layout, this card owns Codex's data.
  if (props.mode === 'detail') {
    const accountActions = auth.status === 'signed-in'
      ? <button type="button" style={buttonStyle} disabled={authBusy} onClick={() => { void onSignOut() }}>{t('signOut')}</button>
      : auth.status === 'loading'
        ? null
        : auth.status === 'signing-in'
          ? <button type="button" style={buttonStyle} disabled={authBusy} onClick={() => { void onCancelAuth() }}>{t('cancel')}</button>
          : (
              <button type="button" style={primaryButtonStyle} disabled={authBusy} onClick={() => { void onSignIn() }}>
                {auth.status === 'error' || auth.status === 'reauth-required' ? t('signInAgain') : t('signIn')}
              </button>
            )
    return (
      <li style={cardStyle} data-provider-card="" data-provider-role="llm">
        <ProviderDetail
          name={title}
          role="llm"
          copy={props.copy ?? providerDetailCopy.en}
          notice={t('description')}
          account={{
            state: auth.status === 'signed-in' ? 'connected' : 'unconnected',
            label: statusLabel,
            actions: accountActions,
            ...(authChallenge === undefined ? {} : { body: authChallengeBlock }),
          }}
          quota={{
            status: props.usage?.status ?? 'loading',
            windows: props.usage?.windows ?? [],
            ...(props.onRefresh === undefined ? {} : { onRefresh: props.onRefresh }),
          }}
          models={{
            count: modelCount ?? 0,
            allOpen: catalogOpen,
            onToggleAll: () => { setCatalogOpen(value => !value) },
            sorting: modelSort,
            onToggleSorting: () => { setModelSort(current => !current) },
            onChooseFromAccount: () => { void chooseFromOfficial() },
            chooseDisabled: disabled || fetching,
            list: modelsList,
          }}
          advanced={capabilitiesSection}
          draft={draftBlock}
        />
      </li>
    )
  }

  return (
    <li style={cardStyle} data-provider-card="" data-provider-role="llm">
      <style>{providerUiCss}</style>
      <button type="button" data-provider-card-header="" aria-expanded={open} onClick={() => { setOpen(!open) }}>
        <ProviderCardHeader
          title={title}
          mark={<BrandMark />}
          summary={headerModels}
          status={headerStatus}
          open={open}
          unsaved={dirty}
          unsavedLabel={t('unsaved')}
          role="llm"
          {...quotaProps}
        />
      </button>
      {open
        ? (
          <div style={bodyStyle} data-provider-body="">
            <p style={hintStyle}>{t('description')}</p>
            <section style={sectionStyle}>
              <AuthToolbar
                status={<p style={{ ...statusStyle, margin: 0 }} role="status">{statusLabel}</p>}
                action={auth.status === 'signed-in'
                  ? <button type="button" style={buttonStyle} disabled={authBusy} onClick={() => { void onSignOut() }}>{t('signOut')}</button>
                  : auth.status === 'loading'
                    ? null
                    : auth.status === 'signing-in'
                      ? <button type="button" style={buttonStyle} disabled={authBusy} onClick={() => { void onCancelAuth() }}>{t('cancel')}</button>
                      : <button type="button" style={primaryButtonStyle} disabled={authBusy} onClick={() => { void onSignIn() }}>
                          {auth.status === 'error' || auth.status === 'reauth-required' ? t('signInAgain') : t('signIn')}
                        </button>}
              />
              {auth.status === 'error' || auth.status === 'reauth-required'
                ? <p style={errorStyle}>{auth.message}</p>
                : null}
              {authChallenge === undefined ? null : authChallengeBlock}
              {auth.status === 'signed-in' || auth.status === 'loading'
                ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <UsageHeader
                      title={t('usage')}
                      spinning={auth.status === 'loading' || quotaRefreshing}
                      disabled={auth.status === 'loading' || quotaRefreshing}
                      refreshLabel={t('usageRefresh')}
                      busyLabel={t('usageLoading')}
                      {...refreshError === undefined ? {} : { error: refreshError }}
                      onRefresh={() => { void refreshAuth(undefined, true) }}
                    />
                    {(() => {
                      if (quotaRefreshing || auth.status === 'loading') {
                        const known = lastUsage?.rateLimits.reduce((count, limit) => count + limit.windows.length, 0) ?? 0
                        return <UsageSkeleton rows={known > 0 ? known : 2} />
                      }
                      const usageView = auth.status === 'signed-in' ? auth.usage : lastUsage
                      return usageView === undefined
                        ? <UsageSkeleton rows={2} />
                        : <UsageLimits usage={usageView} t={t} />
                    })()}
                    <UsageUpdatedAt
                      at={usageUpdatedAt}
                      label={usageUpdatedAt === undefined ? '' : t('usageUpdatedAt').replace('{time}', formatUsageClock(usageUpdatedAt))}
                    />
                  </div>
                )
                : null}
            </section>

            <section style={sectionStyle} aria-label={t('models')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <button
                  type="button"
                  style={disclosureStyle}
                  aria-expanded={catalogOpen}
                  aria-label={t('models')}
                  onClick={() => { setCatalogOpen(!catalogOpen) }}
                >
                  <IconChevron open={catalogOpen} />
                  <span style={sectionTitleStyle}>{t('models')}</span>
                  <span style={hintStyle}>{customModels ? t('customized') : t('inherited')}</span>
                </button>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: 'none' }}>
                  <button type="button" style={buttonStyle} disabled={disabled} onClick={() => { setModelSort(current => !current) }} aria-pressed={modelSort}>
                    {modelSort ? t('doneSorting') : t('sortModels')}
                  </button>
                  <button type="button" style={buttonStyle} disabled={disabled || fetching} onClick={() => { void chooseFromOfficial() }}>
                    {fetching ? t('fetchingModels') : t('fetchModels')}
                  </button>
                </span>
              </div>
              {catalogOpen ? modelsList : null}
            </section>

            {capabilitiesSection}

            {draftBlock}
          </div>
        )
        : null}
    </li>
  )
}
