/** ChatGPT OAuth orchestration shared by the plugin Host. */

import { createModels } from '@earendil-works/pi-ai'
import type { AuthInteraction } from '@earendil-works/pi-ai'
import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex'
import { CodexCredentialStore, OPENAI_CODEX_PROVIDER } from './store.ts'

/** Non-secret login state shown by the launcher. */
export interface CodexAuthStatus {
  authenticated: boolean
  expiresAt?: Date
}

/** Complete provider-native OAuth and persist the resulting credential. */
export async function loginCodex(
  interaction: AuthInteraction,
  store: CodexCredentialStore = new CodexCredentialStore(),
): Promise<void> {
  const models = createModels({ credentials: store })
  models.setProvider(openaiCodexProvider())
  await models.login(OPENAI_CODEX_PROVIDER, 'oauth', interaction)
}

/** Remove the stored Codex credential. */
export async function logoutCodex(
  store: CodexCredentialStore = new CodexCredentialStore(),
): Promise<void> {
  await store.delete(OPENAI_CODEX_PROVIDER)
}

/** Read non-secret login state without refreshing the token. */
export async function codexAuthStatus(
  store: CodexCredentialStore = new CodexCredentialStore(),
): Promise<CodexAuthStatus> {
  const credential = await store.read(OPENAI_CODEX_PROVIDER)
  return credential?.type === 'oauth'
    ? { authenticated: true, expiresAt: new Date(credential.expires) }
    : { authenticated: false }
}
