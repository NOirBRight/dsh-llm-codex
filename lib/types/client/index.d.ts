/** Browser half: Codex setup inside Plugin configuration. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import type { CodexSettingsKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Codex Plugin configuration copy. */
        'settings.codex': CodexSettingsKey;
    }
}
export declare const name = "dsh-llm-codex-client";
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map