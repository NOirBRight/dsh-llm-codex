export type { Context as ClientContext } from '@deepseek-ai/cordis';
/** Settings snapshot returned by the Alpha.4 client settings bridge. */
export interface SettingsScopeSnapshot<T> {
    status: 'loading' | 'ready' | 'unavailable';
    value: T | undefined;
    base: unknown;
    user: unknown;
    revision: number | undefined;
    writable: boolean;
    mode: 'host' | 'memory';
}
/** Settings operations exposed by the Alpha.4 client settings bridge. */
export interface SettingsScope<T> {
    getSnapshot(): SettingsScopeSnapshot<T>;
    subscribe(listener: () => void): () => void;
    set(field: string, value: unknown): Promise<void>;
    unset(field: string): Promise<void>;
}
//# sourceMappingURL=settings-scope.d.ts.map