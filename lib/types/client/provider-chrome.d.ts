/** Shared Providers chrome: official DSH glyphs, auth row, chart skeleton. */
import type { ReactNode } from 'react';
/** Account status on the left, sign-in / sign-out on the right. */
export declare function AuthToolbar(props: {
    status: ReactNode;
    action: ReactNode;
}): ReactNode;
/** Official `ic_ds_refresh_outline_14` glyph; spins while refreshing. */
export declare function RefreshIcon(props: {
    spinning?: boolean;
}): ReactNode;
/** Icon-only refresh control used by every provider usage block. */
export declare function UsageRefreshButton(props: {
    spinning: boolean;
    disabled?: boolean;
    label: string;
    busyLabel: string;
    onClick: () => void;
}): ReactNode;
/** Quota chart skeleton: same 14px tracks as live bars, with a moving sheen. */
export declare function UsageSkeleton(props: {
    rows?: number;
}): ReactNode;
/**
 * Title + official refresh glyph used above usage bars.
 * @param props.title - localized usage heading.
 * @param props.spinning - whether a refresh is in flight.
 * @param props.disabled - when true, the refresh button is inert.
 * @param props.refreshLabel - idle aria-label.
 * @param props.busyLabel - aria-label while spinning.
 * @param props.onRefresh - fetch handler.
 * @param props.error - short failure hint shown left of the button.
 * @returns the usage block heading row.
 */
export declare function UsageHeader(props: {
    title: ReactNode;
    spinning: boolean;
    disabled?: boolean;
    refreshLabel: string;
    busyLabel: string;
    onRefresh: () => void;
    error?: string;
}): ReactNode;
/** Format a usage stamp as a compact local clock, e.g. "12:04". */
export declare function formatUsageClock(at: Date): string;
/** Official grok.com form: 2026年8月20日 11:35. English stays a short local datetime. */
export declare function formatResetStamp(iso: string, locales?: string | readonly string[]): string;
/** Official Cursor form: Sep 16 / 9月16日. */
export declare function formatResetDate(iso: string, locales?: string | readonly string[]): string;
/** Whole days until reset when at least one day remains; otherwise the datetime form is used. */
export declare function remainingResetDays(iso: string, now?: number): number | undefined;
/** Localized reset line matching official dashboards. */
export declare function resetLabelOf(iso: string | undefined, copy: {
    at: string;
    atDays: string;
}, now?: number): string | undefined;
/** Official-style reset caption under a usage bar. */
export declare function UsageResetAt(props: {
    label: string | undefined;
}): ReactNode;
/**
 * Last successful usage read, right-aligned under the bars.
 * @param props.at - when the last successful snapshot arrived.
 * @param props.label - already-localized "12:04 已更新".
 * @returns the stamp, or nothing before the first success.
 */
export declare function UsageUpdatedAt(props: {
    at: Date | undefined;
    label: string;
}): ReactNode;
/** Shared selected-A header: monochrome role badge plus segmented remaining-quota meter.
 * Re-exported from the built dsh-llm-providers-ui/provider-ui artifact; this
 * module keeps the local auth/usage helpers that are not part of the shared API.
 */
export { ProviderCardHeader, ProviderQuotaMeter, normalizeQuotaRemaining, providerUiCss, } from 'dsh-llm-providers-ui/provider-ui';
export type { ProviderCardHeaderProps, ProviderCardRole, ProviderQuotaMeterProps, ProviderQuotaState, } from 'dsh-llm-providers-ui/provider-ui';
//# sourceMappingURL=provider-chrome.d.ts.map