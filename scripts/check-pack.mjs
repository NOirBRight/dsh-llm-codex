import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { builtinModules } from 'node:module'
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  rmdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const FIXTURE_ROOT = join(ROOT, 'fixtures', 'alpha1')
const FIXTURE_TARBALL_ROOT = join(FIXTURE_ROOT, 'tarballs')
const INVALID_REGISTRY = 'http://127.0.0.1:9'
const PACKAGE_NAME = 'dsh-llm-codex'
const OFFICIAL_ALPHA1 = '0.1.2-alpha.1'
const OWNER_PACKAGE = 'dsh-llm-providers-ui'
const OWNER_VERSION = '0.1.1'
const BUILTIN_MODULES = new Set(builtinModules)
const DEPENDENCY_SECTIONS = ['dependencies', 'optionalDependencies', 'peerDependencies', 'devDependencies']
const RUNTIME_SECTIONS = ['dependencies', 'optionalDependencies', 'peerDependencies']
const REQUIRED_FILES = [
  'LICENSE',
  'README.md',
  'README.zh.md',
  'package.json',
  'cordis.patch.yml',
  'docs/images/plugin-card-catalog.png',
  'docs/images/plugin-card-capabilities.png',
  'lib/index.js',
  'lib/invariant.js',
  'lib/client.js',
  'lib/types/index.d.ts',
  'lib/types/invariant.d.ts',
  'lib/types/client/index.d.ts',
]
const FORBIDDEN_ENV_KEY = /(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|AUTH|CLOUD)/iu
const INHERITED_ENV_KEYS = [
  'PATH', 'HOME', 'USER', 'LANG', 'TMP', 'TMPDIR', 'TEMP', 'CI',
  'SystemRoot', 'WINDIR', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH',
  'COMSPEC', 'ComSpec', 'PATHEXT',
]
const PACKAGE_MANAGER_ENV_KEYS = new Set([
  'npm_config_userconfig', 'pnpm_config_userconfig',
  'npm_config_globalconfig', 'pnpm_config_globalconfig',
  'npm_config_registry', 'pnpm_config_registry',
  'npm_config_store_dir', 'pnpm_config_store_dir',
  'npm_config_cache', 'pnpm_config_cache',
  'npm_config_auto_install_peers', 'pnpm_config_auto_install_peers',
])
const CHILD_ENV_KEYS = new Set([...INHERITED_ENV_KEYS, 'NODE_PATH', 'NODE_OPTIONS', ...PACKAGE_MANAGER_ENV_KEYS])
const CHILD_ENV_ROOT = mkdtempSync(join(tmpdir(), 'dsh-llm-codex-pack-env-'))
const CHILD_CONFIG = join(CHILD_ENV_ROOT, 'config')
const CHILD_CACHE = join(CHILD_ENV_ROOT, 'cache')
const CHILD_STORE = join(CHILD_ENV_ROOT, 'store')
const CHILD_USERCONFIG = join(CHILD_CONFIG, 'npmrc')
const CHILD_GLOBALCONFIG = join(CHILD_CONFIG, 'globalrc')

function fail(message) {
  throw new Error('pack gate: ' + message)
}

function initializeChildEnvironment() {
  for (const directory of [CHILD_CONFIG, CHILD_CACHE, CHILD_STORE]) mkdirSync(directory, { recursive: true })
  writeFileSync(CHILD_USERCONFIG, '')
  writeFileSync(CHILD_GLOBALCONFIG, '')
}

function commandEnv(extra = {}, packageManager = false) {
  const env = {}
  for (const key of INHERITED_ENV_KEYS) {
    const value = process.env[key]
    if (typeof value === 'string') env[key] = value
  }
  env.NODE_PATH = ''
  env.NODE_OPTIONS = ''
  if (packageManager) {
    for (const [key, value] of Object.entries(extra)) {
      if (!PACKAGE_MANAGER_ENV_KEYS.has(key)) fail('child environment override is not allowlisted: ' + key)
      env[key] = String(value)
    }
  } else if (Object.keys(extra).length !== 0) {
    fail('child environment overrides require package-manager mode')
  }
  return env
}

function packageManagerEnv(userconfig, store, cache = CHILD_CACHE) {
  return {
    npm_config_userconfig: userconfig,
    pnpm_config_userconfig: userconfig,
    npm_config_globalconfig: CHILD_GLOBALCONFIG,
    pnpm_config_globalconfig: CHILD_GLOBALCONFIG,
    npm_config_registry: INVALID_REGISTRY,
    pnpm_config_registry: INVALID_REGISTRY,
    npm_config_store_dir: store,
    pnpm_config_store_dir: store,
    npm_config_cache: cache,
    pnpm_config_cache: cache,
    npm_config_auto_install_peers: 'false',
    pnpm_config_auto_install_peers: 'false',
  }
}

function checkChildEnvironment() {
  const markerNames = [
    'DSH_PACK_GATE_KEY',
    'DSH_PACK_GATE_SECRET',
    'DSH_PACK_GATE_TOKEN',
    'DSH_PACK_GATE_PASSWORD',
    'DSH_PACK_GATE_CREDENTIAL',
    'DSH_PACK_GATE_AUTH',
    'DSH_PACK_GATE_CLOUD',
    'DSH_PACK_GATE_SENTINEL',
    'NPM_CONFIG_REGISTRY',
    'npm_config_userconfig',
    'PNPM_HOME',
    'COREPACK_HOME',
  ]
  const previous = new Map(markerNames.map(name => [name, process.env[name]]))
  for (const name of markerNames) process.env[name] = 'must-not-cross-process-boundary'
  try {
    let child
    try {
      child = JSON.parse(run(process.execPath, ['-e', 'process.stdout.write(JSON.stringify(process.env))']))
    } catch (error) {
      fail('child environment probe returned invalid JSON: ' + (error instanceof Error ? error.message : String(error)))
    }
    for (const key of Object.keys(child)) {
      if (!CHILD_ENV_KEYS.has(key)) fail('child environment contains an unallowlisted key: ' + key)
      if (FORBIDDEN_ENV_KEY.test(key)) fail('child environment contains a credential-like key: ' + key)
      if (/^(?:NPM|PNPM|YARN|COREPACK)(?:_|$)/iu.test(key)) fail('child environment contains package-manager configuration: ' + key)
    }
    for (const name of markerNames) if (child[name] !== undefined) fail('child environment leaked synthetic marker: ' + name)
    for (const [key, expected] of Object.entries({ NODE_PATH: '', NODE_OPTIONS: '' })) {
      if (child[key] !== expected) fail('child environment has an unsafe ' + key + ' value')
    }
    let rejected = false
    try {
      commandEnv({ DSH_PACK_GATE_SECRET: 'must-be-rejected' }, true)
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('not allowlisted')) throw error
      rejected = true
    }
    if (!rejected) fail('child environment accepted a credential-like override')
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}

