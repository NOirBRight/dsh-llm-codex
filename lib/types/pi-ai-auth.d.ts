import type { AuthContext, CredentialStore } from '@earendil-works/pi-ai';
/** Auth inputs required by RC1 and structurally accepted by older adapters. */
interface PiAiAuthInjection {
    credentials: CredentialStore;
    authContext: AuthContext;
}
/**
 * Build isolated pi-ai auth inputs for the adapter's request collections.
 *
 * The adapter resolves the Codex access token through its durable plugin-owned
 * store and supplies it as the request API key. This collection store therefore
 * only satisfies pi-ai's required auth injection without creating another
 * durable credential path; its records live for this adapter instance only.
 * Ambient provider lookups deliberately find nothing.
 *
 * @returns an in-memory credential store and an empty ambient auth context.
 */
export declare function createPiAiAuth(): PiAiAuthInjection;
export {};
//# sourceMappingURL=pi-ai-auth.d.ts.map