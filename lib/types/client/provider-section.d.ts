/** Shared Settings > LLM 供应商 section. First installed provider plugin wins the nav row. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export declare const PROVIDERS_SECTION_ID = "providers";
export declare const PROVIDERS_ITEM_SLOT = "settings.provider.item";
export declare const PROVIDERS_LOCALE_NS = "settings.providers";
/** Display order for installed provider cards. Absent plugins render nothing. */
export declare const PROVIDER_ITEM_ORDER: readonly ["llm-cursor", "llm-grok", "llm-codex", "llm-ollama", "llm-commandcode", "llm-opencode-go"];
declare const copy: {
    zh: {
        nav: string;
        title: string;
        subtitle: string;
        empty: string;
    };
    en: {
        nav: string;
        title: string;
        subtitle: string;
        empty: string;
    };
};
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        'settings.provider.item': {
            kind: 'keyed';
            scope: 'root';
        };
    }
    interface LocaleNamespaceMap {
        'settings.providers': keyof typeof copy.en;
    }
}
/**
 * Register the shared LLM 供应商 section when missing. Uninstalling every
 * provider plugin drops the nav row because only they call this helper.
 * @param ctx - browser plugin context (slots + locale).
 */
export declare function ensureProviderSection(ctx: ClientContext): void;
export {};
//# sourceMappingURL=provider-section.d.ts.map