/** Rewrite an outbound Codex Responses body for Fast picker rows. */
import type { CodexWireTarget } from './catalog.ts';
/** Apply the official wire id and Fast service tier to a Responses payload. */
export declare function applyCodexWirePayload(payload: unknown, target: CodexWireTarget): unknown;
/** Resolve a picker id then patch the payload. */
export declare function applyCodexCatalogWire(payload: unknown, catalogId: string): unknown;
//# sourceMappingURL=service-tier.d.ts.map