function outputText(value) {
  if (typeof value === 'string') return value
  if (value === undefined || value === null) return ''
  return Buffer.from(value).toString('utf8')
}

function errorCode(error) {
  if (error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string') return error.code
  return undefined
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error)
}

function isMissingPathError(error) {
  const code = errorCode(error)
  return code === 'ENOENT' || code === 'ENOTDIR'
}

function tryLstat(path) {
  try {
    return lstatSync(path, { throwIfNoEntry: false })
  } catch (error) {
    if (isMissingPathError(error)) return undefined
    throw error
  }
}

function tryRealpath(path) {
  try {
    return realpathSync(path)
  } catch (error) {
    if (isMissingPathError(error)) return undefined
    throw error
  }
}

function isFile(path) {
  try {
    return statSync(path).isFile()
  } catch (error) {
    if (isMissingPathError(error)) return false
    throw error
  }
}

function isWithinOrSame(parent, child) {
  const childPath = relative(parent, child)
  return childPath === '' || (childPath !== '..' && !childPath.startsWith('..' + sep) && !isAbsolute(childPath))
}

function removeTemporaryTreeRecursively(path, root) {
  const stat = tryLstat(path)
  if (stat === undefined) return
  if (stat.isSymbolicLink()) {
    const parent = tryRealpath(dirname(path))
    if (parent === undefined) return
    if (!isWithinOrSame(root, parent)) throw new Error('temporary cleanup path escaped its root: ' + path)
    try {
      rmSync(path, { force: false })
    } catch (error) {
      if (!isMissingPathError(error)) throw new Error('temporary cleanup failed for ' + path + ': ' + errorText(error), { cause: error })
    }
    return
  }
  if (!stat.isDirectory()) {
    const real = tryRealpath(path)
    if (real === undefined) return
    if (!isWithinOrSame(root, real)) throw new Error('temporary cleanup path escaped its root: ' + path)
    try {
      rmSync(path, { force: false })
    } catch (error) {
      if (!isMissingPathError(error)) throw new Error('temporary cleanup failed for ' + path + ': ' + errorText(error), { cause: error })
    }
    return
  }
  const real = tryRealpath(path)
  if (real === undefined) return
  if (!isWithinOrSame(root, real)) throw new Error('temporary cleanup path escaped its root: ' + path)
  let entries
  try {
    entries = readdirSync(path)
  } catch (error) {
    if (isMissingPathError(error)) return
    throw new Error('temporary cleanup readdir failed for ' + path + ': ' + errorText(error), { cause: error })
  }
  for (const entry of entries) removeTemporaryTreeRecursively(join(path, entry), root)
  try {
    rmdirSync(path)
  } catch (error) {
    if (isMissingPathError(error)) return
    throw new Error('temporary cleanup rmdir failed for ' + path + ': ' + errorText(error), { cause: error })
  }
}

function cleanupTemporaryPath(path, label) {
  if (typeof path !== 'string' || path.length === 0) throw new Error(label + ' cleanup path is empty')
  const requested = resolve(path)
  const stat = tryLstat(requested)
  if (stat === undefined || stat.isSymbolicLink() || !stat.isDirectory()) return
  const real = tryRealpath(requested)
  const parent = tryRealpath(dirname(requested))
  if (real === undefined || parent === undefined || dirname(real) !== parent) return
  removeTemporaryTreeRecursively(real, real)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    env: commandEnv(options.env, options.packageManager === true),
    encoding: 'utf8',
    input: options.input,
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const stdout = outputText(result.stdout)
  const stderr = outputText(result.stderr)
  if (result.error || result.status !== 0) {
    const detail = [stdout, stderr].filter(Boolean).join('\n').trim()
    throw new Error(command + ' ' + args.join(' ') + ' failed' + (detail ? ':\n' + detail : ''))
  }
  return stdout
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    fail('invalid JSON in ' + file + ': ' + (error instanceof Error ? error.message : String(error)))
  }
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function sha512Integrity(file) {
  return 'sha512-' + createHash('sha512').update(readFileSync(file)).digest('base64')
}

function packageIdentity(name, version) {
  return name + '@' + version
}

function expectedArchiveName(name, version) {
  const stem = name.startsWith('@') ? name.slice(1).replaceAll('/', '-') : name
  return stem + '-' + version + '.tgz'
}

function ownerArchiveNameMatches(file, name, version, digest) {
  const canonical = expectedArchiveName(name, version)
  const hashed = canonical.slice(0, -'.tgz'.length) + '-' + digest + '.tgz'
  return basename(file) === canonical || basename(file) === hashed
}

