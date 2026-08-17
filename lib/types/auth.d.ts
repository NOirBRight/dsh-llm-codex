/** ChatGPT OAuth orchestration shared by the plugin Host. */
import type { AuthInteraction } from '@earendil-works/pi-ai';
import { CodexCredentialStore } from './store.ts';
/** Non-secret login state shown by the launcher. */
export interface CodexAuthStatus {
    authenticated: boolean;
    expiresAt?: Date;
}
/** Complete provider-native OAuth and persist the resulting credential. */
export declare function loginCodex(interaction: AuthInteraction, store?: CodexCredentialStore): Promise<void>;
/** Remove the stored Codex credential. */
export declare function logoutCodex(store?: CodexCredentialStore): Promise<void>;
/** Read non-secret login state without refreshing the token. */
export declare function codexAuthStatus(store?: CodexCredentialStore): Promise<CodexAuthStatus>;
//# sourceMappingURL=auth.d.ts.map