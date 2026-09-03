#!/usr/bin/env node

/* Generate a portable Alpha.4 fixture graph from the official tarballs and
 * the registry archives already captured by the Provider UI gate. */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { builtinModules } from 'node:module'
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(process.env.DSH_ALPHA4_PLUGIN_ROOT ?? fileURLToPath(new URL('..', import.meta.url)))
const FIXTURE_ROOT = join(ROOT, 'fixtures', 'alpha4')
const TARBALL_ROOT = join(FIXTURE_ROOT, 'tarballs')
const OFFICIAL_ROOT = resolve(process.env.DSH_ALPHA4_CLEAN_CHECKOUT ?? '/home/noirbright/.local/opt/dsh-staging/dsh-v0.1.2-alpha.4-4e84901e6471')
const OFFICIAL_TARBALL_ROOT = resolve(process.env.DSH_ALPHA4_TARBALL_ROOT ?? '/home/noirbright/.local/opt/dsh-staging/alpha4-tarballs')
const REGISTRY_ROOT = resolve(process.env.DSH_ALPHA4_REGISTRY_ROOT ?? '/home/noirbright/Workstation/dsh-llm-ollama/fixtures/alpha4/tarballs')
const OLD_ROOT = join(ROOT, 'fixtures', 'alpha1', 'tarballs')
const WORKSTATION_ROOT = resolve(process.env.DSH_ALPHA4_WORKSTATION_ROOT ?? '/home/noirbright/Workstation')
const OWNER_ROOT = resolve(process.env.DSH_ALPHA4_OWNER_ROOT ?? '/home/noirbright/Workstation/dsh-llm-providers-ui')
const MODEL_ROOT = resolve(process.env.DSH_ALPHA4_MODEL_ROOT ?? '/home/noirbright/Workstation/dsh-model-switch')
const ALPHA4 = '0.1.2-alpha.4'
const TAG = 'dsh-v0.1.2-alpha.4'
const COMMIT = '4e84901e6471b79ec0338099867ebb4606d12bb5'
const REPOSITORY = 'https://github.com/deepseek-ai/deepseek-harness.git'
const BUILTINS = new Set([...builtinModules, ...builtinModules.map(name => 'node:' + name)])
const DEPENDENCY_FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies']
const IMPORT_RE = /\b(?:import|export)\s+(?:(?:[^;\n]*?)\s+from\s+)?['"]([^'"]+)['"]/gu
const DYNAMIC_IMPORT_RE = /\b(?:import|require)\(\s*['"]([^'"]+)['"]\s*\)/gu

