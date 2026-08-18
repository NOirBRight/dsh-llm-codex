/** Settings > 供应商 page shell. Provider cards arrive through settings.provider.item. */
import type { ReactNode } from 'react';
interface ProvidersSectionProps {
    renderSlot?: (name: string, slotProps: object, opts?: {
        entryKey?: string;
    }) => ReactNode;
    t?: (key: 'title' | 'subtitle' | 'empty') => string;
}
/**
 * Render the shared providers page. Missing keys stay empty so an uninstalled
 * plugin does not occupy space; when every provider plugin is gone the section
 * registration itself is disposed and this page unmounts.
 */
export declare function ProvidersSection(props: ProvidersSectionProps): ReactNode;
export {};
//# sourceMappingURL=ProvidersSection.d.ts.map