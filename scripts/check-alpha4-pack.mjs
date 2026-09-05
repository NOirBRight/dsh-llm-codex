#!/usr/bin/env node

/* Portable Alpha.4 pack gate shared by the plugin migrations. */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(process.env.DSH_ALPHA4_PLUGIN_ROOT ?? fileURLToPath(new URL('..', import.meta.url)))
const FIXTURE_ROOT = join(ROOT, 'fixtures', 'alpha4')
const TARBALL_ROOT = join(FIXTURE_ROOT, 'tarballs')
const ALPHA4 = '0.1.2-alpha.4'
const RC1 = '0.1.2-rc.1'
const CORDIS = '4.0.2'
const CORDIS_RANGE = '>=4.0.2 <5.0.0'
const OFFICIAL_TAG = 'dsh-v0.1.2-alpha.4'
const OFFICIAL_COMMIT = '4e84901e6471b79ec0338099867ebb4606d12bb5'
const INVALID_REGISTRY = 'http://127.0.0.1:9'
const BUILTINS = new Set([...builtinModules, ...builtinModules.map(value => 'node:' + value)])
const PACKAGE_MANAGER_KEYS = new Set([
  'npm_config_userconfig', 'pnpm_config_userconfig', 'npm_config_globalconfig', 'pnpm_config_globalconfig',
  'npm_config_registry', 'pnpm_config_registry', 'npm_config_store_dir', 'pnpm_config_store_dir',
  'npm_config_cache', 'pnpm_config_cache', 'npm_config_auto_install_peers', 'pnpm_config_auto_install_peers',
])
const INHERITED_KEYS = new Set(['PATH', 'HOME', 'USER', 'LANG', 'TMP', 'TMPDIR', 'TEMP', 'CI', 'SystemRoot', 'WINDIR', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'COMSPEC', 'ComSpec', 'PATHEXT'])

