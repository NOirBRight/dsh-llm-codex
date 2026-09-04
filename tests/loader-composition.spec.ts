/**
 * Real-composition guard: LlmRuntime and llm-codex boot from a test-only
 * cordis.yml through Loader + Include. The public provider is `codex`, the
 * settings namespace is llm-codex, and the schema does not name apiKeyEnv.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import * as LlmCodex from '../src/index.ts'
import { Config } from '../src/index.ts'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

async function loadComposition(): Promise<{ ctx: Context }> {
  root = await mkdtemp(join(tmpdir(), 'dsh-llm-codex-comp-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    '- id: llm',
    "  name: 'test-llm-service'",
    '- id: llm-codex',
    "  name: 'dsh-llm-codex'",
    '  config:',
    '    retryPolicy:',
    '      mode: normal',
    '      maxRetries: 8',
    '',
  ].join('\n'))

  const ctx = new Context()
  context = ctx
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['test-llm-service', LlmRuntime],
    ['dsh-llm-codex', LlmCodex],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await ctx.loader.await()
  return { ctx }
}

describe('llm-codex real composition', () => {
  it('boots from cordis.yml as provider codex without apiKeyEnv', async () => {
    const { ctx } = await loadComposition()

    expect(LlmCodex.name).toBe('llm-codex')
    expect(LlmCodex.inject).toEqual(['llm'])
    expect(ctx.llm.listConfigurableProviders()).toEqual([
      { provider: 'codex', displayName: 'Codex', settingsNs: 'llm-codex', settingsPath: [] },
    ])
    expect(ctx.llm.listProviders()).toEqual([{ id: 'codex', name: 'Codex' }])
    expect(ctx.llm.providerRetryPolicy('codex')).toMatchObject({
      mode: 'normal',
      maxRetries: 8,
      retryableCodes: expect.arrayContaining(['AUTH']),
    })

    const schema = Config.toJSON() as { uid: number, refs: Record<string, { dict?: Record<string, unknown> }> }
    const dict = schema.refs[String(schema.uid)]?.dict
    expect(dict).toBeDefined()
    expect(dict).not.toHaveProperty('apiKeyEnv')
    expect(dict).not.toHaveProperty('remoteManagement')
    expect(dict).toHaveProperty('enableSearch')
    expect(dict).toHaveProperty('enableImageTool')
    expect(dict).toHaveProperty('enableImageGeneration')
    expect(dict).toHaveProperty('searchModel')
    expect(dict).toHaveProperty('imageGenerationModel')
    expect(ctx.tools?.get(LlmCodex.VIEW_IMAGE_TOOL_NAME)).toBeUndefined()
    expect(ctx.tools?.get(LlmCodex.GENERATE_IMAGE_TOOL_NAME)).toBeUndefined()
  })
})
