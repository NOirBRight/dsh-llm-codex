import type { AuthContext, Credential, CredentialInfo, CredentialStore } from '@earendil-works/pi-ai'

/** Auth inputs required by RC1 and structurally accepted by older adapters. */
interface PiAiAuthInjection {
  credentials: CredentialStore
  authContext: AuthContext
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
export function createPiAiAuth(): PiAiAuthInjection {
  const stored = new Map<string, Credential>()
  const credentials: CredentialStore = {
    /** Read a credential by pi-ai provider id. */
    read: async providerId => stored.get(providerId),
    /** List non-secret metadata for stored provider credentials. */
    list: async (): Promise<readonly CredentialInfo[]> => [...stored].map(([providerId, credential]) => ({
      providerId,
      type: credential.type,
    })),
    /** Apply a serialized in-memory credential update. */
    async modify(providerId, mutate) {
      const next = await mutate(stored.get(providerId))
      if (next !== undefined) stored.set(providerId, next)
      return stored.get(providerId)
    },
    /** Remove a credential by pi-ai provider id. */
    async delete(providerId): Promise<void> {
      stored.delete(providerId)
    },
  }
  return {
    credentials,
    authContext: {
      /** Ambient environment variables are intentionally unavailable. */
      async env(): Promise<string | undefined> {
        return undefined
      },
      /** Ambient filesystem credential sources are intentionally unavailable. */
      async fileExists(): Promise<boolean> {
        return false
      },
    },
  }
}
