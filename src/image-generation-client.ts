/**
 * Isolated Codex Responses client for hosted image_generation.
 * Protocol can change without touching the DSH tool surface.
 */

import { CODEX_BASE_URL } from './search.ts'
import { mediaTypeOf } from './image-bytes.ts'

export const CODEX_RESPONSES_URL = CODEX_BASE_URL + '/responses'
export const CODEX_IMAGE_ORIGINATOR = 'deepseek-harness'
export const CODEX_IMAGE_BETA = 'responses=experimental'
export const CODEX_BACKEND_IMAGE_MODEL = 'gpt-image-2'

const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu
const MAX_ATTEMPTS = 4
const BASE_DELAY_MS = 1_000
const MAX_RETRY_DELAY_MS = 30_000
const INSTRUCTIONS = 'You are generating bitmap image assets. For this request, call the image_generation tool exactly once. Do not answer with only text unless image generation is unavailable.'

export const CODEX_IMAGE_OUTPUT_FORMATS = ['png', 'jpeg', 'webp'] as const
export type CodexImageOutputFormat = typeof CODEX_IMAGE_OUTPUT_FORMATS[number]

export interface CodexImageInput {
  readonly data: string
  readonly mimeType: string
}

export interface CodexImageGenerationBody {
  readonly model: string
  readonly store: false
  readonly stream: true
  readonly prompt_cache_key: string
  readonly instructions: string
  readonly input: readonly [{
    readonly role: 'user'
    readonly content: readonly (
      | { readonly type: 'input_text'; readonly text: string }
      | { readonly type: 'input_image'; readonly image_url: string }
    )[]
  }]
  readonly tools: readonly [{ readonly type: 'image_generation'; readonly output_format: CodexImageOutputFormat }]
  readonly tool_choice: 'auto'
  readonly parallel_tool_calls: false
  readonly text: { readonly verbosity: 'low' }
}

export interface CodexGeneratedImage {
  readonly id: string
  readonly status: string
  readonly bytes: Uint8Array
  readonly revisedPrompt?: string
  readonly responseId?: string
}

export interface CodexImageRequest {
  readonly accessToken: string
  readonly accountId: string
  readonly model: string
  readonly prompt: string
  readonly outputFormat: CodexImageOutputFormat
  readonly sessionId: string
  readonly inputImages?: readonly CodexImageInput[]
  readonly signal?: AbortSignal
  readonly fetchImpl?: typeof fetch
  readonly retryDelayMs?: (attempt: number, retryAfter: string | null) => number
}

interface ParsedCodexResponse {
  image?: { id: string; status: string; result: string; revisedPrompt?: string }
  text: string[]
  responseId?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Strip JWT-shaped secrets before an error message leaves the client. */
export function redactSecrets(text: string): string {
  return text.replace(JWT, '[REDACTED]').slice(0, 1000)
}

function isRetryableStatus(status: number, errorText: string): boolean {
  if ([429, 500, 502, 503, 504].includes(status)) return true
  return /rate.?limit|overloaded|service.?unavailable|upstream.?connect|connection.?refused/iu.test(errorText)
}

export function parseRetryAfter(value: string | null, nowMs = Date.now()): number | undefined {
  if (value === null) return undefined
  const trimmed = value.trim()
  if (/^\d+(?:\.\d+)?$/u.test(trimmed)) {
    const milliseconds = Number(trimmed) * 1000
    return Number.isFinite(milliseconds) ? Math.min(milliseconds, MAX_RETRY_DELAY_MS) : undefined
  }
  const dateMs = Date.parse(trimmed)
  if (!Number.isFinite(dateMs) || dateMs <= nowMs) return undefined
  return Math.min(dateMs - nowMs, MAX_RETRY_DELAY_MS)
}

export function retryDelayMs(
  attempt: number,
  retryAfter: string | null,
  random = Math.random,
  nowMs = Date.now(),
): number {
  const serverDelay = parseRetryAfter(retryAfter, nowMs)
  if (serverDelay !== undefined) {
    return Math.floor(Math.min(serverDelay * (1 + random() * 0.1), MAX_RETRY_DELAY_MS))
  }
  const exponential = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS)
  return Math.floor(exponential * (0.9 + random() * 0.2))
}

function abortableDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted === true) return Promise.reject(new Error('Image generation was aborted.'))
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(finish, milliseconds)
    const abort = (): void => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      reject(new Error('Image generation was aborted.'))
    }
    function finish(): void {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      resolve()
    }
    signal?.addEventListener('abort', abort, { once: true })
  })
}

/** Build the hosted-tool Responses payload. tool_choice is always auto. */
export function buildImageGenerationBody(
  model: string,
  prompt: string,
  outputFormat: CodexImageOutputFormat,
  sessionId: string,
  inputImages: readonly CodexImageInput[] = [],
): CodexImageGenerationBody {
  return {
    model,
    store: false,
    stream: true,
    prompt_cache_key: sessionId,
    instructions: INSTRUCTIONS,
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: prompt },
        ...inputImages.map(image => ({
          type: 'input_image' as const,
          image_url: 'data:' + image.mimeType + ';base64,' + image.data,
        })),
      ],
    }],
    tools: [{ type: 'image_generation', output_format: outputFormat }],
    tool_choice: 'auto',
    parallel_tool_calls: false,
    text: { verbosity: 'low' },
  }
}

function parseSseDataLines(chunk: string): string | undefined {
  const data = chunk
    .split('\n')
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trim())
    .join('\n')
    .trim()
  return data.length > 0 && data !== '[DONE]' ? data : undefined
}

function handleCodexEvent(event: unknown, parsed: ParsedCodexResponse): void {
  if (!isRecord(event) || typeof event['type'] !== 'string') return
  switch (event['type']) {
    case 'error': {
      const message = typeof event['message'] === 'string'
        ? event['message']
        : typeof event['code'] === 'string' ? event['code'] : JSON.stringify(event)
      throw new Error('Codex error: ' + redactSecrets(message))
    }
    case 'response.failed': {
      const response = isRecord(event['response']) ? event['response'] : undefined
      const error = response !== undefined && isRecord(response['error']) ? response['error'] : undefined
      const message = error !== undefined && typeof error['message'] === 'string'
        ? error['message']
        : 'Codex response failed.'
      throw new Error(redactSecrets(message))
    }
    case 'response.created': {
      const response = isRecord(event['response']) ? event['response'] : undefined
      if (response !== undefined && typeof response['id'] === 'string') parsed.responseId = response['id']
      break
    }
    case 'response.output_text.delta': {
      if (typeof event['delta'] === 'string') parsed.text.push(event['delta'])
      break
    }
    case 'response.output_item.done': {
      const item = isRecord(event['item']) ? event['item'] : undefined
      if (item === undefined || item['type'] !== 'image_generation_call') break
      if (typeof item['result'] !== 'string' || item['result'].length === 0) {
        throw new Error('Codex image_generation_call did not contain image data.')
      }
      parsed.image = {
        id: typeof item['id'] === 'string' && item['id'].length > 0 ? item['id'] : 'image_generation',
        status: typeof item['status'] === 'string' && item['status'].length > 0 ? item['status'] : 'completed',
        result: item['result'],
        ...typeof item['revised_prompt'] === 'string' ? { revisedPrompt: item['revised_prompt'] } : {},
      }
      break
    }
    case 'response.completed': {
      const response = isRecord(event['response']) ? event['response'] : undefined
      if (response !== undefined && typeof response['id'] === 'string') parsed.responseId = response['id']
      break
    }
  }
}

