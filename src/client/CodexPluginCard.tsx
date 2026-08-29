/** Codex Plugin configuration card: ChatGPT login, usage, and an editable catalog. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { SettingsScope } from './shim.js'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import {
  CODEX_EFFORT_LABELS,
  CODEX_OFFICIAL_MODELS,
  defaultCodexReasoningEffort,
  effortsForCodexModel,
  officialImageGenerationModels,
  officialModelFor,
} from '../catalog.ts'
import type { CodexCatalogModel } from '../catalog.ts'
import type {
  CodexAccountStatus,
  CodexSaveResult,
  CodexSearchContextSize,
  CodexSearchMode,
  CodexSettingsView,
  CodexUsage,
} from '../client-contract.ts'
import type { CodexSettingsKey } from './locales.ts'
import { BrandMark } from './BrandMark.tsx'
import { AuthToolbar, ProviderCardHeader, UsageHeader, UsageResetAt, UsageSkeleton, UsageUpdatedAt, formatProviderSummary, formatUsageClock, providerHeaderStyle, resetLabelOf } from './provider-chrome.tsx'
import type {} from './provider-section.ts'
import { SortableList } from './SortableList.tsx'
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

interface ModelDraft {
  rowId: string
  id: string
  name?: string
  thinking?: boolean
  vision?: boolean
  defaultEffort?: string
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
const headerStyle = providerHeaderStyle
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
const barTrackStyle: CSSProperties = {
  boxSizing: 'border-box',
  height: 14,
  display: 'flex',
  overflow: 'hidden',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 14%, transparent)',
}

let nextModelRow = 0

function newModelRowId(): string {
  nextModelRow += 1
  return 'codex-model-row-' + String(nextModelRow)
}

function integerOf(text: string): number | undefined {
  const trimmed = text.trim()
  if (trimmed.length === 0) return undefined
  if (!/^[1-9]\d*$/u.test(trimmed)) return Number.NaN
  return Number(trimmed)
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

function formatPercent(percent: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(percent)
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
            const remaining = Math.max(0, Math.min(100, window.remainingPercent))
            const label = windowLabel(window.windowSeconds, t)
            const displayLabel = limit.name === undefined || limit.windows.length === 1
              ? limit.name ?? label
              : limit.name + ' · ' + label
            return (
              <div key={label + String(window.windowSeconds)} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={labelStyle}>{displayLabel}</span>
                  <span style={hintStyle}>{interpolate(t('percentRemaining'), { percent: formatPercent(remaining) })}</span>
                </div>
                <div style={barTrackStyle} role="progressbar" aria-label={displayLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(remaining)}>
                  <span
                    data-usage-fill="true"
                    style={{
                      width: String(remaining) + '%',
                      height: '100%',
                      flex: 'none',
                      background: 'var(--dsw-alias-state-business-primary)',
                      transition: 'width 200ms ease',
                    }}
                  />
                </div>
                <UsageResetAt
                  label={resetLabelOf(window.resetsAt, {
                    at: t('usageResetAt'),
                    atDays: t('usageResetAtDays'),
                  })}
                />
              </div>
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
  const snapshot = props.useCodexSettings(value => value)
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
  const [authChallenge, setAuthChallenge] = useState<{ url?: string; verificationUri?: string; userCode?: string; attemptId?: string } | undefined>()
  const [catalogOpen, setCatalogOpen] = useState(false)
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

  const refreshAuth = useCallback(async (signal?: AbortSignal, spin = false): Promise<void> => {
    if (spin) setQuotaRefreshing(true)
    try {
      const next = await readAuthStatus(signal)
      if (!mounted.current || signal?.aborted === true) return
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
      }
    } catch (error: unknown) {
      if (mounted.current && signal?.aborted !== true) {
        setRefreshError(t('usageRefreshFailed'))
        setAuth(current => current.status === 'signed-in'
          ? current
          : { status: 'error', message: messageOf(error, t('statusFailed')) })
      }
    } finally {
      if (spin && mounted.current) setQuotaRefreshing(false)
    }
  }, [readAuthStatus, t])

  useEffect(() => {
    const controller = new AbortController()
    void refreshAuth(controller.signal)
    return () => { controller.abort() }
  }, [refreshAuth])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void refreshAuth(controller.signal, true)
    return () => { controller.abort() }
  }, [open, refreshAuth])

  useEffect(() => {
    if (!open) return
    const interval = auth.status === 'signing-in' ? 1000 : auth.status === 'signed-in' ? 60_000 : undefined
    if (interval === undefined) return
    const controller = new AbortController()
    const timer = window.setInterval(() => { void refreshAuth(controller.signal) }, interval)
    return () => {
      window.clearInterval(timer)
      controller.abort()
    }
  }, [open, auth.status, refreshAuth])

  useEffect(() => {
    if (!open || auth.status !== 'signing-in' || authChallenge?.attemptId === undefined) return
    const attemptId = authChallenge.attemptId
    let stopped = false
    const poll = async (): Promise<void> => {
      try {
        const result = await readAuthAttemptStatus(attemptId)
        if (stopped || !mounted.current) return
        if (result.status === 'succeeded') { await refreshAuth(); return }
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
  const modelCount = Array.isArray(draft) ? draft.length : (snapshot.value?.models?.length ?? 0)
  const headerSummary = formatProviderSummary(
    auth.status === 'signed-in' ? t('summaryOn') : t('summaryOff'),
    t('summaryModels').replace('{count}', String(modelCount)),
  )

  if (snapshot.status === 'unavailable') {
    return (
      <li style={cardStyle}>
        <button type="button" style={headerStyle} aria-expanded={open} onClick={() => { setOpen(!open) }}>
          <ProviderCardHeader title={title} mark={<BrandMark />} summary={headerSummary} open={open} />
        </button>
        {open ? <div style={bodyStyle}><p style={statusStyle} role="status">{t('remoteAccess')}</p></div> : null}
      </li>
    )
  }

  if (snapshot.status !== 'ready' || draft === undefined || capabilities === undefined) {
    return (
      <li style={cardStyle}>
        <button type="button" style={headerStyle} aria-expanded={open} onClick={() => { setOpen(!open) }}>
          <ProviderCardHeader title={title} mark={<BrandMark />} summary={headerSummary} open={open} />
        </button>
        {open ? <div style={bodyStyle}><p style={statusStyle}>{t('loading')}</p></div> : null}
      </li>
    )
  }

  return (
    <li style={cardStyle}>
      <button type="button" style={headerStyle} aria-expanded={open} onClick={() => { setOpen(!open) }}>
        <ProviderCardHeader
          title={title}
          mark={<BrandMark />}
          summary={headerSummary}
          open={open}
          unsaved={dirty}
          unsavedLabel={t('unsaved')}
        />
      </button>
      {open
        ? (
          <div style={bodyStyle}>
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
                <button type="button" style={buttonStyle} disabled={disabled || fetching} onClick={() => { void chooseFromOfficial() }}>
                  {fetching ? t('fetchingModels') : t('fetchModels')}
                </button>
              </div>
              {catalogOpen
                ? (
                  <>
                    <SortableList
                      items={draft}
                      getId={item => item.rowId}
                      disabled={disabled}
                      dragLabel={(item, index) => {
                        const label = item.id.trim().length > 0 ? item.id.trim() : String(index + 1)
                        return t('dragModel') + ': ' + label
                      }}
                      onReorder={patchDraft}
                      renderItem={(item, index) => {
                        const expanded = expandedModels.has(item.rowId)
                        const label = item.id.trim().length > 0 ? item.id.trim() : String(index + 1)
                        return (
                          <div data-model-row={label} style={modelContentStyle}>
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
                : null}
            </section>

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
          </div>
        )
        : null}
    </li>
  )
}