function archiveEntries(archive) {
  const listing = run('tar', ['-tzf', archive])
  const entries = []
  const seen = new Set()
  for (const entry of listing.split('\n').filter(Boolean)) {
    if (!entry.startsWith('package/')) fail('tarball has an entry outside package/: ' + entry)
    const value = entry.slice('package/'.length)
    if (!value || value.endsWith('/')) continue
    if (value.includes('\0') || value.startsWith('../') || value.includes('/../') || value.startsWith('/')) fail('tarball has an unsafe entry: ' + value)
    if (value.startsWith('node_modules/') || value.startsWith('.git/')) fail('tarball contains generated dependency metadata: ' + value)
    if (seen.has(value)) fail('tarball contains duplicate member: ' + value)
    seen.add(value)
    entries.push(value)
  }
  if (!seen.has('package.json')) fail('tarball has no package/package.json: ' + archive)
  const verbose = run('tar', ['-tvzf', archive])
  if (verbose.split('\n').some(line => /^l.*\bpackage\//u.test(line))) fail('tarball contains a symbolic link: ' + archive)
  return { entries, files: seen }
}

function archiveManifest(archive) {
  try {
    return JSON.parse(run('tar', ['-xOzf', archive, 'package/package.json']))
  } catch (error) {
    fail('tarball package.json is invalid in ' + archive + ': ' + (error instanceof Error ? error.message : String(error)))
  }
}

function targetCandidates(value) {
  const normalized = value.slice(2)
  return [
    normalized,
    normalized + '.js',
    normalized + '.mjs',
    normalized + '.cjs',
    normalized + '.json',
    normalized + '.d.ts',
    posix.join(normalized, 'index.js'),
    posix.join(normalized, 'index.mjs'),
    posix.join(normalized, 'index.cjs'),
    posix.join(normalized, 'index.d.ts'),
  ]
}

function validTarget(value, label) {
  if (typeof value !== 'string' || !value.startsWith('./')) fail(label + ' is not a relative export target')
  const target = value.slice(2)
  if ((target === '' && value !== './') || target.includes('\0') || target.startsWith('/') || target.includes('..')) fail(label + ' is unsafe: ' + value)
  return target
}

function exportTargets(value, label = 'exports') {
  if (typeof value === 'string') return [{ label, target: value }]
  if (Array.isArray(value)) return value.flatMap((entry, index) => exportTargets(entry, label + '[' + String(index) + ']'))
  if (value !== null && typeof value === 'object') return Object.entries(value).flatMap(([key, entry]) => exportTargets(entry, label + '.' + key))
  fail(label + ' has no export target')
}

function targetPatternMatches(files, value, label = 'export target') {
  const normalized = (label === 'main' || label === 'types') && typeof value === 'string' && !value.startsWith('./') ? './' + value : value
  const target = validTarget(normalized, label)
  if (!target.includes('*')) return targetCandidates(normalized).some(candidate => files.has(candidate))
  const expression = new RegExp('^' + target.replace(/[.+?^$()|[\]\\]/g, '\\$&').replaceAll('*', '.*') + '$', 'u')
  return [...files].some(file => expression.test(file))
}

function gapKey(gap) {
  return packageIdentity(gap.package, gap.version) + '|' + gap.exportTarget + '|' + String(gap.label ?? '')
}

function verifyManifestTargets(manifest, files, gaps, label) {
  const allowed = new Map()
  for (const gap of gaps) {
    if (gap.package !== manifest.name || gap.version !== manifest.version) continue
    const key = gap.package + '|' + gap.version + '|' + gap.exportTarget + '|' + String(gap.label ?? '')
    allowed.set(key, gap)
  }
  const values = []
  if (typeof manifest.main === 'string') values.push({ label: 'main', target: manifest.main, required: true })
  if (typeof manifest.types === 'string') values.push({ label: 'types', target: manifest.types, required: true })
  if (manifest.exports !== undefined) values.push(...exportTargets(manifest.exports).map(value => ({ ...value, required: false })))
  for (const value of values) {
    if (targetPatternMatches(files, value.target, value.label)) continue
    const key = manifest.name + '|' + manifest.version + '|' + value.target + '|' + value.label
    if (!value.required && allowed.has(key)) continue
    fail(label + ' is missing declared target ' + value.label + ': ' + value.target)
  }
}

function checkManifest(manifest, files) {
  if (manifest.name !== PACKAGE_NAME) fail('packed manifest has unexpected name ' + String(manifest.name))
  if (manifest.main === undefined || manifest.types === undefined) fail('packed manifest must declare main and types')
  verifyManifestTargets(manifest, files, [], 'packed manifest')
  for (const section of DEPENDENCY_SECTIONS) {
    for (const [name, spec] of Object.entries(manifest[section] ?? {})) {
      if (typeof spec !== 'string') fail(section + '.' + name + ' is not a string specifier')
      if (/^(?:file|link|workspace):/u.test(spec) || spec.startsWith('/') || /^[A-Za-z]:\\/u.test(spec)) fail('packed manifest contains a local dependency alias at ' + section + '.' + name)
      if (name.startsWith('@deepseek-ai/dsh-') && spec !== OFFICIAL_ALPHA1) fail(section + '.' + name + ' must use ' + OFFICIAL_ALPHA1 + ', got ' + spec)
      if (/(?:^|[-.])rc(?:[-.]|$)|0\.1\.2-alpha\.2/iu.test(spec)) fail(section + '.' + name + ' contains an RC or alpha.2 specifier')
      if (/(?:github:|codeload\.github\.com|localhost|127\.0\.0\.1)/iu.test(spec)) fail(section + '.' + name + ' contains a forbidden source')
    }
  }
  if (manifest.devDependencies?.[OWNER_PACKAGE] !== '^0.1.1') fail(OWNER_PACKAGE + ' must be the semantic ^0.1.1 devDependency')
  if (manifest.dependencies?.[OWNER_PACKAGE] !== undefined || manifest.optionalDependencies?.[OWNER_PACKAGE] !== undefined || manifest.peerDependencies?.[OWNER_PACKAGE] !== undefined) fail(OWNER_PACKAGE + ' must not be a runtime dependency')
  for (const section of DEPENDENCY_SECTIONS) {
    const value = manifest[section]?.['dsh-model-switch']
    if (value !== undefined && value !== '^0.4.2') fail(section + '.dsh-model-switch must use ^0.4.2')
  }
  return dependencyMap(manifest)
}

function dependencyMap(manifest) {
  const result = new Map()
  for (const section of RUNTIME_SECTIONS) for (const [name, spec] of Object.entries(manifest[section] ?? {})) result.set(name, spec)
  return result
}

function verifyOwnerArtifact() {
  const file = process.env.DSH_PROVIDERS_UI_ARTIFACT
  const expected = process.env.DSH_PROVIDERS_UI_SHA256?.toLowerCase()
  if (!file || !expected) fail('set DSH_PROVIDERS_UI_ARTIFACT and DSH_PROVIDERS_UI_SHA256 to a validated owner tarball')
  if (!/^[0-9a-f]{64}$/u.test(expected)) fail('DSH_PROVIDERS_UI_SHA256 is not a SHA-256 digest')
  let stat
  try { stat = lstatSync(file) } catch (error) {
    if (isMissingPathError(error)) fail('owner artifact is missing: ' + file)
    throw error
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0) fail('owner artifact is not a real tarball')
  if (sha256(file) !== expected) fail('owner artifact SHA-256 mismatch')
  const { files } = archiveEntries(file)
  const manifest = archiveManifest(file)
  if (manifest.name !== OWNER_PACKAGE || manifest.version !== OWNER_VERSION) fail('owner artifact must be ' + OWNER_PACKAGE + '@' + OWNER_VERSION)
  if (!ownerArchiveNameMatches(file, manifest.name, manifest.version, expected)) fail('owner artifact filename does not match package@version or its SHA-256-qualified form')
  verifyManifestTargets(manifest, files, [], 'owner artifact')
  return { archive: file, files, manifest, identity: packageIdentity(manifest.name, manifest.version), sha256: expected }
}

function verifyFixtureRecord(file, record, manifest, files) {
  if (record === null || typeof record !== 'object') fail('fixture provenance record is invalid: ' + file)
  let stat
  try { stat = lstatSync(file) } catch (error) {
    if (isMissingPathError(error)) fail('fixture tarball is missing: ' + file)
    throw error
  }
  if (!stat.isFile() || stat.isSymbolicLink()) fail('fixture tarball is not a real file: ' + file)
  if (stat.size !== record.bytes) fail('fixture byte size mismatch for ' + file)
  if (sha256(file) !== String(record.sha256).toLowerCase()) fail('fixture SHA-256 mismatch for ' + file)
  const identity = packageIdentity(manifest.name, manifest.version)
  if (record.identity !== identity || record.package !== manifest.name || record.version !== manifest.version) fail('fixture package@version provenance mismatch for ' + file)
  if (basename(file) !== expectedArchiveName(manifest.name, manifest.version)) fail('fixture filename does not match package@version: ' + basename(file))
  if (manifest.name.startsWith('@deepseek-ai/dsh-') && manifest.version !== OFFICIAL_ALPHA1) fail('fixture is not official alpha.1: ' + identity)
  if (manifest.name.startsWith('@deepseek-ai/dsh-') && /(?:^|[-.])rc(?:[-.]|$)|0\.1\.2-alpha\.2/iu.test(JSON.stringify(manifest))) fail('DSH fixture manifest contains an RC or alpha.2 value: ' + identity)
  return { archive: file, files, manifest, identity, record }
}

function fixtureArchives(owner) {
  const provenance = readJson(join(FIXTURE_ROOT, 'PROVENANCE.json'))
  if (provenance.formatVersion !== 2) fail('alpha.1 provenance format is not version 2')
  if (provenance.source?.tag !== 'dsh-v0.1.2-alpha.1' || provenance.source?.commit !== 'cd5ef8148158c3a752a658978873241fdf8e2bbc') fail('alpha.1 provenance does not identify the official clean checkout')
  if (provenance.ownerArtifact?.package !== OWNER_PACKAGE || provenance.ownerArtifact?.version !== OWNER_VERSION) fail('alpha.1 provenance has no owner artifact identity')
  if (String(provenance.ownerArtifact?.sha256).toLowerCase() !== owner.sha256) fail('alpha.1 provenance owner SHA-256 does not match the pinned owner artifact')
  const records = provenance.tarballs
  if (records === null || typeof records !== 'object' || Array.isArray(records)) fail('alpha.1 provenance has no tarballs map')
  if (!Array.isArray(provenance.parentEdges)) fail('alpha.1 provenance has no parentEdges list')
  if (!Array.isArray(provenance.upstreamArtifactGaps)) fail('alpha.1 provenance has no upstreamArtifactGaps list')
  const directoryEntries = readdirSync(FIXTURE_TARBALL_ROOT)
  const names = directoryEntries.filter(name => name.endsWith('.tgz')).sort()
  if (directoryEntries.some(name => !name.endsWith('.tgz'))) fail('fixture tarball directory contains a non-tarball: ' + directoryEntries.find(name => !name.endsWith('.tgz')))
  const recordNames = Object.keys(records).sort()
  if (names.length !== recordNames.length || names.some((name, index) => name !== recordNames[index])) fail('fixture archives and provenance records are not the same set')
  const identities = new Map()
  const archives = []
  for (const name of names) {
    const archive = join(FIXTURE_TARBALL_ROOT, name)
    const { files } = archiveEntries(archive)
    const manifest = archiveManifest(archive)
    const item = verifyFixtureRecord(archive, records[name], manifest, files)
    if (identities.has(item.identity)) fail('duplicate fixture package@version: ' + item.identity)
    identities.set(item.identity, item)
    verifyManifestTargets(manifest, files, provenance.upstreamArtifactGaps, item.identity)
    archives.push(item)
  }
  const gaps = new Set()
  for (const gap of provenance.upstreamArtifactGaps) {
    if (gap === null || typeof gap !== 'object' || typeof gap.package !== 'string' || typeof gap.version !== 'string' || typeof gap.exportTarget !== 'string') fail('invalid upstream artifact gap')
    const key = gapKey(gap)
    if (gaps.has(key)) fail('duplicate upstream artifact gap: ' + key)
    gaps.add(key)
    const item = identities.get(packageIdentity(gap.package, gap.version))
    if (!item) fail('upstream artifact gap names an absent package: ' + key)
    if (targetPatternMatches(item.files, gap.exportTarget)) fail('upstream artifact gap target is present: ' + key)
  }
  verifyParentEdges(archives, identities, owner, provenance.parentEdges)
  return { archives, identities, provenance }
}

function simpleVersion(value) {
  const match = String(value).match(/(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?/u)
  return match === null ? undefined : [Number(match[1]), Number(match[2]), Number(match[3])]
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) if (left[index] !== right[index]) return left[index] - right[index]
  return 0
}

function versionSatisfies(version, spec) {
  const value = simpleVersion(version)
  if (value === undefined || typeof spec !== 'string') return false
  for (const branch of spec.split('||')) {
    const text = branch.trim()
    if (text === '*' || text === '') return true
    const comparators = text.split(/\s+/u).filter(Boolean)
    let okay = true
    for (const comparator of comparators) {
      const match = comparator.match(/^(>=|<=|>|<|=|~\s*|\^)?\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?/u)
      if (match === null) { okay = false; break }
      const operator = match[1]?.replaceAll(' ', '') ?? '='
      const bound = [Number(match[2]), Number(match[3] ?? 0), Number(match[4] ?? 0)]
      const comparison = compareVersions(value, bound)
      if (operator === '=' && comparison !== 0) okay = false
      if (operator === '>' && comparison <= 0) okay = false
      if (operator === '>=' && comparison < 0) okay = false
      if (operator === '<' && comparison >= 0) okay = false
      if (operator === '<=' && comparison > 0) okay = false
      if (operator === '^') {
        const compatible = bound[0] > 0 ? value[0] === bound[0] : bound[1] > 0 ? value[0] === 0 && value[1] === bound[1] : value[0] === 0 && value[1] === 0 && value[2] === bound[2]
        if (!compatible || comparison < 0) okay = false
      }
      if (operator === '~' && (value[0] !== bound[0] || value[1] !== bound[1] || comparison < 0)) okay = false
    }
    if (okay) return true
  }
  return false
}

function verifyParentEdges(archives, identities, owner, edges) {
  const known = new Map(identities)
  known.set(owner.identity, owner)
  const edgeKeys = new Set()
  for (const edge of edges) {
    if (edge === null || typeof edge !== 'object' || typeof edge.from !== 'string' || typeof edge.to !== 'string' || typeof edge.dependency !== 'string' || typeof edge.section !== 'string' || typeof edge.specifier !== 'string') fail('invalid parent edge')
    if (!known.has(edge.from) || !known.has(edge.to)) fail('parent edge references an absent package: ' + edge.from + ' -> ' + edge.to)
    if (!DEPENDENCY_SECTIONS.includes(edge.section)) fail('parent edge has an invalid dependency section: ' + edge.section)
    const parent = known.get(edge.from)
    if (parent.manifest[edge.section]?.[edge.dependency] !== edge.specifier) fail('parent edge does not match package manifest: ' + edge.from + ' -> ' + edge.dependency)
    const key = [edge.from, edge.section, edge.dependency, edge.specifier, edge.to].join('\0')
    if (edgeKeys.has(key)) fail('duplicate parent edge: ' + key)
    edgeKeys.add(key)
  }
  for (const item of archives) {
    if (!Array.isArray(item.record.parents)) fail('fixture record has no parents list: ' + item.identity)
    for (const parent of item.record.parents) {
      const key = [parent.from, parent.section, parent.dependency, parent.specifier, item.identity].join('\0')
      if (!edgeKeys.has(key)) fail('fixture parent record has no matching edge: ' + item.identity)
    }
  }
  for (const item of archives) {
    for (const section of DEPENDENCY_SECTIONS) {
      for (const [dependency, specifier] of Object.entries(item.manifest[section] ?? {})) {
        const candidates = [...known.values()].filter(candidate => candidate.manifest.name === dependency && versionSatisfies(candidate.manifest.version, specifier))
        if (dependency === OWNER_PACKAGE && item.manifest.name === 'dsh-model-switch') {
          if (!edges.some(edge => edge.from === item.identity && edge.dependency === dependency && edge.to === owner.identity)) fail('owner edge is not represented for dsh-model-switch')
          continue
        }
        if (candidates.length === 0) continue
        if (!edges.some(edge => edge.from === item.identity && edge.section === section && edge.dependency === dependency)) fail('fixture dependency has no parent edge: ' + item.identity + ' -> ' + dependency)
      }
    }
  }
}

function checkLock(manifest, owner) {
  const text = readFileSync(join(ROOT, 'pnpm-lock.yaml'), 'utf8')
  if (/(?:localhost|127\.0\.0\.1|codeload\.github\.com\/NOirBRight\/dsh-model-switch|github:[^\n]*dsh-model-switch|dsh-model-switch[^\n]*https:\/\/github)/iu.test(text)) fail('pnpm lock contains a forbidden registry or model-switch source')
  if (/0\.1\.2-alpha\.2|0\.1\.[01]-rc\./u.test(text)) fail('pnpm lock contains an RC or alpha.2 DSH resolution')
  if (!text.includes('@earendil-works/pi-ai@0.84.2') && !text.includes('earendil-works-pi-ai-0.84.2.tgz')) fail('pnpm lock does not contain @earendil-works/pi-ai@0.84.2')
  if (!text.includes('openai@6.40.0') && !text.includes('openai-6.40.0.tgz')) fail('pnpm lock does not contain openai@6.40.0')
  const ownerArchive = expectedArchiveName(OWNER_PACKAGE, OWNER_VERSION).replace(/\.tgz$/u, '-' + owner.sha256 + '.tgz')
  if (!text.includes(ownerArchive)) fail('pnpm lock does not pin the owner SHA-256-qualified artifact')
  if (!text.includes('integrity: ' + sha512Integrity(owner.archive))) fail('pnpm lock owner integrity does not match the pinned artifact')
  for (const name of Object.keys(manifest.peerDependencies ?? {}).concat(Object.keys(manifest.devDependencies ?? {})).filter(value => value.startsWith('@deepseek-ai/dsh-'))) {
    const quoted = name + "':\n        specifier: " + OFFICIAL_ALPHA1
    const plain = name + ':\n        specifier: ' + OFFICIAL_ALPHA1
    if (!text.includes(quoted) && !text.includes(plain)) fail('pnpm lock importer does not pin ' + name + ' to ' + OFFICIAL_ALPHA1)
  }
}

function parsePackReport(output) {
  const start = output.lastIndexOf('\n[')
  const json = start >= 0 ? output.slice(start + 1) : output.trim()
  let report
  try { report = JSON.parse(json) } catch (error) { fail('npm pack returned invalid JSON: ' + (error instanceof Error ? error.message : String(error))) }
  if (!Array.isArray(report) || report.length !== 1 || typeof report[0]?.filename !== 'string') fail('npm pack returned no single tarball report')
  return report[0]
}

function packTarget(destination) {
  mkdirSync(destination, { recursive: true })
  const report = parsePackReport(run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', destination], {
    packageManager: true,
    env: packageManagerEnv(CHILD_USERCONFIG, CHILD_STORE),
  }))
  const archive = join(destination, report.filename)
  let stat
  try { stat = lstatSync(archive) } catch (error) {
    if (isMissingPathError(error)) fail('npm pack did not create ' + archive)
    throw error
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0) fail('npm pack did not create a real tarball')
  return archive
}

