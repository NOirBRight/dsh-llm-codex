/** Frame-level model selection overlay opened by the Codex settings card. */

import { useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { CodexCatalogModel } from '../catalog.ts'
import type { CodexSettingsKey } from './locales.ts'

/** Immutable observable state consumed by the shell overlay. */
export interface CodexModelPickerSnapshot {
  /** Whether the overlay is visible. */
  open: boolean
  /** Whether model metadata is still loading. */
  loading: boolean
  /** Candidates in provider order. */
  candidates: readonly CodexCatalogModel[]
  /** IDs selected for adoption. */
  picked: ReadonlySet<string>
  /** Visible discovery failure, when loading did not complete. */
  error?: string
}

type Listener = () => void
type Adopt = (models: readonly CodexCatalogModel[]) => void

/** Shared observable joining the settings card to its frame-level overlay. */
export class CodexModelPickerController {
  private snapshot: CodexModelPickerSnapshot = {
    open: false,
    loading: false,
    candidates: [],
    picked: new Set(),
  }
  private readonly listeners = new Set<Listener>()
  private onAdopt: Adopt | undefined

  /** Read the stable snapshot identity until picker state changes. */
  getSnapshot = (): CodexModelPickerSnapshot => this.snapshot

  /** Subscribe one renderer listener. */
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Open immediately while discovery loads with the current selection captured. */
  begin(onAdopt: Adopt, initiallyPicked: ReadonlySet<string> = new Set()): void {
    this.onAdopt = onAdopt
    this.publish({ open: true, loading: true, candidates: [], picked: new Set(initiallyPicked) })
  }

  /** Populate an open loading picker, retaining only current ids present in the result. */
  complete(candidates: readonly CodexCatalogModel[]): void {
    if (!this.snapshot.open || !this.snapshot.loading) return
    const candidateIds = new Set(candidates.map(model => model.id))
    this.publish({
      open: true,
      loading: false,
      candidates: [...candidates],
      picked: new Set([...this.snapshot.picked].filter(id => candidateIds.has(id))),
    })
  }

  /** Keep the open picker visible with a discovery failure. */
  fail(message: string): void {
    if (!this.snapshot.open || !this.snapshot.loading) return
    this.publish({ open: true, loading: false, candidates: [], picked: new Set(), error: message })
  }

  /** Close without adopting any candidate. */
  close = (): void => {
    this.onAdopt = undefined
    this.publish({ open: false, loading: false, candidates: [], picked: new Set() })
  }

  /** Toggle one candidate by id. */
  toggle = (id: string): void => {
    const picked = new Set(this.snapshot.picked)
    if (picked.has(id)) picked.delete(id)
    else picked.add(id)
    this.publish({ ...this.snapshot, picked })
  }

  /** Close and deliver the selected candidates to the card. */
  adopt = (): void => {
    if (this.snapshot.loading || this.snapshot.error !== undefined) return
    const callback = this.onAdopt
    const selected = this.snapshot.candidates.filter(model => this.snapshot.picked.has(model.id))
    this.close()
    callback?.(selected)
  }

  private publish(snapshot: CodexModelPickerSnapshot): void {
    this.snapshot = snapshot
    for (const listener of this.listeners) listener()
  }
}

/** Values contributed to the shell overlay entry. */
export interface CodexModelPickerFace {
  /** Localized picker copy. */
  t: (key: CodexSettingsKey) => string
  hooks: {
    /** Reactive picker state. */
    codexModelPicker: CodexModelPickerController
  }
  /** Close without adoption. */
  closePicker: () => void
  /** Toggle one model id. */
  togglePickerModel: (id: string) => void
  /** Adopt the selected models. */
  adoptPickerModels: () => void
}

/** Props delivered by the frame overlay slot. */
export type CodexModelPickerProps = PropsRuntime<'shell.overlay'> & InjectFace<CodexModelPickerFace>

const rootStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  padding: 24,
}
const maskStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'var(--dsw-alias-bg-mask-1)',
  backdropFilter: 'var(--dsw-mask-blur)',
}
const dialogStyle: CSSProperties = {
  position: 'relative',
  fontFamily: 'var(--dsw-font-family)',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  width: 'min(520px, 100%)',
  maxHeight: 'min(680px, calc(100vh - 48px))',
  overflow: 'hidden',
  border: '1px solid var(--dsw-alias-border-inverted)',
  borderRadius: 24,
  background: 'var(--dsw-alias-bg-layer-2)',
  boxShadow: 'var(--dsw-shadow-lv3)',
  color: 'var(--dsw-alias-label-primary)',
}
const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '22px 14px 12px 24px',
}
const titleStyle: CSSProperties = { margin: 0, fontSize: 16, lineHeight: '24px', fontWeight: 500 }
const closeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  border: 0,
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--dsw-alias-label-secondary)',
  cursor: 'pointer',
  fontSize: 22,
}
const descriptionStyle: CSSProperties = {
  margin: 0,
  padding: '0 24px',
  fontSize: 14,
  lineHeight: '22px',
  color: 'var(--dsw-alias-label-primary)',
}
const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  minHeight: 0,
  margin: '20px 24px',
  padding: 0,
  overflowY: 'auto',
  listStyle: 'none',
}
const pickerCheckboxStyle: CSSProperties = {
  accentColor: 'var(--dsw-alias-brand-primary)',
}
const candidateStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 14,
  lineHeight: '22px',
  cursor: 'pointer',
}
const statusStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  minHeight: 96,
  margin: '20px 24px',
  fontSize: 14,
  lineHeight: '22px',
  color: 'var(--dsw-alias-label-secondary)',
}
const errorStyle: CSSProperties = {
  ...statusStyle,
  color: 'var(--dsw-alias-state-error-primary)',
}
const footerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '0 24px 24px',
}
const outlineButtonStyle: CSSProperties = {
  height: 36,
  padding: '0 14px',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 18,
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary)',
  cursor: 'pointer',
  fontSize: 14,
}