function fail(message) { throw new Error('Alpha.4 fixture preparation failed: ' + message) }
function run(command, args, options = {}) {
  try { return execFileSync(command, args, { cwd: options.cwd ?? ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() }
  catch (error) { fail(command + ' ' + args.join(' ') + ': ' + String(error?.stderr ?? error?.message ?? error)) }
}
function json(file, label = file) {
  try { return JSON.parse(readFileSync(file, 'utf8')) }
  catch (error) { fail(label + ' is invalid: ' + String(error)) }
}
function manifestOf(archive) {
  return jsonText(run('tar', ['-xOzf', archive, 'package/package.json']), archive + ' package.json')
}
function jsonText(text, label) { try { return JSON.parse(text) } catch (error) { fail(label + ' is invalid: ' + String(error)) } }
function packageRoot(name) { return name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0] }
function packageKey(name, version) { return name + '@' + version }
function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/u.exec(String(value))
  return match === null ? undefined : { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), pre: match[4] ?? '' }
}
function compareVersion(left, right) {
  const a = parseVersion(left); const b = parseVersion(right)
  if (a === undefined || b === undefined) return 0
  for (const field of ['major', 'minor', 'patch']) if (a[field] !== b[field]) return a[field] - b[field]
  if (a.pre === b.pre) return 0
  if (a.pre === '') return 1
  if (b.pre === '') return -1
  return a.pre < b.pre ? -1 : 1
}
function satisfies(version, range) {
  if (typeof range !== 'string') return false
  const value = parseVersion(version)
  if (value === undefined) return false
  const normal = range.trim().replace(/(>=|<=|>|<|=)[ \t]+/gu, '$1')
  if (normal === '' || normal === '*' || normal === 'latest') return true
  return normal.split('||').some(arm => arm.trim().split(/\s+/u).filter(Boolean).every(token => {
    const match = /^(\^|~|>=|<=|>|<|=)?\s*(\d+)(?:\.(\d+|x|X|\*))?(?:\.(\d+|x|X|\*))?(?:-([0-9A-Za-z.-]+))?$/u.exec(token)
    if (match === null) return false
    const bound = (match[2] + '.' + (match[3] === undefined || /^[xX*]$/u.test(match[3]) ? 0 : match[3]) + '.' + (match[4] === undefined || /^[xX*]$/u.test(match[4]) ? 0 : match[4]) + (match[5] === undefined ? '' : '-' + match[5]))
    const comparison = compareVersion(version, bound)
    if (match[1] === '>') return comparison > 0
    if (match[1] === '>=') return comparison >= 0
    if (match[1] === '<') return comparison < 0
    if (match[1] === '<=') return comparison <= 0
    if (match[1] === '=') return comparison === 0
    if (match[1] === '^') {
      const base = parseVersion(bound)
      const upper = base.major > 0 ? [base.major + 1, 0, 0] : base.minor > 0 ? [0, base.minor + 1, 0] : [0, 0, base.patch + 1]
      return comparison >= 0 && compareVersion(version, upper.join('.')) < 0
    }
    if (match[1] === '~') {
      const base = parseVersion(bound)
      return comparison >= 0 && value.major === base.major && value.minor === base.minor
    }
    if (match[3] === undefined || /^[xX*]$/u.test(match[3])) return value.major === Number(match[2])
    if (match[4] === undefined || /^[xX*]$/u.test(match[4])) return value.major === Number(match[2]) && value.minor === Number(match[3])
    return comparison === 0
  }))
}
function resolveWorkspace(name, range) {
  if (typeof range !== 'string' || !range.startsWith('workspace:')) return range
  const operator = range.slice('workspace:'.length)
  const version = name.startsWith('@deepseek-ai/') ? ALPHA4 : '1.0.0'
  return operator === '*' ? '*' : (operator === '~' ? '~' : '^') + version
}
function hash(file, algorithm, encoding = 'hex') { return createHash(algorithm).update(readFileSync(file)).digest(encoding) }
function archiveName(name, version) { return (name.startsWith('@') ? name.slice(1).replaceAll('/', '-') : name) + '-' + version + '.tgz' }
function listArchives(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory).filter(file => file.endsWith('.tgz')).map(file => join(directory, file))
}
function assertArchive(file) {
  const stat = lstatSync(file)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0) fail('archive is not a regular file: ' + file)
  const manifest = manifestOf(file)
  if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') fail('archive has no package identity: ' + file)
  return { file, manifest }
}
function runtimeImports(file, ownName) {
  const imports = new Set()
  // Do not extract the entire archive: a few registry tarballs contain
  // cross-directory hard links that GNU tar cannot materialize on all hosts.
  // Reading JavaScript members directly keeps discovery deterministic and
  // avoids creating a temporary tree.
  const entries = run('tar', ['-tzf', file]).split('\n').filter(entry => /\.(?:c|m)?js$/u.test(entry))
  for (const entry of entries) {
    let source
    try { source = run('tar', ['-xOzf', file, entry]) }
    catch { continue }
    for (const pattern of [IMPORT_RE, DYNAMIC_IMPORT_RE]) for (const match of source.matchAll(pattern)) imports.add(packageRoot(match[1]))
  }
  for (const name of [...imports]) if (name === ownName || name.startsWith('.') || name.startsWith('/') || name.startsWith('node:') || BUILTINS.has(name)) imports.delete(name)
  return imports
}

if (!existsSync(join(ROOT, 'package.json'))) fail('root package.json is missing')
if (run('git', ['status', '--porcelain'], { cwd: OFFICIAL_ROOT }) !== '') fail('official checkout is dirty')
if (run('git', ['rev-parse', 'HEAD'], { cwd: OFFICIAL_ROOT }) !== COMMIT) fail('official checkout revision is not ' + COMMIT)
if (run('git', ['describe', '--exact-match', '--tags', 'HEAD'], { cwd: OFFICIAL_ROOT }) !== TAG) fail('official checkout tag is not ' + TAG)

