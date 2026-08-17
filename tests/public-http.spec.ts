import { describe, expect, it, vi } from 'vitest'
import {
  createNodePublicHttpRuntime,
  fetchPublicHttpResource,
  isPublicNetworkAddress,
} from '../src/public-http.ts'
import type { PublicHttpRuntime } from '../src/public-http.ts'

const signal = new AbortController().signal
const PNG_1X1 = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
))

describe('isPublicNetworkAddress', () => {
  it('accepts ordinary public addresses', () => {
    expect(isPublicNetworkAddress('1.1.1.1')).toBe(true)
    expect(isPublicNetworkAddress('8.8.8.8')).toBe(true)
    expect(isPublicNetworkAddress('2001:4860:4860::8888')).toBe(true)
  })

  it('rejects loopback, private, and documentation ranges', () => {
    expect(isPublicNetworkAddress('127.0.0.1')).toBe(false)
    expect(isPublicNetworkAddress('10.0.0.1')).toBe(false)
    expect(isPublicNetworkAddress('192.168.1.1')).toBe(false)
    expect(isPublicNetworkAddress('169.254.1.1')).toBe(false)
    expect(isPublicNetworkAddress('198.18.0.1')).toBe(false)
    expect(isPublicNetworkAddress('::1')).toBe(false)
    expect(isPublicNetworkAddress('2001:db8::1')).toBe(false)
  })
})

describe('fake-IP proxy DNS compatibility', () => {
  it('accepts a fake-IP hostname only after the resolver proves proxy mode', async () => {
    const nodeRuntime = createNodePublicHttpRuntime({
      lookup: async hostname => [{
        address: hostname === 'images.example' ? '198.18.0.42' : '198.18.0.1',
        family: 4,
      }],
    })
    const get = vi.fn<PublicHttpRuntime['get']>().mockResolvedValue({ status: 200, data: PNG_1X1 })
    const runtime: PublicHttpRuntime = { resolve: nodeRuntime.resolve, get }

    const result = await fetchPublicHttpResource('https://images.example/pixel.png', 1024, signal, runtime)

    expect(result.data).toEqual(PNG_1X1)
    expect(get.mock.calls[0]?.[1]).toMatchObject({
      address: '198.18.0.42',
      family: 4,
      viaVerifiedFakeIpProxy: true,
    })
  })

  it('still rejects fake-IP results when the resolver is not in proxy mode', async () => {
    const nodeRuntime = createNodePublicHttpRuntime({
      lookup: async hostname => [{
        address: hostname === 'images.example' ? '198.18.0.42' : '1.1.1.1',
        family: 4,
      }],
    })
    const get = vi.fn<PublicHttpRuntime['get']>()
    const runtime: PublicHttpRuntime = { resolve: nodeRuntime.resolve, get }

    await expect(fetchPublicHttpResource('https://images.example/pixel.png', 1024, signal, runtime))
      .rejects.toThrow(/public network addresses/u)
    expect(get).not.toHaveBeenCalled()
  })

  it('never trusts a fake-IP address used as a URL literal', async () => {
    const nodeRuntime = createNodePublicHttpRuntime({
      lookup: async () => [{ address: '198.18.0.1', family: 4 }],
    })

    await expect(fetchPublicHttpResource(
      'https://198.18.0.42/pixel.png',
      1024,
      signal,
      nodeRuntime,
    )).rejects.toThrow(/public network addresses/u)
  })
})
