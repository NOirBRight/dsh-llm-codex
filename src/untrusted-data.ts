/** Small, side-effect-free decoders shared by untrusted host and network payloads. */

/** Whether a value is a plain record suitable for keyed decoding. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Decode one positive safe integer without coercion. */
export function positiveSafeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined
}

/** Keep non-empty string elements from an untrusted list. */
export function nonEmptyStringValues(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : []
}
