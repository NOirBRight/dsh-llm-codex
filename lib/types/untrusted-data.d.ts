/** Small, side-effect-free decoders shared by untrusted host and network payloads. */
/** Whether a value is a plain record suitable for keyed decoding. */
export declare function isRecord(value: unknown): value is Record<string, unknown>;
/** Decode one positive safe integer without coercion. */
export declare function positiveSafeInteger(value: unknown): number | undefined;
/** Keep non-empty string elements from an untrusted list. */
export declare function nonEmptyStringValues(value: unknown): string[];
//# sourceMappingURL=untrusted-data.d.ts.map