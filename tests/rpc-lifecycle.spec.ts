import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { CODEX_RPC_CHANNEL, Config, apply } from '../src/index.ts'

interface Mounted {
  readonly context: Context
  readonly fiber: ReturnType<Context['plugin']>
  readonly handle: ReturnType<typeof vi.fn>
  readonly rpcDispose: ReturnType<typeof vi.fn>
  readonly routeDisposals: ReturnType<typeof vi.fn>[]
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

  const routeDisposals: ReturnType<typeof vi.fn>[] = []
  context.provide('webServer', {
    register: vi.fn(() => {
      const dispose = vi.fn()
      routeDisposals.push(dispose)
      return dispose
    }),
  } as never)

  const rpcDispose = vi.fn(async () => {})
  const handle = vi.fn((_channel: string, _handler: unknown) => rpcDispose)
  context.provide('connection', { rpc: { handle } } as never)

  const fiber = context.plugin({ inject: ['llm'], apply, Config }, {})
  await fiber.await()
  mounted = { context, fiber, handle, rpcDispose, routeDisposals }
  return mounted
}

describe('llm-codex Connection management lifecycle', () => {
  it('does not expose the removed remote-management setting', () => {
    const schema = Config.toJSON() as { uid: number, refs: Record<string, { dict?: Record<string, unknown> }> }
    const dict = schema.refs[String(schema.uid)]?.dict
    expect(dict).toBeDefined()
    expect(dict).not.toHaveProperty('remoteManagement')
  })

  it('registers HostConnectionRpc.handle with exactly its two supported arguments', async () => {
    const { handle } = await mountTransport()
    expect(handle).toHaveBeenCalledTimes(1)
    expect(handle.mock.calls[0]).toHaveLength(2)
    expect(handle.mock.calls[0]?.[0]).toBe(CODEX_RPC_CHANNEL)
  })

  it('disposes the RPC registration and web routes with the injection fibers', async () => {
    const { fiber, rpcDispose, routeDisposals } = await mountTransport()
    expect(routeDisposals).toHaveLength(3)

    await fiber.dispose()

    expect(rpcDispose).toHaveBeenCalledTimes(1)
    for (const dispose of routeDisposals) expect(dispose).toHaveBeenCalledTimes(1)
  })
})