function packageName(specifier) {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/')
  return specifier.split('/')[0]
}

function parsePackageSpecifier(specifier) {
  const name = packageName(specifier)
  return { name, subpath: specifier.slice(name.length).replace(/^\//u, '') }
}

function readManifest(directory) {
  return readJson(join(directory, 'package.json'))
}

function packageRootFrom(start, name) {
  let directory = resolve(start)
  while (true) {
    const candidate = join(directory, 'node_modules', ...name.split('/'))
    if (isFile(join(candidate, 'package.json'))) return candidate
    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }
  fail('installed package is not resolvable: ' + name + ' from ' + start)
}

function owningPackageRoot(file) {
  let directory = dirname(file)
  while (true) {
    if (isFile(join(directory, 'package.json'))) return directory
    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }
  fail('installed file has no package owner: ' + file)
}

function selectExport(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (const entry of value) {
      try { return selectExport(entry) } catch {
        // An unusable conditional branch is skipped so a later branch can resolve.
      }
    }
    fail('no usable conditional export')
  }
  if (value !== null && typeof value === 'object') {
    for (const key of ['import', 'node', 'browser', 'default', 'require']) if (value[key] !== undefined) return selectExport(value[key])
  }
  fail('no usable conditional export')
}

function exportValue(manifest, subpath) {
  if (manifest.exports === undefined) return manifest.module ?? manifest.main ?? './index.js'
  const exports = manifest.exports
  const key = subpath === '' ? '.' : './' + subpath
  if (typeof exports === 'string' || Array.isArray(exports)) return selectExport(exports)
  if (exports[key] !== undefined) return selectExport(exports[key])
  for (const [pattern, value] of Object.entries(exports)) {
    if (!pattern.includes('*')) continue
    const prefix = pattern.slice(0, pattern.indexOf('*'))
    const suffix = pattern.slice(pattern.indexOf('*') + 1)
    if (key.startsWith(prefix) && key.endsWith(suffix)) return selectExport(value).replaceAll('*', key.slice(prefix.length, key.length - suffix.length))
  }
  fail('package export is not declared: ' + key)
}

function resolveFile(root, value) {
  const target = value.startsWith('./') ? value.slice(2) : value
  if (target.includes('..') || target.startsWith('/')) fail('resolved package target is unsafe: ' + value)
  const candidates = [target, target + '.js', target + '.mjs', target + '.cjs', target + '.json', posix.join(target, 'index.js'), posix.join(target, 'index.mjs'), posix.join(target, 'index.cjs')]
  for (const candidate of candidates) {
    const file = join(root, ...candidate.split('/'))
    if (isFile(file)) return file
  }
  fail('installed package target is missing: ' + join(root, target))
}

function resolveInstalledSpecifier(specifier, importerFile) {
  const { name, subpath } = parsePackageSpecifier(specifier)
  const root = packageRootFrom(dirname(importerFile), name)
  const manifest = readManifest(root)
  const value = exportValue(manifest, subpath)
  return { file: resolveFile(root, value), root, manifest }
}

function staticSpecifiers(source) {
  const result = new Set()
  const readString = (start, quote) => {
    let value = ''
    for (let index = start + 1; index < source.length; index += 1) {
      if (source[index] === '\\') { value += source[index + 1] ?? ''; index += 1; continue }
      if (source[index] === quote) return { value, end: index + 1 }
      value += source[index]
    }
    return { value, end: source.length }
  }
  const skipTrivia = start => {
    let index = start
    while (index < source.length) {
      if (/\s/u.test(source[index])) { index += 1; continue }
      if (source.startsWith('//', index)) { const end = source.indexOf('\n', index + 2); index = end < 0 ? source.length : end + 1; continue }
      if (source.startsWith('/*', index)) { const end = source.indexOf('*/', index + 2); index = end < 0 ? source.length : end + 2; continue }
      break
    }
    return index
  }
  for (let index = 0; index < source.length;) {
    if (source.startsWith('//', index)) { const end = source.indexOf('\n', index + 2); index = end < 0 ? source.length : end + 1; continue }
    if (source.startsWith('/*', index)) { const end = source.indexOf('*/', index + 2); index = end < 0 ? source.length : end + 2; continue }
    if (source[index] === "'" || source[index] === '"') { index = readString(index, source[index]).end; continue }
    if (source.charCodeAt(index) === 96) { index = readString(index, String.fromCharCode(96)).end; continue }
    const word = source.slice(index).match(/^[A-Za-z_$][\w$]*/u)?.[0]
    if (word === 'from' || word === 'import' || word === 'require') {
      const next = skipTrivia(index + word.length)
      const open = word === 'from' ? next : source[next] === '(' ? skipTrivia(next + 1) : next
      if (source[open] === "'" || source[open] === '"') {
        const parsed = readString(open, source[open])
        result.add(parsed.value)
        index = parsed.end
        continue
      }
    }
    index += word?.length ?? 1
  }
  return result
}

function resolveRelativeSpecifier(specifier, importerFile) {
  const direct = resolve(dirname(importerFile), specifier)
  const candidates = [direct, direct + '.js', direct + '.mjs', direct + '.cjs', direct + '.json', join(direct, 'index.js'), join(direct, 'index.mjs'), join(direct, 'index.cjs')]
  for (const file of candidates) {
    if (isFile(file)) return file
  }
  fail('packed JS has an unresolved relative import ' + specifier + ' in ' + importerFile)
}

function collectPackageFiles(root) {
  const files = []
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue
      const file = join(directory, entry.name)
      if (entry.isDirectory()) visit(file)
      else if (entry.isFile() && /\.(?:cjs|js|mjs)$/u.test(entry.name)) files.push(file)
    }
  }
  visit(root)
  return files
}

