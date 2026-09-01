export type { Context as ClientContext } from '@deepseek-ai/cordis';
/** Settings snapshot fields shared by published RC and alpha1 client APIs. */
export interface SettingsScopeSnapshot<T> {
    status: 'loading' | 'ready' | 'unavailable';
    value: T | undefined;
    base: unknown;
    user: unknown;
    revision: number | undefined;
    writable: boolean;
    mode: 'host' | 'memory';
}
/** Settings operations used by this plugin across published RC and alpha1 clients. */
export interface SettingsScope<T> {
    getSnapshot(): SettingsScopeSnapshot<T>;
    subscribe(listener: () => void): () => void;
    set(field: string, value: unknown): Promise<void>;
    unset(field: string): Promise<void>;
}
//# sourceMappingURL=shim.d.ts.map