/** Public-network-only HTTP(S) reader used by the optional remote image path. */

import { lookup as systemLookup } from 'node:dns/promises'
import type { LookupAddress } from 'node:dns'
import { request as requestHttp } from 'node:http'
import type { IncomingMessage } from 'node:http'
import { request as requestHttps } from 'node:https'
import { basename } from 'node:path'
import { BlockList, isIP } from 'node:net'
import type { LookupFunction } from 'node:net'

export const PUBLIC_HTTP_HOP_TIMEOUT_MS = 30_000
export const PUBLIC_HTTP_MAX_REDIRECTS = 5

export interface ResolvedNetworkAddress {
  address: string
  family: 4 | 6
  /** Set only after the Node resolver proves that the OS is in DNS fake-IP proxy mode. */
  viaVerifiedFakeIpProxy?: true
}

export interface PublicHttpHop {
  status: number
  location?: string
  data?: Uint8Array
}

export interface PublicHttpRuntime {
  resolve(hostname: string, signal: AbortSignal): Promise<readonly ResolvedNetworkAddress[]>
  get(
    url: URL,
    address: ResolvedNetworkAddress,
    maxBytes: number,
    signal: AbortSignal,
  ): Promise<PublicHttpHop>
}

export interface PublicHttpResource {
  data: Uint8Array
  display: string
  name?: string
}

export type PublicHttpLookup = (hostname: string) => Promise<readonly LookupAddress[]>

export interface NodePublicHttpRuntimeOptions {
  lookup?: PublicHttpLookup
}

function blockedList(
  family: 'ipv4' | 'ipv6',
  ranges: ReadonlyArray<readonly [address: string, prefix: number]>,
): BlockList {
  const list = new BlockList()
  for (const [address, prefix] of ranges) list.addSubnet(address, prefix, family)
  return list
}

const FAKE_IP_IPV4 = blockedList('ipv4', [['198.18.0.0', 15]])

const BLOCKED_IPV4 = blockedList('ipv4', [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
])

const GLOBAL_IPV6 = blockedList('ipv6', [['2000::', 3]])
const BLOCKED_IPV6 = blockedList('ipv6', [
  ['2001::', 32],
  ['2001:2::', 48],
  ['2001:10::', 28],
  ['2001:20::', 28],
  ['2001:db8::', 32],
  ['2002::', 16],
])

function unbracket(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname
}

function isFakeIpNetworkAddress(rawAddress: string): boolean {
  const address = unbracket(rawAddress)
  return isIP(address) === 4 && FAKE_IP_IPV4.check(address, 'ipv4')
}

export function isPublicNetworkAddress(rawAddress: string): boolean {
  const address = unbracket(rawAddress)
  if (address.includes('%')) return false
  const family = isIP(address)
  if (family === 4) return !BLOCKED_IPV4.check(address, 'ipv4')
  if (family === 6) {
    return GLOBAL_IPV6.check(address, 'ipv6') && !BLOCKED_IPV6.check(address, 'ipv6')
  }
  return false
}

function abortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new Error(signal.reason === undefined ? 'remote image request aborted' : String(signal.reason))
}

function assertTargetUrl(url: URL): void {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('view_image URL must use http or https')
  }
  if (url.username !== '' || url.password !== '') {
    throw new Error('view_image URL must not contain credentials')
  }
}

function normalizeAddress(candidate: LookupAddress): ResolvedNetworkAddress {
  if (candidate.family !== 4 && candidate.family !== 6) {
    throw new Error('remote image hostname resolved to an unsupported address family')
  }
  return { address: candidate.address, family: candidate.family }
}

const FAKE_IP_PROBE_HOSTS = ['example.com', 'one.one.one.one'] as const

async function systemLookupAll(hostname: string): Promise<readonly LookupAddress[]> {
  return systemLookup(hostname, { all: true, order: 'verbatim' })
}

async function verifyFakeIpProxyMode(lookup: PublicHttpLookup, signal: AbortSignal): Promise<boolean> {
  try {
    for (const hostname of FAKE_IP_PROBE_HOSTS) {
      if (signal.aborted) throw abortError(signal)
      const addresses = await lookup(hostname)
      if (addresses.length === 0 || addresses.some(candidate => !isFakeIpNetworkAddress(candidate.address))) {
        return false
      }
    }
    return true
  } catch (error) {
    if (signal.aborted) throw abortError(signal)
    // A failed probe must fail closed: the original fake-IP result remains blocked.
    void error
    return false
  }
}

function resolveHostWith(lookup: PublicHttpLookup) {
  return async (hostname: string, signal: AbortSignal): Promise<readonly ResolvedNetworkAddress[]> => {
    if (signal.aborted) throw abortError(signal)
    const literal = unbracket(hostname)
    const family = isIP(literal)
    // URL literals never receive the proxy exception, even when they are inside
    // the fake-IP range. The exception is exclusively for DNS proxy results.
    if (family === 4 || family === 6) return [{ address: literal, family }]
    const results = await lookup(literal)
    if (signal.aborted) throw abortError(signal)
    const addresses = results.map(normalizeAddress)
    if (addresses.length === 0 || addresses.some(candidate => !isFakeIpNetworkAddress(candidate.address))) {
      return addresses
    }
    if (!await verifyFakeIpProxyMode(lookup, signal)) return addresses
    return addresses.map(candidate => ({ ...candidate, viaVerifiedFakeIpProxy: true as const }))
  }
}