function checkStaticClosure(installedRoot) {
  const seen = new Set()
  const queue = collectPackageFiles(installedRoot)
  while (queue.length > 0) {
    const file = queue.pop()
    const key = resolve(file)
    if (seen.has(key)) continue
    seen.add(key)
    const ownerRoot = owningPackageRoot(file)
    const ownerManifest = readManifest(ownerRoot)
    const source = readFileSync(file, 'utf8')
    for (const specifier of staticSpecifiers(source)) {
      if (specifier.startsWith('node:') || BUILTIN_MODULES.has(specifier)) continue
      if (specifier.startsWith('.') || specifier.startsWith('/')) {
        queue.push(resolveRelativeSpecifier(specifier, file))
        continue
      }
      const { name, subpath } = parsePackageSpecifier(specifier)
      if (name === ownerManifest.name) {
        queue.push(resolveFile(ownerRoot, exportValue(ownerManifest, subpath)))
        continue
      }
      if (name === OWNER_PACKAGE) fail('packed JS retains a runtime owner import: ' + specifier)
      if (!RUNTIME_SECTIONS.some(section => Object.prototype.hasOwnProperty.call(ownerManifest[section] ?? {}, name))) fail('runtime package imports undeclared package ' + specifier + ' from ' + ownerManifest.name)
      const resolved = resolveInstalledSpecifier(specifier, file)
      queue.push(resolved.file)
    }
  }
}