/** Render the Codex official-catalog picker in the frame overlay layer. */
export function CodexModelPicker(props: CodexModelPickerProps): ReactNode {
  const { t } = props
  const snapshot = props.useCodexModelPicker(value => value)
  useEffect(() => {
    if (!snapshot.open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') props.closePicker()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [snapshot.open, props.closePicker])

  if (!snapshot.open) return null
  return createPortal((
    <div style={rootStyle} role="presentation">
      <div style={maskStyle} aria-hidden="true" onClick={props.closePicker} />
      <section
        style={dialogStyle}
        role="dialog"
        aria-modal="true"
        aria-label={t('pickerTitle')}
        aria-busy={snapshot.loading}
      >
        <div style={headerStyle}>
          <h2 style={titleStyle}>{t('pickerTitle')}</h2>
          <button type="button" style={closeStyle} aria-label={t('close')} onClick={props.closePicker}>×</button>
        </div>
        <p style={descriptionStyle}>{t('pickerDescription')}</p>
        {snapshot.loading
          ? <p style={statusStyle} role="status">{t('pickerLoading')}</p>
          : snapshot.error !== undefined
            ? <p style={errorStyle} role="alert">{snapshot.error}</p>
            : (
              <ul style={listStyle}>
                {snapshot.candidates.map(model => (
                  <li key={model.id}>
                    <label style={candidateStyle}>
                      <input
                        type="checkbox"
                        style={pickerCheckboxStyle}
                        checked={snapshot.picked.has(model.id)}
                        onChange={() => { props.togglePickerModel(model.id) }}
                      />
                      <span>{model.id}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
        <div style={footerStyle}>
          <button type="button" style={outlineButtonStyle} onClick={props.closePicker}>{t('cancel')}</button>
          <button
            type="button"
            style={{
              ...outlineButtonStyle,
              ...(snapshot.loading || snapshot.error !== undefined
                ? { cursor: 'not-allowed', opacity: 0.4 }
                : {}),
            }}
            disabled={snapshot.loading || snapshot.error !== undefined}
            onClick={props.adoptPickerModels}
          >
            {t('applySelected')}
          </button>
        </div>
      </section>
    </div>
  ), document.body)
}