export async function collectBoundedBytes(
  body: AsyncIterable<Uint8Array | string>,
  declaredLength: string | undefined,
  maxBytes: number,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const declared = declaredLength === undefined ? Number.NaN : Number(declaredLength)
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`remote image exceeds ${String(maxBytes)} bytes`)
  }
  const chunks: Uint8Array[] = []
  let total = 0
  for await (const chunk of body) {
    if (signal.aborted) throw abortError(signal)
    const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : new Uint8Array(chunk)
    total += bytes.byteLength
    if (total > maxBytes) throw new Error(`remote image exceeds ${String(maxBytes)} bytes`)
    chunks.push(bytes)
  }
  const data = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    data.set(chunk, offset)
    offset += chunk.byteLength
  }
  return data
}

function pinnedLookup(address: ResolvedNetworkAddress): LookupFunction {
  return (_hostname, options, callback) => {
    const resolved = { address: address.address, family: address.family }
    if (options.all === true) callback(null, [resolved])
    else callback(null, resolved.address, resolved.family)
  }
}

function headerValue(message: IncomingMessage, name: 'content-length' | 'location'): string | undefined {
  const value = message.headers[name]
  return Array.isArray(value) ? value[0] : value
}

async function requestPinned(
  url: URL,
  address: ResolvedNetworkAddress,
  maxBytes: number,
  signal: AbortSignal,
): Promise<PublicHttpHop> {
  if (signal.aborted) throw abortError(signal)
  return new Promise<PublicHttpHop>((resolve, reject) => {
    let settled = false
    let response: IncomingMessage | undefined
    const finish = (result: { ok: true; value: PublicHttpHop } | { ok: false; error: unknown }): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      if (result.ok) resolve(result.value)
      else reject(result.error)
    }
    const requester = url.protocol === 'https:' ? requestHttps : requestHttp
    const request = requester(url, {
      method: 'GET',
      agent: false,
      lookup: pinnedLookup(address),
      headers: {
        accept: 'image/png, image/jpeg, image/webp, image/gif',
      },
    }, (incoming) => {
      response = incoming
      const status = incoming.statusCode ?? 0
      const location = headerValue(incoming, 'location')
      if ((status >= 300 && status < 400) || status < 200 || status >= 300) {
        finish({
          ok: true,
          value: { status, ...location === undefined ? {} : { location } },
        })
        incoming.destroy()
        return
      }
      void collectBoundedBytes(incoming, headerValue(incoming, 'content-length'), maxBytes, signal).then(
        data => { finish({ ok: true, value: { status, data } }) },
        error => {
          incoming.destroy(error instanceof Error ? error : undefined)
          finish({ ok: false, error })
        },
      )
    })
    const onAbort = (): void => {
      const error = abortError(signal)
      response?.destroy(error)
      request.destroy(error)
    }
    const timer = setTimeout(() => {
      const error = new Error(`remote image request exceeded ${String(PUBLIC_HTTP_HOP_TIMEOUT_MS)}ms`)
      response?.destroy(error)
      request.destroy(error)
    }, PUBLIC_HTTP_HOP_TIMEOUT_MS)
    timer.unref()
    signal.addEventListener('abort', onAbort, { once: true })
    request.once('error', error => { finish({ ok: false, error }) })
    request.end()
  })
}

export function createNodePublicHttpRuntime(
  options: NodePublicHttpRuntimeOptions = {},
): PublicHttpRuntime {
  return {
    resolve: resolveHostWith(options.lookup ?? systemLookupAll),
    get: requestPinned,
  }
}

export const NODE_PUBLIC_HTTP_RUNTIME: PublicHttpRuntime = createNodePublicHttpRuntime()

export async function fetchPublicHttpResource(
  source: string,
  maxBytes: number,
  signal: AbortSignal,
  runtime: PublicHttpRuntime = NODE_PUBLIC_HTTP_RUNTIME,
): Promise<PublicHttpResource> {
  let url = new URL(source)
  assertTargetUrl(url)
  for (let redirects = 0; ; redirects += 1) {
    if (signal.aborted) throw abortError(signal)
    const addresses = await runtime.resolve(url.hostname, signal)
    const unsafe = addresses.some(candidate => {
      if (isPublicNetworkAddress(candidate.address)) return false
      return candidate.viaVerifiedFakeIpProxy !== true || !isFakeIpNetworkAddress(candidate.address)
    })
    if (addresses.length === 0 || unsafe) {
      throw new Error(`remote image host ${JSON.stringify(url.hostname)} must resolve only to public network addresses`)
    }
    const hop = await runtime.get(url, addresses[0]!, maxBytes, signal)
    if (hop.status >= 300 && hop.status < 400) {
      if (redirects >= PUBLIC_HTTP_MAX_REDIRECTS) {
        throw new Error(`remote image exceeded ${String(PUBLIC_HTTP_MAX_REDIRECTS)} redirects`)
      }
      if (hop.location === undefined) {
        throw new Error(`remote image redirect ${String(hop.status)} has no location`)
      }
      url = new URL(hop.location, url)
      assertTargetUrl(url)
      continue
    }
    if (hop.status < 200 || hop.status >= 300) {
      throw new Error(`remote image request failed with HTTP ${String(hop.status)}`)
    }
    if (hop.data === undefined) throw new Error('remote image response did not contain a body')
    const name = basename(url.pathname) || undefined
    return {
      data: hop.data,
      display: url.href,
      ...name === undefined ? {} : { name },
    }
  }
}
