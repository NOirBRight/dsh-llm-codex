import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LocalAttachmentStore from '@deepseek-ai/dsh-attachment-local'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import { LlmRuntime, ToolCallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import WebRuntime from '@deepseek-ai/dsh-web'
import * as Codex from '../src/index.ts'
import { generateImageTool } from '../src/generate-image.ts'

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64')
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'
const signal = new AbortController().signal

let workspace: string
let dshHome: string
let ctx: Context | undefined
let callCounter = 0

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'dsh-llm-codex-generate-image-'))
  dshHome = await mkdtemp(join(tmpdir(), 'dsh-llm-codex-generate-image-home-'))
})

afterEach(async () => {
  await ctx?.fiber.dispose()
  ctx = undefined
  await rm(workspace, { recursive: true, force: true })
  await rm(dshHome, { recursive: true, force: true })
})

function jwt(accountId = 'acct_1'): string {
  const header = Buffer.from('{"alg":"none"}').toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    'https://api.openai.com/auth': { chatgpt_account_id: accountId },
  })).toString('base64url')
  return header + '.' + payload + '.sig'
}

function sse(events: unknown[]): string {
  return events.map(event => 'data: ' + JSON.stringify(event) + '\n\n').join('')
}

function imageResponse(): Response {
  return new Response(sse([
    {
      type: 'response.output_item.done',
      item: { type: 'image_generation_call', id: 'ig_1', status: 'completed', result: PNG_B64 },
    },
    { type: 'response.completed', response: { id: 'resp_1' } },
  ]), { status: 200 })
}

async function setupRuntime(): Promise<Context> {
  const context = new Context()
  ctx = context
  await context.plugin(SystemPrompt)
  await context.plugin(ToolRuntime, { mode: 'native' })
  await context.plugin(LocalFileSystem, { cwd: workspace })
  await context.plugin(LocalAttachmentStore, { dshHome })
  await context.plugin(LlmRuntime)
  await context.plugin(WebRuntime)
  return context
}

function agentOn(model = 'gpt-5.6-sol'): object {
  return {
    options: {},
    session: {
      id: 'session-1',
      header: { cwd: workspace },
      requestHeader: () => ({ config: { provider: Codex.CODEX_PROVIDER, model } }),
      append: () => undefined,
    },
  }
}

describe('codex_generate_image registration', () => {
  it('does not register the tool when enableImageGeneration is off', async () => {
    const context = await setupRuntime()
    await context.plugin(Codex, { enableImageGeneration: false })
    expect(context.tools.get(Codex.GENERATE_IMAGE_TOOL_NAME)).toBeUndefined()
  })

  it('registers the tool when enableImageGeneration is on', async () => {
    const context = await setupRuntime()
    await context.plugin(Codex, { enableImageGeneration: true })
    expect(context.tools.get(Codex.GENERATE_IMAGE_TOOL_NAME)?.name).toBe('codex_generate_image')
  })
})

