export type ClientContext = import('@deepseek-ai/cordis').Context & { settingsScope: { bind<T>(spec: any): SettingsScope<T> }, locale: any, slots: any, get: (id: string) => any } & Record<string, any>;
export interface SettingsScopeSnapshot<T> {
  status: 'loading' | 'ready' | 'unavailable';
  value: T | undefined;
  base: unknown;
  user: unknown;
  revision: number | undefined;
  writable: boolean;
  mode: 'host' | 'memory';
}
export interface SettingsScope<T> {
  getSnapshot(): SettingsScopeSnapshot<T>;
  subscribe(listener: () => void): () => void;
  set(field: string, value: unknown): Promise<void>;
  unset(field: string): Promise<void>;
}
