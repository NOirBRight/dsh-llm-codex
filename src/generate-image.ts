/** Model-invoked `codex_generate_image` tool over ChatGPT Codex OAuth. */

import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { ImageAttachmentRef, ImageMediaType } from '@deepseek-ai/dsh-attachment'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolDefinition, ToolExecution } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-fs'
import { chatgptAccountIdFromToken } from './chatgpt-account.ts'
import { officialModelFor, parseCodexPickerId } from './catalog.ts'
import { mediaTypeOf } from './image-bytes.ts'
import {
  CODEX_BACKEND_IMAGE_MODEL,
  CODEX_IMAGE_OUTPUT_FORMATS,
  requestCodexImage,
} from './image-generation-client.ts'
import type { CodexImageInput, CodexImageOutputFormat } from './image-generation-client.ts'
import { fetchPublicHttpResource } from './public-http.ts'

export const GENERATE_IMAGE_TOOL_NAME = 'codex_generate_image'

export interface GenerateImageToolOptions {
  resolveAccessToken: () => Promise<string>
  routingModel: () => string
  fetchImpl?: typeof fetch
  retryDelayMs?: (attempt: number, retryAfter: string | null) => number
}

interface GenerateImageValue {
  path: string
  prompt: string
  revisedPrompt?: string
  routingModel: string
  backendImageModel: string
  saveWarning?: string
  image: {
    attachmentId: string
    mediaType: ImageMediaType
    bytes: number
    width: number
    height: number
    name?: string
  }
}

function refOf(image: GenerateImageValue['image']): ImageAttachmentRef {
  return {
    attachmentId: AttachmentId(image.attachmentId),
    mediaType: image.mediaType,
    bytes: image.bytes,
    width: image.width,
    height: image.height,
    ...image.name === undefined ? {} : { name: image.name },
  }
}

function contentOf(value: GenerateImageValue): ContentBlock[] {
  const lines = [
    '<path>' + value.path + '</path>',
    '<image>' + value.image.mediaType + ', ' + String(value.image.width) + 'x' + String(value.image.height)
      + ' px, ' + String(value.image.bytes) + ' bytes</image>',
    '<backend>' + value.backendImageModel + ' via ' + value.routingModel + '</backend>',
  ]
  if (value.revisedPrompt !== undefined) lines.push('<revised_prompt>' + value.revisedPrompt + '</revised_prompt>')
  if (value.saveWarning !== undefined) lines.push('<warning>' + value.saveWarning + '</warning>')
  return [
    { type: 'text', text: lines.join('\n') },
    { type: 'image', attachment: refOf(value.image) },
  ]
}

function extensionOf(format: CodexImageOutputFormat): string {
  return format === 'jpeg' ? 'jpg' : format
}

function sanitizeFilePart(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]+/gu, '_').replace(/^_+|_+$/gu, '')
  return cleaned.length > 0 ? cleaned.slice(0, 80) : 'image'
}

/** Models often send "" for omitted optional strings. Treat blank as absent. */
function optionalText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

export function resolveImageGenerationRoutingModel(model: string): string {
  const trimmed = model.trim()
  if (trimmed.length === 0) {
    throw new Error('codex_generate_image has no routing model; choose a vision-capable official Codex model in Plugin configuration')
  }
  const wireId = parseCodexPickerId(trimmed).wireId
  const official = officialModelFor(wireId)
  if (official !== undefined && official.vision === false) {
    throw new Error('codex_generate_image cannot use "' + trimmed + '": that Codex model does not declare image input. Choose a vision-capable official model in Plugin configuration.')
  }
  return wireId
}

async function loadSource(
  ctx: Context,
  exec: ToolExecution,
  source: string,
  maxBytes: number,
): Promise<CodexImageInput> {
  const trimmed = source.trim()
  if (trimmed.length === 0) throw new Error('codex_generate_image source must not be empty')
  let data: Uint8Array
  if (/^https?:\/\//iu.test(trimmed)) {
    data = (await fetchPublicHttpResource(trimmed, maxBytes, exec.signal)).data
  } else {
    const cwd = exec.agent?.session.header.cwd
    const target = await ctx.fs.resolve(trimmed, { ...cwd === undefined ? {} : { cwd }, signal: exec.signal })
    const info = await ctx.fs.stat(target, exec.signal)
    if (info === undefined) throw new Error('image path does not exist: ' + trimmed)
    if (info.type !== 'file') throw new Error('image path is not a regular file: ' + trimmed)
    data = await ctx.fs.readBytes(target, exec.signal, maxBytes)
    ctx.emit('fs/observed', target, { kind: 'present', version: info.version }, exec)
  }
  const mediaType = mediaTypeOf(data)
  if (mediaType === undefined) throw new Error('codex_generate_image source must be PNG, JPEG, WebP, or GIF')
  return { data: Buffer.from(data).toString('base64'), mimeType: mediaType }
}

async function writeGeneratedFile(
  ctx: Context,
  exec: ToolExecution,
  relativePath: string,
  bytes: Uint8Array,
): Promise<string> {
  const cwd = exec.agent?.session.header.cwd
  const target = await ctx.fs.resolve(relativePath, { ...cwd === undefined ? {} : { cwd }, signal: exec.signal })
  const processPath = ctx.fs.processPath(target)
  await mkdir(dirname(processPath), { recursive: true })
  await writeFile(processPath, bytes)
  const info = await ctx.fs.stat(target, exec.signal)
  if (info !== undefined) ctx.emit('fs/observed', target, { kind: 'present', version: info.version }, exec)
  return target.displayPath
}