async function parseCodexSse(response: Response, signal?: AbortSignal): Promise<ParsedCodexResponse> {
  if (response.body === null) throw new Error('Codex response did not include a stream body.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const parsed: ParsedCodexResponse = { text: [] }
  try {
    while (true) {
      if (signal?.aborted === true) throw new Error('Image generation was aborted.')
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let separator = buffer.indexOf('\n\n')
      while (separator !== -1) {
        const chunk = buffer.slice(0, separator)
        buffer = buffer.slice(separator + 2)
        const data = parseSseDataLines(chunk)
        if (data !== undefined) handleCodexEvent(JSON.parse(data) as unknown, parsed)
        separator = buffer.indexOf('\n\n')
      }
    }
    const remaining = parseSseDataLines(buffer)
    if (remaining !== undefined) handleCodexEvent(JSON.parse(remaining) as unknown, parsed)
  } finally {
    try {
      await reader.cancel()
    } catch {
      // stream may already be closed
    }
    reader.releaseLock()
  }
  return parsed
}

/** Decode and sniff Codex image_generation_call base64 without a recursive regex. */
export function decodeImageData(base64Data: string): Uint8Array {
  const value = base64Data.trim()
  if (value.length === 0) throw new Error('Codex returned invalid base64 image data.')
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    const ok = (code >= 65 && code <= 90)
      || (code >= 97 && code <= 122)
      || (code >= 48 && code <= 57)
      || code === 43
      || code === 47
      || code === 61
    if (!ok) throw new Error('Codex returned invalid base64 image data.')
  }
  const bytes = Buffer.from(value, 'base64')
  if (bytes.length === 0) throw new Error('Codex returned invalid base64 image data.')
  if (mediaTypeOf(bytes) === undefined) {
    throw new Error('Codex returned image data that is not PNG, JPEG, or WebP.')
  }
  return bytes
}

/** POST /codex/responses with hosted image_generation and parse the SSE image. */
export async function requestCodexImage(request: CodexImageRequest): Promise<CodexGeneratedImage> {
  const body = JSON.stringify(buildImageGenerationBody(
    request.model,
    request.prompt,
    request.outputFormat,
    request.sessionId,
    request.inputImages ?? [],
  ))
  const headers = {
    authorization: 'Bearer ' + request.accessToken,
    'chatgpt-account-id': request.accountId,
    originator: CODEX_IMAGE_ORIGINATOR,
    'OpenAI-Beta': CODEX_IMAGE_BETA,
    accept: 'text/event-stream',
    'content-type': 'application/json',
  }
  const fetchImpl = request.fetchImpl ?? globalThis.fetch
  const delay = request.retryDelayMs ?? retryDelayMs

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (request.signal?.aborted === true) throw new Error('Image generation was aborted.')
    const response = await fetchImpl(CODEX_RESPONSES_URL, {
      method: 'POST',
      redirect: 'error',
      headers,
      body,
      ...request.signal === undefined ? {} : { signal: request.signal },
    })
    if (!response.ok) {
      const errorText = redactSecrets(await response.text())
      if (attempt < MAX_ATTEMPTS && isRetryableStatus(response.status, errorText)) {
        await abortableDelay(delay(attempt, response.headers.get('retry-after')), request.signal)
        continue
      }
      const suffix = errorText.length > 0 ? ': ' + errorText : ''
      const message = 'Codex image generation request failed (HTTP ' + String(response.status) + ')' + suffix
      throw new Error(
        response.status === 401 || response.status === 403
          ? message + '; sign in again'
          : message,
      )
    }
    const parsed = await parseCodexSse(response, request.signal)
    if (parsed.image === undefined) {
      const text = parsed.text.join('').trim()
      throw new Error(text.length > 0
        ? 'Codex did not return an image. Response text: ' + redactSecrets(text)
        : 'Codex did not return an image.')
    }
    const bytes = decodeImageData(parsed.image.result)
    return {
      id: parsed.image.id,
      status: parsed.image.status,
      bytes,
      ...parsed.image.revisedPrompt === undefined ? {} : { revisedPrompt: parsed.image.revisedPrompt },
      ...parsed.responseId === undefined ? {} : { responseId: parsed.responseId },
    }
  }
  throw new Error('Codex image generation request failed after all retries.')
}
