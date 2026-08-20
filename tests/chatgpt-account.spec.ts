import { describe, expect, it } from 'vitest'
import { chatgptAccountIdFromToken } from '../src/chatgpt-account.ts'

function jwt(payload: Record<string, unknown>): string {
  const header = Buffer.from('{"alg":"none"}').toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return header + '.' + body + '.sig'
}

describe('chatgptAccountIdFromToken', () => {
  it('reads chatgpt_account_id from the OpenAI auth claim', () => {
    expect(chatgptAccountIdFromToken(jwt({
      'https://api.openai.com/auth': { chatgpt_account_id: 'acct_123' },
    }))).toBe('acct_123')
  })

  it('rejects a non-JWT and a token without an account id', () => {
    expect(() => chatgptAccountIdFromToken('not-a-jwt')).toThrow(/not a JWT/)
    expect(() => chatgptAccountIdFromToken(jwt({}))).toThrow(/account id/)
    expect(() => chatgptAccountIdFromToken(jwt({
      'https://api.openai.com/auth': { chatgpt_account_id: '' },
    }))).toThrow(/account id/)
  })
})
