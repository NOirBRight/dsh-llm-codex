/** Rewrite an outbound Codex Responses body for Fast picker rows. */

import { resolveWireModel } from './catalog.ts'
import type { CodexWireTarget } from './catalog.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Apply the official wire id and Fast service tier to a Responses payload. */
export function applyCodexWirePayload(payload: unknown, target: CodexWireTarget): unknown {
  if (!isRecord(payload)) return payload
  return {
    ...payload,
    model: target.wireId,
    ...target.serviceTier === undefined ? {} : { service_tier: target.serviceTier },
  }
}

/** Resolve a picker id then patch the payload. */
export function applyCodexCatalogWire(payload: unknown, catalogId: string): unknown {
  return applyCodexWirePayload(payload, resolveWireModel(catalogId))
}