const pools = new Map()
function add(item) {
  const key = packageKey(item.manifest.name, item.manifest.version)
  const existing = pools.get(item.manifest.name) ?? []
  const duplicate = existing.findIndex(value => packageKey(value.manifest.name, value.manifest.version) === key)
  if (duplicate < 0) existing.push(item)
  else {
    const oldText = JSON.stringify(existing[duplicate].manifest)
    const newText = JSON.stringify(item.manifest)
    // Prefer registry-normalized Alpha.4 archives over raw monorepo packs
    // whose manifests still contain `workspace:^` peer ranges.
    if (oldText.includes('workspace:') && !newText.includes('workspace:')) existing[duplicate] = item
  }
  pools.set(item.manifest.name, existing)
}
for (const file of listArchives(OFFICIAL_TARBALL_ROOT)) {
  const item = assertArchive(file)
  if (item.manifest.name.startsWith('@deepseek-ai/') || item.manifest.name === '@deepseek-ai/cordis' || item.manifest.name.startsWith('@deepseek-ai/cordis-')) add({ ...item, official: true })
}
const registryDirectories = [REGISTRY_ROOT, OLD_ROOT]
// Reuse immutable third-party archives captured by the other plugin fixture
// gates.  These are registry packages only; all DSH packages still come from
// the official Alpha.4 tarball set above.
if (existsSync(WORKSTATION_ROOT)) {
  for (const entry of readdirSync(WORKSTATION_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('dsh-')) continue
    if (resolve(join(WORKSTATION_ROOT, entry.name)) === ROOT) continue
    const pluginRoot = join(WORKSTATION_ROOT, entry.name, 'fixtures')
    registryDirectories.push(join(pluginRoot, 'alpha4', 'tarballs'))
  }
}
function tryArchive(file) {
  try { return assertArchive(file) }
  catch (error) {
    // A few historical fixtures were produced by tools that used a package
    // name as the archive root (rather than npm's `package/` root).  They are
    // not needed for runtime closure; ignore them while retaining strict
    // validation for every archive that enters the Alpha.4 graph.
    return undefined
  }
}
for (const directory of registryDirectories) {
  for (const file of listArchives(directory)) {
    const item = tryArchive(file)
    if (item === undefined) continue
    if (!item.manifest.name.startsWith('@deepseek-ai/') || item.manifest.version === ALPHA4 || item.manifest.name === '@deepseek-ai/cordis') add({ ...item, official: false })
  }
}
for (const file of [...listArchives(join(OWNER_ROOT, 'fixtures', 'alpha4', 'tarballs')), ...listArchives(join(MODEL_ROOT, 'fixtures', 'alpha4', 'tarballs')), ...listArchives(OWNER_ROOT)]) {
  if (!existsSync(file)) continue
  const item = tryArchive(file)
  if (item === undefined) continue
  if (item.manifest.name === 'dsh-llm-providers-ui' || item.manifest.name === 'dsh-model-switch') add({ ...item, official: false })
}

const rootManifest = json(join(ROOT, 'package.json'), 'root package.json')
const rootKey = packageKey(rootManifest.name, rootManifest.version)
mkdirSync(TARBALL_ROOT, { recursive: true })
const records = new Map()
const edges = []
const queue = [{ key: rootKey, name: rootManifest.name, version: rootManifest.version, manifest: rootManifest, root: true }]
const processed = new Set()
const choose = (name, range) => (pools.get(name) ?? []).filter(item => range === null || satisfies(item.manifest.version, resolveWorkspace(name, range))).sort((left, right) => compareVersion(right.manifest.version, left.manifest.version))
const copy = item => {
  const destination = join(TARBALL_ROOT, archiveName(item.manifest.name, item.manifest.version))
  if (!existsSync(destination) || hash(destination, 'sha256') !== hash(item.file, 'sha256')) run('cp', ['--', item.file, destination])
  return destination
}
const addDependency = (parent, field, name, rawRange) => {
  // Local development archives are deliberately copied into the fixture graph
  // instead of preserving a checkout-relative `file:` path.  Treat those
  // specs as an unconstrained request for the matching captured package.
  const localArchive = typeof rawRange === 'string' && (/^(?:file|link|workspace):/u.test(rawRange) || rawRange.startsWith('https://github.com/NOirBRight/'))
  const range = localArchive ? null : resolveWorkspace(name, rawRange)
  const candidates = choose(name, range)
  if (candidates.length === 0) {
    const optional = field === 'optionalDependencies' || parent.manifest.peerDependenciesMeta?.[name]?.optional === true
    if (optional) return
    fail('no fixture satisfies ' + parent.key + ' -> ' + name + ' ' + String(rawRange))
  }
  const item = candidates[0]
  const childKey = packageKey(item.manifest.name, item.manifest.version)
  edges.push({ from: parent.key, to: childKey, dependency: name, section: field, specifier: rawRange, optional: field === 'optionalDependencies' || parent.manifest.peerDependenciesMeta?.[name]?.optional === true })
  copy(item)
  if (!processed.has(childKey)) queue.push({ key: childKey, name: item.manifest.name, version: item.manifest.version, manifest: item.manifest, file: item.file, official: item.official })
}
while (queue.length > 0) {
  const parent = queue.shift()
  if (parent === undefined || processed.has(parent.key)) continue
  processed.add(parent.key)
  if (!parent.root) records.set(parent.key, parent)
  for (const field of DEPENDENCY_FIELDS) for (const [name, range] of Object.entries(parent.manifest[field] ?? {})) addDependency(parent, field, name, range)
  if (parent.root) {
    for (const [name, range] of Object.entries(parent.manifest.devDependencies ?? {})) {
      if (name === 'dsh-llm-providers-ui' || name === 'dsh-model-switch') addDependency(parent, 'devDependencies', name, range)
    }
  }
  // Runtime imports are intentionally not used to expand the graph.  npm
  // package manifests are the authoritative resolver inputs; undeclared
  // imports are package defects, not a reason to smuggle unrelated archives
  // into a portable fixture.  Keeping the graph manifest-driven also avoids
  // extracting large archives containing hard-link members.
}

