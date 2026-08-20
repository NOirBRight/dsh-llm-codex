/** ChatGPT account id from a Codex OAuth access JWT. */

const AUTH_CLAIM = 'https://api.openai.com/auth'

/** Read `chatgpt_account_id` from a ChatGPT access token. */
export function chatgptAccountIdFromToken(access: string): string {
  const parts = access.split('.')
  if (parts.length !== 3 || parts[1] === undefined) {
    throw new Error('OpenAI Codex auth token is not a JWT. Sign in again with ChatGPT.')
  }
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>
  } catch {
    throw new Error('OpenAI Codex auth token is not a JWT. Sign in again with ChatGPT.')
  }
  const auth = payload[AUTH_CLAIM]
  if (typeof auth !== 'object' || auth === null || Array.isArray(auth)) {
    throw new Error('OpenAI Codex auth token has no ChatGPT account id. Sign in again with ChatGPT.')
  }
  const accountId = (auth as Record<string, unknown>)['chatgpt_account_id']
  if (typeof accountId !== 'string' || accountId.length === 0) {
    throw new Error('OpenAI Codex auth token has no ChatGPT account id. Sign in again with ChatGPT.')
  }
  return accountId
}
