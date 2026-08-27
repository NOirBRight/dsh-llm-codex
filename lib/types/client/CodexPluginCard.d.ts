/** Codex Plugin configuration card: ChatGPT login, usage, and an editable catalog. */
import type { ReactNode } from 'react';
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client';
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { CodexCatalogModel } from '../catalog.ts';
import type { CodexAccountStatus, CodexSaveResult, CodexSettingsView } from '../client-contract.ts';
import type { CodexSettingsKey } from './locales.ts';
export type { CodexAccountStatus };
export interface CodexPluginCardFace {
    t: (key: CodexSettingsKey) => string;
    hooks: {
        codexSettings: SettingsScope<CodexSettingsView>;
    };
    readAuthStatus: (signal?: AbortSignal) => Promise<CodexAccountStatus>;
    startAuth: () => Promise<{
        url?: string;
        verificationUri?: string;
        userCode?: string;
        expiresAt?: number;
        attemptId?: string;
    }>;
    logout: () => Promise<void>;
    cancelAuth: (attemptId?: string) => Promise<void>;
    readAuthAttemptStatus: (attemptId: string) => Promise<{
        status: 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'missing';
    }>;
    fetchModels: () => Promise<readonly CodexCatalogModel[]>;
    saveConfiguration: (settings: CodexSettingsView) => Promise<CodexSaveResult>;
    beginModelPicker: (initiallyPicked: ReadonlySet<string>, onAdopt: (models: readonly CodexCatalogModel[]) => void) => void;
    completeModelPicker: (candidates: readonly CodexCatalogModel[]) => void;
    failModelPicker: (message: string) => void;
    closeModelPicker: () => void;
}
export type CodexPluginCardProps = PropsRuntime<'settings.provider.item'> & InjectFace<CodexPluginCardFace>;
export declare function CodexPluginCard(props: CodexPluginCardProps): ReactNode;
//# sourceMappingURL=CodexPluginCard.d.ts.map