export function generateImageTool(ctx: Context, options: GenerateImageToolOptions): ToolDefinition {
  return defineTool({
    name: GENERATE_IMAGE_TOOL_NAME,
    description: 'Generate or edit a raster image with ChatGPT Codex (gpt-image-2 on the Codex subscription). Uses the plugin\'s ChatGPT login; consumes Codex usage (typically 3-5x a text turn). Distinct from other providers\' generate_image tools. For a new image, pass only prompt (and optional path). Omit source; never send an empty source string. Do not call unless the user asked for a bitmap image.',
    parameters: {
      prompt: {
        type: 'string',
        required: true,
        description: 'Image prompt. Be specific about subject, composition, style, text, and constraints.',
      },
      path: {
        type: 'string',
        description: 'Workspace-relative destination. Defaults to generated-images/<id>.<ext> under the session cwd.',
      },
      outputFormat: {
        type: 'string',
        enum: [...CODEX_IMAGE_OUTPUT_FORMATS],
        description: 'png (default), jpeg, or webp.',
      },
      source: {
        type: 'string',
        description: 'Local path or http(s) URL of one reference image to edit. Omit this field entirely for a new image. Do not pass an empty string.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          prompt: { type: 'string', required: true },
          revisedPrompt: { type: 'string' },
          routingModel: { type: 'string', required: true },
          backendImageModel: { type: 'string', required: true },
          saveWarning: { type: 'string' },
          image: {
            type: 'object',
            required: true,
            additionalProperties: false,
            properties: {
              attachmentId: { type: 'string', required: true },
              mediaType: { type: 'string', required: true, enum: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] },
              bytes: { type: 'integer', required: true },
              width: { type: 'integer', required: true },
              height: { type: 'integer', required: true },
              name: { type: 'string' },
            },
          },
        },
      },
      render: (_args, value) => contentOf(value),
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const prompt = args.prompt.trim()
      if (prompt.length === 0) throw new Error('codex_generate_image prompt must not be empty')
      const outputFormat = args.outputFormat ?? 'png'
      const routingModel = resolveImageGenerationRoutingModel(options.routingModel())
      const accessToken = await options.resolveAccessToken()
      const accountId = chatgptAccountIdFromToken(accessToken)
      const attachments = ctx.attachments
      const maxBytes = Math.min(attachments.imageLimits.maxImageBytes, attachments.imageLimits.maxMessageImageBytes)
      const source = optionalText(args.source)
      const inputImages = source === undefined
        ? []
        : [await loadSource(ctx, exec, source, maxBytes)]
      const sessionId = typeof exec.agent?.session.id === 'string' && exec.agent.session.id.length > 0
        ? exec.agent.session.id
        : String(exec.callId)
      const generated = await requestCodexImage({
        accessToken,
        accountId,
        model: routingModel,
        prompt,
        outputFormat,
        sessionId,
        inputImages,
        signal: exec.signal,
        ...options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl },
        ...options.retryDelayMs === undefined ? {} : { retryDelayMs: options.retryDelayMs },
      })
      const mediaType = mediaTypeOf(generated.bytes)
      if (mediaType === undefined) throw new Error('Codex returned image data that is not PNG, JPEG, or WebP.')
      if (!attachments.imageLimits.mediaTypes.includes(mediaType)) {
        throw new Error(mediaType + ' images are disabled by this deployment')
      }
      const defaultName = sanitizeFilePart(generated.id) + '.' + extensionOf(outputFormat)
      const relativePath = args.path === undefined || args.path.trim().length === 0
        ? 'generated-images/' + defaultName
        : args.path.trim()
      const ref = await attachments.saveImage({
        data: generated.bytes,
        mediaType,
        name: basename(relativePath),
      })
      let path = relativePath
      let saveWarning: string | undefined
      try {
        path = await writeGeneratedFile(ctx, exec, relativePath, generated.bytes)
      } catch (error: unknown) {
        saveWarning = 'Image generation succeeded, but the image could not be saved to disk: '
          + (error instanceof Error && error.message.length > 0 ? error.message : String(error))
      }
      const value: GenerateImageValue = {
        path,
        prompt,
        routingModel,
        backendImageModel: CODEX_BACKEND_IMAGE_MODEL,
        image: {
          attachmentId: ref.attachmentId,
          mediaType: ref.mediaType,
          bytes: ref.bytes,
          width: ref.width,
          height: ref.height,
          ...ref.name === undefined ? {} : { name: ref.name },
        },
        ...generated.revisedPrompt === undefined ? {} : { revisedPrompt: generated.revisedPrompt },
        ...saveWarning === undefined ? {} : { saveWarning },
      }
      if (exec.parent !== undefined) {
        exec.deferContext(createUserMessage({
          content: contentOf(value),
          source: { kind: 'plugin', plugin: 'dsh-llm-codex' },
        }))
      }
      return value
    },
    presentCall: args => ({
      card: 'generic',
      title: 'Codex image: ' + args.prompt,
      kind: 'other',
      rawInput: args.prompt,
      ...args.path === undefined || args.path.trim().length === 0
        ? {}
        : { locations: [{ path: args.path }] },
    }),
  })
}
