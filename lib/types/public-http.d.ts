/** Public-network-only HTTP(S) reader used by the optional remote image path. */
import type { LookupAddress } from 'node:dns';
export declare const PUBLIC_HTTP_HOP_TIMEOUT_MS = 30000;
export declare const PUBLIC_HTTP_MAX_REDIRECTS = 5;
export interface ResolvedNetworkAddress {
    address: string;
    family: 4 | 6;
    /** Set only after the Node resolver proves that the OS is in DNS fake-IP proxy mode. */
    viaVerifiedFakeIpProxy?: true;
}
export interface PublicHttpHop {
    status: number;
    location?: string;
    data?: Uint8Array;
}
export interface PublicHttpRuntime {
    resolve(hostname: string, signal: AbortSignal): Promise<readonly ResolvedNetworkAddress[]>;
    get(url: URL, address: ResolvedNetworkAddress, maxBytes: number, signal: AbortSignal): Promise<PublicHttpHop>;
}
export interface PublicHttpResource {
    data: Uint8Array;
    display: string;
    name?: string;
}
export type PublicHttpLookup = (hostname: string) => Promise<readonly LookupAddress[]>;
export interface NodePublicHttpRuntimeOptions {
    lookup?: PublicHttpLookup;
}
export declare function isPublicNetworkAddress(rawAddress: string): boolean;
export declare function collectBoundedBytes(body: AsyncIterable<Uint8Array | string>, declaredLength: string | undefined, maxBytes: number, signal: AbortSignal): Promise<Uint8Array>;
export declare function createNodePublicHttpRuntime(options?: NodePublicHttpRuntimeOptions): PublicHttpRuntime;
export declare const NODE_PUBLIC_HTTP_RUNTIME: PublicHttpRuntime;
export declare function fetchPublicHttpResource(source: string, maxBytes: number, signal: AbortSignal, runtime?: PublicHttpRuntime): Promise<PublicHttpResource>;
//# sourceMappingURL=public-http.d.ts.map