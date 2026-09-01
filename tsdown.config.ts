import type { UserConfig } from 'tsdown'

const PACKAGE_ID = 'dsh-llm-codex'

const host: UserConfig = {
  name: PACKAGE_ID,
  entry: ['lib/types/index.js', 'lib/types/invariant.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  deps: {
    neverBundle: [
      '@deepseek-ai/cordis',
      '@deepseek-ai/schemastery',
      '@deepseek-ai/dsh-agent',
      '@deepseek-ai/dsh-atomic-write',
      '@deepseek-ai/dsh-attachment',
      '@deepseek-ai/dsh-client-connection',
      '@deepseek-ai/dsh-fs',
      '@deepseek-ai/dsh-home-paths',
      '@deepseek-ai/dsh-host-webserver',
      '@deepseek-ai/dsh-invariants',
      '@deepseek-ai/dsh-launch-environment',
      '@deepseek-ai/dsh-llm',
      '@deepseek-ai/dsh-llm-pi-ai',
      '@deepseek-ai/dsh-session',
      '@deepseek-ai/dsh-settings',
      '@deepseek-ai/dsh-timeout',
      '@deepseek-ai/dsh-tools',
      '@deepseek-ai/dsh-web',
      '@earendil-works/pi-ai',
      'dsh-model-switch',
    ],
  },
}

const client: UserConfig = {
  name: `${PACKAGE_ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  dts: false,
  clean: false,
  deps: {
    neverBundle: [
      'react',
      'react/jsx-runtime',
      'react-dom',
      '@deepseek-ai/cordis',
      '@deepseek-ai/dsh-client-connection/client',
      '@deepseek-ai/dsh-client-locale/client',
      '@deepseek-ai/dsh-client-ui-settings-plugins/client',
      '@deepseek-ai/dsh-client-ui-slots',
    ],
    alwaysBundle: (id) => id === 'dsh-llm-providers-ui/sortable',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default ({ env }: Pick<UserConfig, 'env'>): UserConfig[] => {
  const face = env?.DSH_BUILD_FACE
  if (face === 'host') return [host]
  if (face === 'client') return [client]
  if (face !== undefined) throw new Error(`unknown DSH build face: ${String(face)}`)
  return [host, client]
}