function installedFiles(root) {
  const files = new Set()
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue
      const file = join(directory, entry.name)
      if (entry.isDirectory()) visit(file)
      else if (entry.isSymbolicLink()) fail('installed package contains a symbolic link: ' + file)
      else if (entry.isFile()) files.add(relative(root, file).split(sep).join('/'))
    }
  }
  visit(root)
  return files
}

function chooseFixture(name, specifier, byName) {
  const candidates = (byName.get(name) ?? []).filter(item => versionSatisfies(item.manifest.version, specifier))
  candidates.sort((left, right) => compareVersions(simpleVersion(right.manifest.version), simpleVersion(left.manifest.version)))
  return candidates[0]
}

function installOffline(targetArchive, fixtureSet, owner, work) {
  const consumer = join(work, 'consumer')
  const cache = join(work, 'fresh-cache')
  const store = join(work, 'fresh-store')
  const userconfig = join(work, 'empty-userconfig')
  mkdirSync(consumer, { recursive: true })
  mkdirSync(cache, { recursive: true })
  mkdirSync(store, { recursive: true })
  writeFileSync(userconfig, '')
  if (readdirSync(cache).length !== 0) fail('consumer pnpm cache was not fresh')
  if (readdirSync(store).length !== 0) fail('consumer pnpm store was not fresh')
  const byName = new Map()
  for (const item of fixtureSet.archives) {
    const list = byName.get(item.manifest.name) ?? []
    list.push(item)
    byName.set(item.manifest.name, list)
  }
  const direct = new Map([[PACKAGE_NAME, { archive: targetArchive, manifest: { name: PACKAGE_NAME, version: '0.0.0' } }], [OWNER_PACKAGE, owner]])
  const addPeer = (name, specifier) => {
    const item = chooseFixture(name, specifier, byName)
    if (item !== undefined && !direct.has(name)) direct.set(name, item)
  }
  for (const [name, specifier] of Object.entries(readJson(join(ROOT, 'package.json')).peerDependencies ?? {})) addPeer(name, specifier)
  for (const [name] of byName) if (name !== OWNER_PACKAGE && !direct.has(name)) {
    const item = chooseFixture(name, '*', byName)
    if (item !== undefined) direct.set(name, item)
  }
  const pending = [...direct.values()]
  for (let index = 0; index < pending.length; index += 1) {
    const parent = pending[index]
    for (const [name, specifier] of Object.entries(parent.manifest.peerDependencies ?? {})) {
      if (direct.has(name)) continue
      const item = chooseFixture(name, specifier, byName)
      if (item !== undefined) { direct.set(name, item); pending.push(item) }
    }
  }
  const overrides = {}
  const byFixtureName = new Map()
  for (const item of fixtureSet.archives) {
    const list = byFixtureName.get(item.manifest.name) ?? []
    list.push(item)
    byFixtureName.set(item.manifest.name, list)
  }
  for (const [name, list] of byFixtureName) if (list.length === 1) overrides[name] = 'file:' + list[0].archive
  for (const edge of fixtureSet.provenance.parentEdges) {
    const child = fixtureSet.identities.get(edge.to)
    if (child !== undefined) overrides[edge.from + '>' + edge.dependency] = 'file:' + child.archive
  }
  overrides['dsh-model-switch@0.4.2>' + OWNER_PACKAGE] = 'file:' + owner.archive
  const packageJson = {
    name: 'dsh-llm-codex-pack-consumer',
    private: true,
    type: 'module',
    dependencies: Object.fromEntries([...direct].map(([name, item]) => [name, 'file:' + item.archive])),
    pnpm: { autoInstallPeers: false, overrides },
  }
  writeFileSync(join(consumer, 'package.json'), JSON.stringify(packageJson, null, 2) + '\n')
  run('pnpm', ['install', '--offline', '--ignore-scripts', '--strict-peer-dependencies', '--registry=' + INVALID_REGISTRY, '--config.audit=false', '--config.fund=false', '--config.auto-install-peers=false', '--store-dir', store], {
    cwd: consumer,
    packageManager: true,
    env: packageManagerEnv(userconfig, store, cache),
  })
  const installedRoot = join(consumer, 'node_modules', PACKAGE_NAME)
  if (!statSync(join(installedRoot, 'package.json')).isFile()) fail('offline pnpm install did not produce the installed plugin')
  const installedOwner = join(consumer, 'node_modules', OWNER_PACKAGE)
  if (!statSync(join(installedOwner, 'package.json')).isFile()) fail('offline pnpm install did not consume the owner artifact')
  return { consumer, installedRoot }
}

