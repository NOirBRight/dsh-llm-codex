/** Settings > 供应商 page shell. Provider cards arrive through settings.provider.item. */
import type { ReactNode } from 'react';
interface ProvidersSectionProps {
    renderSlot?: (name: string, slotProps: object, opts?: {
        entryKey?: string;
    }) => ReactNode;
    t?: (key: 'title' | 'subtitle' | 'empty') => string;
    /** Live keyed contributions; preferred order first, unknown plugins append. */
    registeredKeys?: readonly string[];
}
/** Stable known order, then any keyed card the owner did not know about. */
export declare function orderedProviderItemKeys(registeredKeys?: readonly string[]): string[];
/** Bind the shared page to the live keyed-slot ledger so new plugins appear without a whitelist bump. */
export declare function bindProvidersSection(listRegisteredKeys: () => readonly string[], subscribe?: (listener: () => void) => (() => void) | undefined): (props: ProvidersSectionProps) => ReactNode;
/** Render installed provider cards. Unknown plugins append after the preferred order. */
export declare function ProvidersSection(props: ProvidersSectionProps): ReactNode;
export {};
//# sourceMappingURL=ProvidersSection.d.ts.map