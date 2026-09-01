import type { Context } from '@deepseek-ai/cordis';
import type { ModelSwitchAdapterRegistry } from 'dsh-model-switch/adapter-registry';
import type { CodexSearchContextSize, CodexSearchMode } from './client-contract.ts';
import type { CodexCredentialStore } from './store.ts';
interface CodexModelSwitchSettings {
    readonly searchMode: CodexSearchMode;
    readonly searchContextSize: CodexSearchContextSize;
    readonly searchMaxOutputTokens: number;
    readonly models: readonly {
        readonly id: string;
        readonly tools?: boolean;
        readonly vision?: boolean;
    }[];
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        modelSwitch: {
            readonly adapters: ModelSwitchAdapterRegistry;
        };
    }
}
/** Optional Search/Image integration; standalone Codex behavior is unchanged when Model Switch is absent. */
export declare function installCodexModelSwitchAdapters(ctx: Context, credentials: CodexCredentialStore, settings: () => CodexModelSwitchSettings | undefined, options?: {
    readonly searchAvailable?: () => boolean;
}): void;
export {};
//# sourceMappingURL=model-switch-adapter.d.ts.map