function smokePublicFactories(consumer) {
  const file = join(consumer, 'factory-smoke.mjs')
  const script = [
    "if (process.env.NODE_PATH !== '') throw new Error('NODE_PATH was not cleared')",
    "if (process.env.NODE_OPTIONS !== '') throw new Error('NODE_OPTIONS was not cleared')",
    "import { createRequire } from 'node:module'",
    "const require = createRequire(import.meta.url)",
    "const host = await import('dsh-llm-codex')",
    "if (typeof host.apply !== 'function' || typeof host.CodexAdapter !== 'function') throw new Error('public Host factory missing')",
    "const invariant = await import('dsh-llm-codex/invariant')",
    "if (typeof invariant.apply !== 'function') throw new Error('public invariant factory missing')",
    "let registration",
    "globalThis.window = { __ModuleLoader__: { load(value) { registration = value } } }",
    "await import('dsh-llm-codex/client')",
    "if (registration?.id !== 'dsh-llm-codex' || typeof registration.factory !== 'function') throw new Error('public browser ModuleLoader registration missing')",
    "const client = registration.factory(require)",
    "if (typeof client.apply !== 'function' || client.name !== 'dsh-llm-codex-client') throw new Error('public browser factory missing')",
    "console.log('public Host/invariant/browser factories passed')",
  ].join('\n') + '\n'
  writeFileSync(file, script)
  run(process.execPath, [file], { cwd: consumer })
}