mkdirSync(TARBALL_ROOT, { recursive: true })
const files = readdirSync(TARBALL_ROOT).filter(file => file.endsWith('.tgz'))
for (const file of files) {
  const item = assertArchive(join(TARBALL_ROOT, file))
  if (item.manifest.name.startsWith('@deepseek-ai/dsh-') && item.manifest.version !== ALPHA4) fail('non-Alpha.4 DSH archive copied: ' + file)
  if (item.manifest.name === '@deepseek-ai/cordis' && item.manifest.version !== '4.0.2') fail('non-4.0.2 Cordis archive copied: ' + file)
}
const packages = [...records.values()].map(item => {
  const file = join(TARBALL_ROOT, archiveName(item.name, item.version))
  return {
    name: item.name,
    version: item.version,
    file: basename(file),
    bytes: statSync(file).size,
    sha256: hash(file, 'sha256'),
    sha512: 'sha512-' + hash(file, 'sha512', 'base64'),
    source: item.official ? { kind: 'official-alpha4', repository: REPOSITORY, tag: TAG, commit: COMMIT } : { kind: 'npm-registry', registry: 'https://registry.npmjs.org', integrity: 'sha512-' + hash(file, 'sha512', 'base64') },
  }
}).sort((left, right) => packageKey(left.name, left.version).localeCompare(packageKey(right.name, right.version)))
const dedupeEdges = [...new Map(edges.map(edge => [JSON.stringify(edge), edge])).values()].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
rmSync(FIXTURE_ROOT, { recursive: true, force: true })
mkdirSync(TARBALL_ROOT, { recursive: true })
for (const record of packages) {
  const source = join(ROOT, 'fixtures', 'alpha4', 'tarballs', record.file)
  // The copy was made before the provenance reset; recover it from the pool.
  const candidate = [...(pools.get(record.name) ?? [])].find(item => item.manifest.version === record.version)
  if (candidate === undefined) fail('provenance package has no source: ' + packageKey(record.name, record.version))
  run('cp', ['--', candidate.file, source])
}
writeFileSync(join(FIXTURE_ROOT, 'provenance.json'), JSON.stringify({
  format: 1,
  purpose: 'Alpha.4 offline fixture graph for ' + rootManifest.name,
  officialCheckout: { repository: REPOSITORY, tag: TAG, commit: COMMIT },
  roots: [rootKey],
  packages,
  edges: dedupeEdges,
}, null, 2) + '\n')
writeFileSync(join(FIXTURE_ROOT, 'README.md'), '# Alpha.4 fixture\n\nGenerated from the official Alpha.4 checkout and immutable registry archives.\n')
// Keep a self tarball beside the fixture for checkout-local devDependencies
// (the provenance graph intentionally starts at the plugin's runtime roots).
// This also gives sibling plugins a stable owner artifact without `link:` or
// source checkout paths during their pack gates.
const rootPackTemp = join('/tmp', 'dsh-alpha4-root-pack-' + process.pid)
mkdirSync(rootPackTemp, { recursive: true })
const rootPackResult = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', rootPackTemp]))
if (!Array.isArray(rootPackResult) || rootPackResult.length !== 1 || typeof rootPackResult[0].filename !== 'string') fail('npm pack did not produce the root development artifact')
run('cp', ['--', join(rootPackTemp, rootPackResult[0].filename), join(TARBALL_ROOT, archiveName(rootManifest.name, rootManifest.version))])
console.log('prepared Alpha.4 fixture: ' + packages.length + ' archives, ' + dedupeEdges.length + ' edges')
