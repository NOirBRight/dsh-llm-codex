/** Same-origin Web settings routes for Codex OAuth. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AuthEvent, AuthPrompt } from '@earendil-works/pi-ai'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { loginCodex, logoutCodex, codexAuthStatus } from './auth.ts'
import type { CodexCredentialStore } from './store.ts'
import {
  isCodexReauthRequiredError,
  CODEX_REAUTH_REQUIRED_MESSAGE,
  readCodexRateLimits,
} from './usage.ts'
import type { CodexUsage } from './usage.ts'
import {
  CODEX_AUTH_LOGIN_PATH,
  CODEX_AUTH_LOGOUT_PATH,
  CODEX_AUTH_STATUS_PATH,
} from './client-contract.ts'

export const CODEX_AUTH_URL_TIMEOUT_MS = 30_000

export type CodexWebAuthStatus =
  | { status: 'signed-out' }
  | { status: 'signing-in' }
  | { status: 'reauth-required'; message: typeof CODEX_REAUTH_REQUIRED_MESSAGE }
  | { status: 'signed-in'; usage: CodexUsage; quotaError?: string }
  | { status: 'error'; message: string }

interface LoginChallenge {
  url: string
}

export interface CodexWebAuthOptions {
  challengeTimeoutMs?: number
}

function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, '[redacted token]')
    .replace(/(\b(?:code|token|refresh_token|access_token)=)[^&\s]+/giu, '$1[redacted]')
    .slice(0, 1000)
}

function waitForPromptAbort(prompt: AuthPrompt): Promise<string> {
  const signal = prompt.signal
  if (signal === undefined) return new Promise<string>(() => {})
  if (signal.aborted) return Promise.reject(signal.reason)
  return new Promise<string>((_resolve, reject) => {
    signal.addEventListener('abort', () => { reject(signal.reason) }, { once: true })
  })
}

export class CodexWebAuth {
  private state: CodexWebAuthStatus = { status: 'signed-out' }
  private operation: Promise<void> | undefined
  private cancellation: AbortController | undefined
  private challenge: LoginChallenge | undefined
  private challengeWaiters: Array<{ resolve(value: LoginChallenge): void; reject(error: unknown): void }> = []
  private challengeTimer: ReturnType<typeof setTimeout> | undefined
  private readonly challengeTimeoutMs: number

  constructor(
    private readonly store: CodexCredentialStore,
    options: CodexWebAuthOptions = {},
  ) {
    this.challengeTimeoutMs = options.challengeTimeoutMs ?? CODEX_AUTH_URL_TIMEOUT_MS
    if (!Number.isFinite(this.challengeTimeoutMs) || this.challengeTimeoutMs <= 0) {
      throw new TypeError('Codex auth URL timeout must be a positive finite number')
    }
  }

  async status(): Promise<CodexWebAuthStatus> {
    if (this.operation !== undefined) return this.state
    if (this.state.status === 'error') return this.state
    return this.readStoredStatus()
  }

  async signIn(): Promise<LoginChallenge> {
    if (this.operation === undefined) this.start()
    if (this.challenge !== undefined) return this.challenge
    return new Promise<LoginChallenge>((resolve, reject) => {
      this.challengeWaiters.push({ resolve, reject })
    })
  }

  async signOut(): Promise<void> {
    this.cancelSignIn(new Error('Codex sign-in cancelled'))
    await this.operation?.catch(() => undefined)
    await logoutCodex(this.store)
    this.challenge = undefined
    this.state = { status: 'signed-out' }
  }

  async dispose(): Promise<void> {
    this.cancelSignIn(new Error('Codex plugin disposed'))
    await this.operation?.catch(() => undefined)
  }

  private start(): void {
    const cancellation = new AbortController()
    this.cancellation = cancellation
    this.challenge = undefined
    this.state = { status: 'signing-in' }
    this.challengeTimer = setTimeout(() => {
      this.cancelSignIn(new Error(`Codex did not provide an authorization URL within ${String(this.challengeTimeoutMs)}ms`))
    }, this.challengeTimeoutMs)
    this.challengeTimer.unref()
    this.operation = loginCodex({
      signal: cancellation.signal,
      prompt: prompt => prompt.type === 'select'
        ? Promise.resolve('browser')
        : waitForPromptAbort(prompt),
      notify: event => { this.onEvent(event) },
    }, this.store).then(
      async () => {
        if (this.challenge === undefined) {
          const error = new Error('Codex sign-in finished without an authorization URL')
          this.rejectChallenge(error)
          this.state = { status: 'error', message: safeMessage(error) }
          return
        }
        this.state = await this.readStoredStatus()
      },
      (error: unknown) => {
        this.rejectChallenge(error)
        this.state = { status: 'error', message: safeMessage(error) }
      },
    ).finally(() => {
      this.clearChallengeTimer()
      this.operation = undefined
      this.cancellation = undefined
    })
  }

  private onEvent(event: AuthEvent): void {
    if (event.type !== 'auth_url') return
    let url: URL
    try {
      url = new URL(event.url)
    } catch {
      this.cancelSignIn(new Error('OpenAI returned an invalid authorization URL'))
      return
    }
    if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
      this.cancelSignIn(new Error('OpenAI returned an unsafe authorization URL'))
      return
    }
    const challenge = { url: event.url }
    this.challenge = challenge
    this.clearChallengeTimer()
    for (const waiter of this.challengeWaiters.splice(0)) waiter.resolve(challenge)
  }

  private async readStoredStatus(): Promise<CodexWebAuthStatus> {
    const stored = await codexAuthStatus(this.store)
    if (!stored.authenticated) return { status: 'signed-out' }
    try {
      return { status: 'signed-in', usage: await readCodexRateLimits(this.store) }
    } catch (error: unknown) {
      if (isCodexReauthRequiredError(error)) {
        return { status: 'reauth-required', message: CODEX_REAUTH_REQUIRED_MESSAGE }
      }
      return { status: 'signed-in', usage: { rateLimits: [] }, quotaError: safeMessage(error) }
    }
  }

  private rejectChallenge(error: unknown): void {
    this.clearChallengeTimer()
    for (const waiter of this.challengeWaiters.splice(0)) waiter.reject(error)
  }

  private clearChallengeTimer(): void {
    if (this.challengeTimer === undefined) return
    clearTimeout(this.challengeTimer)
    this.challengeTimer = undefined
  }

  private cancelSignIn(error: Error): void {
    this.rejectChallenge(error)
    this.cancellation?.abort(error)
  }
}

function loopbackHost(rawHost: string): boolean {
  if (/[\\/@?#]/u.test(rawHost)) return false
  try {
    const parsed = new URL(`http://${rawHost}`)
    if (parsed.username !== '' || parsed.password !== '' || parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') return false
    const bracketless = parsed.hostname.startsWith('[') && parsed.hostname.endsWith(']')
      ? parsed.hostname.slice(1, -1)
      : parsed.hostname
    const hostname = bracketless.toLowerCase().replace(/\.$/u, '')
    return hostname === 'localhost'
      || hostname.endsWith('.localhost')
      || hostname === '127.0.0.1'
      || hostname === '::1'
      || hostname === '::ffff:127.0.0.1'
  } catch {
    return false
  }
}

function exactOrigin(req: IncomingMessage, rawHost: string, rawOrigin: string): boolean {
  try {
    const origin = new URL(rawOrigin)
    if (origin.username !== '' || origin.password !== '' || origin.pathname !== '/' || origin.search !== '' || origin.hash !== '') return false
    const encrypted = (req.socket as IncomingMessage['socket'] & { encrypted?: boolean }).encrypted === true
    return origin.origin === new URL(`${encrypted ? 'https' : 'http'}://${rawHost}`).origin
  } catch {
    return false
  }
}

export function trustedRequest(req: IncomingMessage): boolean {
  const remote = req.socket.remoteAddress
  if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') return false
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const host = req.headers.host
  if (typeof host !== 'string' || !loopbackHost(host)) return false
  const origin = req.headers.origin
  if (origin === undefined) return true
  return typeof origin === 'string' && exactOrigin(req, host, origin)
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify(value))
}

export function registerCodexAuthRoutes(ctx: Context, store: CodexCredentialStore): void {
  const auth = new CodexWebAuth(store)
  ctx.effect(() => {
    const routes = [
      ctx.webServer.register({
        kind: 'exact',
        path: CODEX_AUTH_STATUS_PATH,
        handler: async (req, res) => {
          if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' })
          if (!trustedRequest(req)) return json(res, 403, { error: 'forbidden' })
          json(res, 200, await auth.status())
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: CODEX_AUTH_LOGIN_PATH,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
          if (!trustedRequest(req)) return json(res, 403, { error: 'forbidden' })
          try {
            json(res, 200, await auth.signIn())
          } catch (error: unknown) {
            json(res, 500, { error: safeMessage(error) })
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: CODEX_AUTH_LOGOUT_PATH,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
          if (!trustedRequest(req)) return json(res, 403, { error: 'forbidden' })
          try {
            await auth.signOut()
            json(res, 200, { ok: true })
          } catch (error: unknown) {
            json(res, 500, { error: safeMessage(error) })
          }
        },
      }),
    ]
    return async () => {
      for (const dispose of routes) dispose()
      await auth.dispose()
    }
  }, 'dsh-llm-codex: Web OAuth routes')
}
