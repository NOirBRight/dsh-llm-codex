import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context, Fiber } from '@deepseek-ai/cordis'
import { CODEX_RPC_ENDPOINT, Config, apply } from '../src/index.ts'

interface FetchRoute {
  path: string
  methods: string[]
  requestBody: string
  fetch(request: Request): Promise<Response>
}

interface Mounted {
  readonly context: Context
  readonly fiber: Fiber
  readonly register: (route: FetchRoute) => () => void
  readonly disposeRoute: () => void
  readonly routes: FetchRoute[]
}

let mounted: Mounted | undefined

afterEach(async () => {
  await mounted?.context.fiber.dispose()
  mounted = undefined
})

async function mountTransport(): Promise<Mounted> {
  const context = new Context()
  const registration = Object.assign(vi.fn(), { replace: vi.fn() })
  context.provide('llm', {
    registerConfigurableProviders: vi.fn(),
    registerAdapter: vi.fn(() => registration),
  } as never)

  const routes: FetchRoute[] = []
  const disposeRoute = vi.fn()
  const register = vi.fn((route: FetchRoute) => {
    routes.push(route)
    return disposeRoute
  })
  context.provide('connection', { fetch: { register }, operator: {} } as never)
  context.provide('settings', { configure: () => () => undefined } as never)

  const fiber = context.plugin({ inject: ['llm'], apply, Config }, {})
  await fiber.await()
  mounted = { context, fiber, register, disposeRoute, routes }
  return mounted
}

describe('llm-codex authenticated management fetch lifecycle', () => {
  it('does not expose the removed remote-management setting', () => {
    const schema = Config.toJSON() as { uid: number, refs: Record<string, { dict?: Record<string, unknown> }> }
    const dict = schema.refs[String(schema.uid)]?.dict
    expect(dict).toBeDefined()
    expect(dict).not.toHaveProperty('remoteManagement')
  })

  it('registers one authenticated fetch route at the Codex API path', async () => {
    const { register, routes } = await mountTransport()
    expect(register).toHaveBeenCalledTimes(1)
    expect(routes).toHaveLength(1)
    expect(routes[0]).toMatchObject({
      path: '/api/plugin-rpc/codex',
      methods: ['POST'],
      requestBody: 'buffered',
    })
  })

  it('keeps an omitted wrapped payload as undefined for legacy RPC calls', async () => {
    const { routes } = await mountTransport()
    const response = await routes[0]!.fetch(new Request('http://localhost/api/plugin-rpc/codex', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'client-request',
        rpcId: 'codex-empty-payload',
        method: CODEX_RPC_ENDPOINT,
        payload: { endpoint: 'unknown/endpoint' },
      }),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      type: 'server-response',
      rpcId: 'codex-empty-payload',
      result: { ok: false },
    })
  })

  it('disposes its exact fetch registration with the injection fiber', async () => {
    const { fiber, disposeRoute } = await mountTransport()

    await fiber.dispose()

    expect(disposeRoute).toHaveBeenCalledTimes(1)
  })
})