function fail(message) { throw new Error('Alpha.4 pack gate: ' + message) }
function readJson(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')) }
  catch (error) { fail('invalid JSON in ' + file + ': ' + String(error)) }
}
function digest(file, algorithm = 'sha256') { return createHash(algorithm).update(readFileSync(file)).digest('hex') }
function output(value) { return typeof value === 'string' ? value : value == null ? '' : Buffer.from(value).toString('utf8') }
function childEnv(packageManager = false) {
  const env = {}
  for (const key of INHERITED_KEYS) if (typeof process.env[key] === 'string') env[key] = process.env[key]
  env.NODE_PATH = ''
  env.NODE_OPTIONS = ''
  if (packageManager) {
    env.npm_config_userconfig = join(workRoot, 'empty.npmrc')
    env.pnpm_config_userconfig = env.npm_config_userconfig
    env.npm_config_globalconfig = join(workRoot, 'empty.globalrc')
    env.pnpm_config_globalconfig = env.npm_config_globalconfig
    env.npm_config_registry = INVALID_REGISTRY
    env.pnpm_config_registry = INVALID_REGISTRY
    env.npm_config_store_dir = join(workRoot, 'store')
    env.pnpm_config_store_dir = env.npm_config_store_dir
    env.npm_config_cache = join(workRoot, 'cache')
    env.pnpm_config_cache = env.npm_config_cache
    env.npm_config_auto_install_peers = 'false'
    env.pnpm_config_auto_install_peers = 'false'
  }
  return env
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    env: childEnv(options.packageManager === true),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 128 * 1024 * 1024,
  })
  const text = [output(result.stdout), output(result.stderr)].filter(Boolean).join('\n').trim()
  if (result.error || result.status !== 0) fail(command + ' ' + args.join(' ') + (text ? ':\n' + text : ''))
  return output(result.stdout)
}
function archiveManifest(file) {
  try { return JSON.parse(run('tar', ['-xOzf', file, 'package/package.json'])) }
  catch (error) { fail('archive has no package/package.json: ' + file + ' (' + String(error) + ')') }
}
function archiveFiles(file) {
  const files = new Set()
  for (const entry of run('tar', ['-tzf', file]).split('\n').filter(Boolean)) {
    if (entry === 'package' || entry === 'package/') continue
    if (!entry.startsWith('package/')) fail('archive contains an entry outside package/: ' + file)
    const value = entry.slice('package/'.length)
    if (!value || value.endsWith('/')) continue
    if (value.startsWith('/') || value.includes('..') || value.includes('\0') || value.startsWith('node_modules/')) fail('archive has unsafe member: ' + file + ' -> ' + value)
    if (files.has(value)) fail('archive contains duplicate member: ' + file + ' -> ' + value)
    files.add(value)
  }
  if (!files.has('package.json')) fail('archive has no package/package.json: ' + file)
  return files
}
function identity(name, version) { return name + '@' + version }
function archiveName(name, version) { return (name.startsWith('@') ? name.slice(1).replaceAll('/', '-') : name) + '-' + version + '.tgz' }
function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/u.exec(String(value))
  return match === null ? undefined : { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), pre: match[4] ?? '' }
}
function compareVersion(left, right) {
  const a = parseVersion(left); const b = parseVersion(right)
  if (!a || !b) return 0
  for (const key of ['major', 'minor', 'patch']) if (a[key] !== b[key]) return a[key] - b[key]
  return a.pre === b.pre ? 0 : a.pre === '' ? 1 : b.pre === '' ? -1 : a.pre < b.pre ? -1 : 1
}
function satisfies(version, range) {
  if (range === undefined || range === null || range === '*' || range === 'latest') return true
  const value = parseVersion(version)
  if (!value || typeof range !== 'string') return false
  return range.trim().split('||').some(arm => arm.trim().split(/\s+/u).filter(Boolean).every(token => {
    const match = /^(\^|~|>=|<=|>|<|=)?\s*(\d+)(?:\.(\d+|x|X|\*))?(?:\.(\d+|x|X|\*))?(?:-([0-9A-Za-z.-]+))?$/u.exec(token)
    if (!match) return false
    const major = Number(match[2]); const minor = match[3] === undefined || /^[xX*]$/u.test(match[3]) ? 0 : Number(match[3]); const patch = match[4] === undefined || /^[xX*]$/u.test(match[4]) ? 0 : Number(match[4])
    const bound = major + '.' + minor + '.' + patch + (match[5] === undefined ? '' : '-' + match[5])
    const comparison = compareVersion(version, bound)
    if (match[1] === '>') return comparison > 0
    if (match[1] === '>=') return comparison >= 0
    if (match[1] === '<') return comparison < 0
    if (match[1] === '<=') return comparison <= 0
    if (match[1] === '=') return comparison === 0
    if (match[1] === '^') return comparison >= 0 && compareVersion(version, major > 0 ? (major + 1) + '.0.0' : minor > 0 ? '0.' + (minor + 1) + '.0' : '0.0.' + (patch + 1)) < 0
    if (match[1] === '~') return comparison >= 0 && value.major === major && value.minor === minor
    if (match[3] === undefined || /^[xX*]$/u.test(match[3])) return value.major === major
    if (match[4] === undefined || /^[xX*]$/u.test(match[4])) return value.major === major && value.minor === minor
    return comparison === 0
  }))
}
function dependencyEntries(manifest) {
  return ['dependencies', 'optionalDependencies', 'peerDependencies'].flatMap(section => Object.entries(manifest[section] ?? {}).map(([name, range]) => ({ section, name, range })))
}
function checkAlpha4Manifest(manifest, label) {
  const capturedOfficialWorkspace = label.startsWith('fixture ') && manifest.name.startsWith('@deepseek-ai/dsh-')
  for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies', 'devDependencies']) {
    for (const [name, range] of Object.entries(manifest[section] ?? {})) {
      if (typeof range !== 'string') fail(label + ' has non-string ' + section + '.' + name)
      if (name.startsWith('@deepseek-ai/dsh-') && range !== ALPHA4 && !(satisfies(ALPHA4, range) && satisfies(RC1, range)) && !(capturedOfficialWorkspace && range === 'workspace:^')) fail(label + ' has a DSH range that excludes Alpha.4 or rc.1: ' + name + ' ' + range)
      // Cordis plugins published from the upstream monorepo retain their
      // workspace peer range; the harness packages and this plugin must pin
      // the runtime Cordis version itself.
      if (name === '@deepseek-ai/cordis' && !manifest.name.startsWith('@deepseek-ai/cordis-') && range !== CORDIS && range !== CORDIS_RANGE && !(capturedOfficialWorkspace && range === 'workspace:^')) fail(label + ' has an unsupported Cordis range ' + range)
      if (/(?:alpha\.1|alpha\.2|alpha\.3|dsh-v0\.1\.2-alpha\.[123])/iu.test(range)) fail(label + ' contains an old Alpha dependency: ' + name + ' ' + range)
    }
  }
}
function verifyFixture() {
  const provenance = readJson(join(FIXTURE_ROOT, 'provenance.json'))
  if (provenance.format !== 1) fail('fixture provenance format is not 1')
  if (provenance.officialCheckout?.tag !== OFFICIAL_TAG || provenance.officialCheckout?.commit !== OFFICIAL_COMMIT) fail('fixture does not identify the official Alpha.4 checkout')
  if (!Array.isArray(provenance.packages) || !Array.isArray(provenance.edges)) fail('fixture provenance has no package or edge list')
  const root = readJson(join(ROOT, 'package.json'))
  const rootArchiveName = archiveName(root.name, root.version)
  const names = readdirSync(TARBALL_ROOT).filter(value => value.endsWith('.tgz') && value !== rootArchiveName).sort()
  const records = [...provenance.packages].sort((left, right) => String(left.file).localeCompare(String(right.file)))
  if (names.length !== records.length || names.some((name, index) => name !== records[index].file)) fail('fixture archives and provenance records differ')
  const byIdentity = new Map()
  for (const record of records) {
    const file = join(TARBALL_ROOT, record.file)
    const stat = lstatSync(file)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== record.bytes) fail('invalid fixture archive: ' + file)
    if (digest(file) !== String(record.sha256).toLowerCase()) fail('fixture SHA-256 mismatch: ' + file)
    const manifest = archiveManifest(file)
    archiveFiles(file)
    if (record.name !== manifest.name || record.version !== manifest.version || record.file !== archiveName(manifest.name, manifest.version)) fail('fixture identity mismatch: ' + file)
    checkAlpha4Manifest(manifest, 'fixture ' + record.file)
    if (manifest.name.startsWith('@deepseek-ai/dsh-') && manifest.version !== ALPHA4) fail('fixture contains old DSH package: ' + record.file)
    if (manifest.name === '@deepseek-ai/cordis' && manifest.version !== CORDIS) fail('fixture contains old Cordis package: ' + record.file)
    const key = identity(manifest.name, manifest.version)
    if (byIdentity.has(key)) fail('duplicate fixture identity: ' + key)
    byIdentity.set(key, { file, manifest, record })
  }
  const rootArchive = join(TARBALL_ROOT, rootArchiveName)
  if (existsSync(rootArchive)) {
    const stat = lstatSync(rootArchive)
    const manifest = archiveManifest(rootArchive)
    if (!stat.isFile() || stat.isSymbolicLink() || manifest.name !== root.name || manifest.version !== root.version) fail('self root fixture archive has the wrong identity')
    archiveFiles(rootArchive)
  }
  const rootKeys = new Set(Array.isArray(provenance.roots) ? provenance.roots : [])
  for (const edge of provenance.edges) {
    if ((!rootKeys.has(edge.from) && !byIdentity.has(edge.from)) || !byIdentity.has(edge.to)) fail('fixture edge points outside package set: ' + JSON.stringify(edge))
  }
  const rootKey = identity(root.name, root.version)
  for (const { section, name, range } of dependencyEntries(root)) {
    if (root.peerDependenciesMeta?.[name]?.optional === true && !(provenance.edges ?? []).some(edge => edge.from === rootKey && edge.dependency === name)) continue
    const edge = provenance.edges.find(value => value.from === rootKey && value.dependency === name && value.section === section)
    if (!edge) fail('root dependency has no fixture edge: ' + name)
    const child = byIdentity.get(edge.to)
    if (!child || !satisfies(child.manifest.version, range.startsWith('workspace:') ? ALPHA4 : range)) fail('fixture edge does not satisfy root dependency: ' + name + ' ' + range)
  }
  return { provenance, byIdentity }
}
function packTarget() {
  const destination = join(workRoot, 'packed')
  mkdirSync(destination, { recursive: true })
  const parsed = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', destination]))
  if (!Array.isArray(parsed) || parsed.length !== 1 || typeof parsed[0].filename !== 'string') fail('npm pack returned no archive')
  return join(destination, parsed[0].filename)
}
function installOffline(target, fixture) {
  const consumer = join(workRoot, 'consumer')
  mkdirSync(consumer, { recursive: true })
  mkdirSync(join(workRoot, 'cache'), { recursive: true }); mkdirSync(join(workRoot, 'store'), { recursive: true })
  writeFileSync(join(workRoot, 'empty.npmrc'), ''); writeFileSync(join(workRoot, 'empty.globalrc'), '')
  const root = readJson(join(ROOT, 'package.json'))
  const direct = new Map([[root.name, target]])
  for (const { name, range } of dependencyEntries(root)) {
    const candidates = [...fixture.byIdentity.values()].filter(item => item.manifest.name === name && satisfies(item.manifest.version, range.startsWith('workspace:') ? ALPHA4 : range)).sort((a, b) => compareVersion(b.manifest.version, a.manifest.version))
    if (candidates[0]) direct.set(name, candidates[0].file)
  }
  for (const item of fixture.byIdentity.values()) if (!direct.has(item.manifest.name)) {
    const current = [...fixture.byIdentity.values()].filter(value => value.manifest.name === item.manifest.name).sort((a, b) => compareVersion(b.manifest.version, a.manifest.version))[0]
    if (current) direct.set(item.manifest.name, current.file)
  }
  const overrides = {}
  for (const item of fixture.byIdentity.values()) overrides[item.manifest.name + '@' + item.manifest.version] = 'file:' + item.file
  for (const edge of fixture.provenance.edges) {
    const child = fixture.byIdentity.get(edge.to)
    if (child) overrides[edge.from + '>' + edge.dependency] = 'file:' + child.file
  }
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: root.name + '-pack-consumer', private: true, type: 'module', dependencies: Object.fromEntries([...direct].map(([name, file]) => [name, 'file:' + file])), pnpm: { autoInstallPeers: false, overrides } }, null, 2) + '\n')
  run('pnpm', ['install', '--offline', '--ignore-scripts', '--config.strict-peer-dependencies=false', '--registry=' + INVALID_REGISTRY, '--config.audit=false', '--config.fund=false', '--config.auto-install-peers=false', '--store-dir', join(workRoot, 'store')], { cwd: consumer, packageManager: true })
  const installed = join(consumer, 'node_modules', root.name)
  if (!statSync(join(installed, 'package.json')).isFile()) fail('offline install did not produce the plugin')
  return { consumer, installed }
}
function smoke(consumer, root) {
  const file = join(consumer, 'smoke.mjs')
  const exports = Object.keys(root.exports ?? {})
  const lines = ["if (process.env.NODE_PATH || process.env.NODE_OPTIONS) throw new Error('unsafe Node environment')", "const host = await import('" + root.name + "')", "if (!host || (typeof host.apply !== 'function' && typeof host.default !== 'function' && typeof host.name !== 'string')) throw new Error('public plugin export missing')"]
  if (exports.includes('./invariant')) lines.push("const invariant = await import('" + root.name + "/invariant')", "if (!Object.values(invariant).some(value => typeof value === 'function')) throw new Error('invariant export missing a callable entry point')")
  if (exports.includes('./client')) lines.push("globalThis.window = { __ModuleLoader__: { load(value) { globalThis.__dshModule = value } } }", "await import('" + root.name + "/client')", "if (typeof globalThis.__dshModule?.factory !== 'function') throw new Error('client registration missing')")
  writeFileSync(file, lines.join('\n') + '\n')
  run(process.execPath, [file], { cwd: consumer })
}

let workRoot
try {
  workRoot = mkdtempSync(join(tmpdir(), 'dsh-alpha4-pack-'))
  const root = readJson(join(ROOT, 'package.json'))
  checkAlpha4Manifest(root, 'source package')
  const fixture = verifyFixture()
  const archive = packTarget()
  const packedManifest = archiveManifest(archive)
  const packedFiles = archiveFiles(archive)
  if (packedManifest.name !== root.name || packedManifest.version !== root.version) fail('packed identity differs from source package')
  checkAlpha4Manifest(packedManifest, 'packed package')
  if ([...packedFiles].some(value => /^(?:src|tests|scripts|fixtures|node_modules)\//u.test(value))) fail('packed artifact contains source, tests, scripts, fixtures, or node_modules')
  const installed = installOffline(archive, fixture)
  smoke(installed.consumer, root)
  console.log('Dual-runtime pack check passed: Alpha.4 fixture provenance, forward-compatible DSH ranges, fresh offline install, and public exports')
} finally {
  if (typeof workRoot === 'string') rmSync(workRoot, { recursive: true, force: true })
}
