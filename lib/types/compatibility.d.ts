interface CompatibilityLogger {
    warn(message: string): void;
}
export type DshRuntimeClassification = {
    kind: 'verified';
} | {
    kind: 'unverified';
} | {
    kind: 'blocked';
    reason: string;
};
/**
 * Classify one runtime without treating the verified table as an allowlist.
 * @param version - Resolved DSH runtime version.
 * @param verified - Releases with direct compatibility evidence.
 * @param blocklist - Versions excluded after reproduced failures.
 * @returns The fail-open mount decision.
 */
export declare function classifyDshRuntime(version: string, verified: ReadonlySet<string>, blocklist?: Readonly<Record<string, unknown>>): DshRuntimeClassification;
/**
 * Apply the fail-open decision and emit at most one visible warning.
 * @param logger - Host logger receiving compatibility warnings.
 * @param pluginName - Plugin identifier used in diagnostics.
 * @param version - Resolved DSH runtime version.
 * @param verified - Releases with direct compatibility evidence.
 * @param blocklist - Versions excluded after reproduced failures.
 * @returns Whether the host mount should continue.
 */
export declare function shouldMountDshRuntime(logger: CompatibilityLogger, pluginName: string, version: string, verified: ReadonlySet<string>, blocklist?: Readonly<Record<string, unknown>>): boolean;
/**
 * Warn once for an unknown runtime while keeping the normal host mount path.
 * @param logger - Host logger receiving compatibility warnings.
 * @param pluginName - Plugin identifier used in diagnostics.
 * @param candidates - DSH peer packages used to resolve the host version.
 * @returns Whether the host mount should continue.
 */
export declare function allowDshRuntime(logger: CompatibilityLogger, pluginName: string, candidates: readonly string[]): boolean;
export {};
//# sourceMappingURL=compatibility.d.ts.map