let work
let primaryError
try {
  initializeChildEnvironment()
  checkChildEnvironment()
  const owner = verifyOwnerArtifact()
  const fixtureSet = fixtureArchives(owner)
  checkLock(readJson(join(ROOT, 'package.json')), owner)
  work = mkdtempSync(join(tmpdir(), 'dsh-llm-codex-pack-'))
  const targetArchive = packTarget(join(work, 'plugin-pack'))
  const { files: packedFiles } = archiveEntries(targetArchive)
  const packedManifest = archiveManifest(targetArchive)
  checkManifest(packedManifest, packedFiles)
  for (const required of REQUIRED_FILES) if (!packedFiles.has(required)) fail('packed plugin is missing ' + required)
  if ([...packedFiles].some(file => file.startsWith('src/') || file.startsWith('tests/') || file.startsWith('scripts/') || file.startsWith('node_modules/'))) fail('packed plugin contains source, test, script, or node_modules files')
  const installed = installOffline(targetArchive, fixtureSet, owner, work)
  const installedManifest = readManifest(installed.installedRoot)
  const installedSet = installedFiles(installed.installedRoot)
  if (packedFiles.size !== installedSet.size || [...packedFiles].some(file => !installedSet.has(file))) {
    console.log('packed-only files:', [...packedFiles].filter(file => !installedSet.has(file)))
    console.log('installed-only files:', [...installedSet].filter(file => !packedFiles.has(file)))
    fail('installed plugin files differ from the packed tarball')
  }
  checkManifest(installedManifest, installedSet)
  checkStaticClosure(installed.installedRoot)
  smokePublicFactories(installed.consumer)
  console.log('pack check passed: fixture tar parity, package@version records, parent edges, all export targets, fresh offline pnpm closure, and Host/invariant/browser factories verified')
} catch (error) {
  primaryError = error
  throw error
} finally {
  const cleanupTargets = [...(work === undefined ? [] : [{ path: work, label: 'pack work tree' }]), { path: CHILD_ENV_ROOT, label: 'child environment tree' }]
  const cleanupErrors = []
  for (const target of cleanupTargets) {
    try {
      cleanupTemporaryPath(target.path, target.label)
    } catch (error) {
      cleanupErrors.push(error)
    }
  }
  if (cleanupErrors.length !== 0) {
    if (primaryError !== undefined) {
      for (const error of cleanupErrors) console.error('pack gate cleanup failed after primary error: ' + errorText(error))
    } else {
      throw cleanupErrors[0]
    }
  }
}
