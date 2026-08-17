import { execFileSync } from 'node:child_process'

const output = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
})
const reportStart = output.lastIndexOf('\n[') + 1
const report = JSON.parse(output.slice(reportStart))[0]
if (report === undefined || !Array.isArray(report.files)) throw new Error('npm pack returned no file report')
const files = new Set(report.files.map(file => file.path))
const required = [
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
for (const file of required) {
  if (!files.has(file)) throw new Error(`packed plugin is missing ${file}`)
}
for (const file of files) {
  if (/^(?:src|tests|scripts|node_modules)\//u.test(file)
    || /(?:^|\/)\.env(?:\.|$)/u.test(file)
    || /(?:credential|token|auth\.json)/iu.test(file)) {
    throw new Error(`packed plugin contains forbidden path ${file}`)
  }
}
console.log(`pack check passed: ${String(files.size)} files`)
