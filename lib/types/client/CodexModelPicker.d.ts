/** Frame-level model selection overlay opened by the Codex settings card. */
import type { ReactNode } from 'react';
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { CodexCatalogModel } from '../catalog.ts';
import type { CodexSettingsKey } from './locales.ts';
/** Immutable observable state consumed by the shell overlay. */
export interface CodexModelPickerSnapshot {
    /** Whether the overlay is visible. */
    open: boolean;
    /** Whether model metadata is still loading. */
    loading: boolean;
    /** Candidates in provider order. */
    candidates: readonly CodexCatalogModel[];
    /** IDs selected for adoption. */
    picked: ReadonlySet<string>;
    /** Visible discovery failure, when loading did not complete. */
    error?: string;
}
type Listener = () => void;
type Adopt = (models: readonly CodexCatalogModel[]) => void;
/** Shared observable joining the settings card to its frame-level overlay. */
export declare class CodexModelPickerController {
    private snapshot;
    private readonly listeners;
    private onAdopt;
    /** Read the stable snapshot identity until picker state changes. */
    getSnapshot: () => CodexModelPickerSnapshot;
    /** Subscribe one renderer listener. */
    subscribe: (listener: Listener) => (() => void);
    /** Open immediately while discovery loads with the current selection captured. */
    begin(onAdopt: Adopt, initiallyPicked?: ReadonlySet<string>): void;
    /** Populate an open loading picker, retaining only current ids present in the result. */
    complete(candidates: readonly CodexCatalogModel[]): void;
    /** Keep the open picker visible with a discovery failure. */
    fail(message: string): void;
    /** Close without adopting any candidate. */
    close: () => void;
    /** Toggle one candidate by id. */
    toggle: (id: string) => void;
    /** Close and deliver the selected candidates to the card. */
    adopt: () => void;
    private publish;
}
/** Values contributed to the shell overlay entry. */
export interface CodexModelPickerFace {
    /** Localized picker copy. */
    t: (key: CodexSettingsKey) => string;
    hooks: {
        /** Reactive picker state. */
        codexModelPicker: CodexModelPickerController;
    };
    /** Close without adoption. */
    closePicker: () => void;
    /** Toggle one model id. */
    togglePickerModel: (id: string) => void;
    /** Adopt the selected models. */
    adoptPickerModels: () => void;
}
/** Props delivered by the frame overlay slot. */
export type CodexModelPickerProps = PropsRuntime<'shell.overlay'> & InjectFace<CodexModelPickerFace>;
/** Render the Codex official-catalog picker in the frame overlay layer. */
export declare function CodexModelPicker(props: CodexModelPickerProps): ReactNode;
export {};
//# sourceMappingURL=CodexModelPicker.d.ts.map