describe('codex_generate_image execute', () => {
  it('saves an attachment and a workspace file', async () => {
    const context = await setupRuntime()
    context.tools.register(generateImageTool(context, {
      resolveAccessToken: async () => jwt(),
      routingModel: () => 'gpt-5.6-luna',
      retryDelayMs: () => 0,
      fetchImpl: async () => imageResponse(),
    }))

    const result = await context.tools.execute({
      signal,
      callId: ToolCallId('generate-image-' + String(++callCounter)),
      name: Codex.GENERATE_IMAGE_TOOL_NAME,
      arguments: { prompt: 'a red pixel' },
      agent: agentOn() as never,
    })

    expect(result.isError).toBe(false)
    expect(result.content.some(block => block.type === 'image')).toBe(true)
    const text = result.content.find(block => block.type === 'text')
    expect(text?.type === 'text' ? text.text : '').toContain('generated-images/')
    const written = await readFile(join(workspace, 'generated-images', 'ig_1.png'))
    expect(written.equals(PNG_1X1)).toBe(true)
  })

  it('loads a local source image as an edit input', async () => {
    const context = await setupRuntime()
    await writeFile(join(workspace, 'pixel.png'), PNG_1X1)
    let body = ''
    context.tools.register(generateImageTool(context, {
      resolveAccessToken: async () => jwt(),
      routingModel: () => 'gpt-5.6-luna',
      retryDelayMs: () => 0,
      fetchImpl: async (_url, init) => {
        body = String(init?.body ?? '')
        return imageResponse()
      },
    }))

    const result = await context.tools.execute({
      signal,
      callId: ToolCallId('generate-image-' + String(++callCounter)),
      name: Codex.GENERATE_IMAGE_TOOL_NAME,
      arguments: { prompt: 'make it blue', source: 'pixel.png' },
      agent: agentOn() as never,
    })

    expect(result.isError).toBe(false)
    expect(body).toContain('input_image')
    expect(body).toContain(PNG_B64)
  })

  it('treats a blank source as a new image, not an edit', async () => {
    const context = await setupRuntime()
    let body = ''
    context.tools.register(generateImageTool(context, {
      resolveAccessToken: async () => jwt(),
      routingModel: () => 'gpt-5.6-luna',
      retryDelayMs: () => 0,
      fetchImpl: async (_url, init) => {
        body = String(init?.body ?? '')
        return imageResponse()
      },
    }))

    const result = await context.tools.execute({
      signal,
      callId: ToolCallId('generate-image-' + String(++callCounter)),
      name: Codex.GENERATE_IMAGE_TOOL_NAME,
      arguments: { prompt: 'a red pixel', source: '   ' },
      agent: agentOn() as never,
    })

    expect(result.isError).toBe(false)
    expect(body).not.toContain('input_image')
  })

  it('refuses Spark as the routing model', async () => {
    const context = await setupRuntime()
    context.tools.register(generateImageTool(context, {
      resolveAccessToken: async () => jwt(),
      routingModel: () => 'gpt-5.3-codex-spark',
      fetchImpl: async () => { throw new Error('fetch should not run') },
    }))

    const result = await context.tools.execute({
      signal,
      callId: ToolCallId('generate-image-' + String(++callCounter)),
      name: Codex.GENERATE_IMAGE_TOOL_NAME,
      arguments: { prompt: 'a lamp' },
      agent: agentOn() as never,
    })

    expect(result.isError).toBe(true)
    expect(result.content.find(block => block.type === 'text')?.text).toContain('does not declare image input')
  })

  it('fails when ChatGPT is signed out', async () => {
    const context = await setupRuntime()
    context.tools.register(generateImageTool(context, {
      resolveAccessToken: async () => {
        throw new Error('llm-codex: not signed in; sign in with ChatGPT from Plugin configuration')
      },
      routingModel: () => 'gpt-5.6-luna',
      fetchImpl: async () => { throw new Error('fetch should not run') },
    }))

    const result = await context.tools.execute({
      signal,
      callId: ToolCallId('generate-image-' + String(++callCounter)),
      name: Codex.GENERATE_IMAGE_TOOL_NAME,
      arguments: { prompt: 'a lamp' },
      agent: agentOn() as never,
    })

    expect(result.isError).toBe(true)
    expect(result.content.find(block => block.type === 'text')?.text).toMatch(/not signed in|sign in/i)
  })

  it('presents the prompt on the pending card', async () => {
    const context = await setupRuntime()
    await context.plugin(Codex, { enableImageGeneration: true })
    const definition = context.tools.get(Codex.GENERATE_IMAGE_TOOL_NAME)
    expect(definition?.presentCall?.({ prompt: 'a lamp', path: 'hero.png' })).toMatchObject({
      kind: 'other',
      rawInput: 'a lamp',
      locations: [{ path: 'hero.png' }],
    })
  })
})
