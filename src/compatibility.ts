import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

interface CompatibilityLogger {
  warn(message: string): void
}

type CompatibilityManifest = {
  dsh?: {
    compatibility?: {
      dshReleases?: Record<string, unknown>
      blocklist?: Record<string, unknown>
    }
  }
}

export type DshRuntimeClassification =
  | { kind: 'verified' }
  | { kind: 'unverified' }
  | { kind: 'blocked'; reason: string }

/**
 * Classify one runtime without treating the verified table as an allowlist.
 * @param version - Resolved DSH runtime version.
 * @param verified - Releases with direct compatibility evidence.
 * @param blocklist - Versions excluded after reproduced failures.
 * @returns The fail-open mount decision.
 */
export function classifyDshRuntime(
  version: string,
  verified: ReadonlySet<string>,
  blocklist: Readonly<Record<string, unknown>> = {},
): DshRuntimeClassification {
  const reason = blocklist[version]
  if (typeof reason === 'string' && reason.trim() !== '') return { kind: 'blocked', reason }
  return verified.has(version) ? { kind: 'verified' } : { kind: 'unverified' }
}

/**
 * Apply the fail-open decision and emit at most one visible warning.
 * @param logger - Host logger receiving compatibility warnings.
 * @param pluginName - Plugin identifier used in diagnostics.
 * @param version - Resolved DSH runtime version.
 * @param verified - Releases with direct compatibility evidence.
 * @param blocklist - Versions excluded after reproduced failures.
 * @returns Whether the host mount should continue.
 */
export function shouldMountDshRuntime(
  logger: CompatibilityLogger,
  pluginName: string,
  version: string,
  verified: ReadonlySet<string>,
  blocklist: Readonly<Record<string, unknown>> = {},
): boolean {
  const decision = classifyDshRuntime(version, verified, blocklist)
  if (decision.kind === 'blocked') {
    logger.warn(`[${pluginName}] blocked on DSH ${version}: ${decision.reason}; see package.json#dsh.compatibility.blocklist`)
    return false
  }
  if (decision.kind === 'unverified') logger.warn(`[${pluginName}] best-effort on unverified runtime ${version}`)
  return true
}

function readManifest(): CompatibilityManifest {
  try {
    return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as CompatibilityManifest
  } catch {
    // A missing manifest must not turn compatibility metadata into a load failure.
    return {}
  }
}

function packageVersion(packageName: string): string | undefined {
  try {
    const require = createRequire(import.meta.url)
    let directory = dirname(require.resolve(packageName))
    for (;;) {
      try {
        const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')) as { version?: unknown }
        if (typeof manifest.version === 'string' && manifest.version !== '') return manifest.version
      } catch {
        // Keep walking until the package root is exhausted.
      }
      const parent = dirname(directory)
      if (parent === directory) return undefined
      directory = parent
    }
  } catch {
    return undefined
  }
}

/**
 * Warn once for an unknown runtime while keeping the normal host mount path.
 * @param logger - Host logger receiving compatibility warnings.
 * @param pluginName - Plugin identifier used in diagnostics.
 * @param candidates - DSH peer packages used to resolve the host version.
 * @returns Whether the host mount should continue.
 */
export function allowDshRuntime(logger: CompatibilityLogger, pluginName: string, candidates: readonly string[]): boolean {
  const version = process.env.DSH_VERSION?.trim() || candidates.map(packageVersion).find(value => value !== undefined) || 'unknown'
  const compatibility = readManifest().dsh?.compatibility
  const verified = new Set(Object.entries(compatibility?.dshReleases ?? {})
    .filter(([, status]) => status === 'compatible' || status === 'verified')
    .map(([release]) => release))
  return shouldMountDshRuntime(logger, pluginName, version, verified, compatibility?.blocklist)
}
