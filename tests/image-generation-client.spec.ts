import { describe, expect, it } from 'vitest'
import {
  CODEX_IMAGE_ORIGINATOR,
  CODEX_RESPONSES_URL,
  buildImageGenerationBody,
  decodeImageData,
  redactSecrets,
  requestCodexImage,
} from '../src/image-generation-client.ts'

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'

function sse(events: unknown[]): string {
  return events.map(event => 'data: ' + JSON.stringify(event) + '\n\n').join('')
}

function imageEvents(): unknown[] {
  return [
    { type: 'response.created', response: { id: 'resp_1' } },
    {
      type: 'response.output_item.done',
      item: {
        type: 'image_generation_call',
        id: 'ig_1',
        status: 'completed',
        result: PNG_B64,
        revised_prompt: 'a red pixel',
      },
    },
    { type: 'response.completed', response: { id: 'resp_1' } },
  ]
}

describe('buildImageGenerationBody', () => {
  it('requests hosted image_generation with tool_choice auto', () => {
    const body = buildImageGenerationBody('gpt-5.6-luna', 'a lamp', 'png', 'session-1')
    expect(body.tool_choice).toBe('auto')
    expect(body.tools).toEqual([{ type: 'image_generation', output_format: 'png' }])
    expect(body).not.toHaveProperty('size')
    expect(body).not.toHaveProperty('quality')
    expect(body.input[0]?.content[0]).toEqual({ type: 'input_text', text: 'a lamp' })
  })

  it('attaches reference images as input_image data URLs', () => {
    const body = buildImageGenerationBody('gpt-5.5', 'edit this', 'png', 's', [
      { data: 'abc', mimeType: 'image/png' },
    ])
    expect(body.input[0]?.content[1]).toEqual({
      type: 'input_image',
      image_url: 'data:image/png;base64,abc',
    })
  })
})

describe('decodeImageData', () => {
  it('accepts a PNG and rejects junk', () => {
    expect(mediaTypeHint(decodeImageData(PNG_B64))).toBe('png')
    expect(() => decodeImageData('@@@@')).toThrow(/invalid base64/)
  })

  it('does not overflow the stack on megabyte-scale base64', () => {
    const padding = 'A'.repeat(2_000_000)
    expect(() => decodeImageData(padding)).toThrow(/not PNG, JPEG, or WebP|invalid base64/)
  })
})

function mediaTypeHint(bytes: Uint8Array): string {
  return bytes[0] === 0x89 ? 'png' : 'other'
}

describe('redactSecrets', () => {
  it('strips JWT-shaped tokens', () => {
    expect(redactSecrets('fail eyJhbGciOiJub25lIn0.eyJhIjoiYiJ9.sig done')).toContain('[REDACTED]')
    expect(redactSecrets('fail eyJhbGciOiJub25lIn0.eyJhIjoiYiJ9.sig done')).not.toMatch(/eyJ/)
  })
})

describe('requestCodexImage', () => {
  it('posts to /codex/responses and returns sniffed image bytes', async () => {
    const calls: Array<{ url: string, init: RequestInit }> = []
    const generated = await requestCodexImage({
      accessToken: 'token',
      accountId: 'acct',
      model: 'gpt-5.6-luna',
      prompt: 'a lamp',
      outputFormat: 'png',
      sessionId: 'sess',
      retryDelayMs: () => 0,
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} })
        return new Response(sse(imageEvents()), {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      },
    })
    expect(calls[0]?.url).toBe(CODEX_RESPONSES_URL)
    const headers = new Headers(calls[0]?.init.headers)
    expect(headers.get('originator')).toBe(CODEX_IMAGE_ORIGINATOR)
    expect(headers.get('chatgpt-account-id')).toBe('acct')
    expect(JSON.parse(String(calls[0]?.init.body)).tool_choice).toBe('auto')
    expect(generated.id).toBe('ig_1')
    expect(generated.revisedPrompt).toBe('a red pixel')
    expect(generated.bytes[0]).toBe(0x89)
  })

  it('retries a 429 then succeeds', async () => {
    let attempts = 0
    const generated = await requestCodexImage({
      accessToken: 'token',
      accountId: 'acct',
      model: 'gpt-5.6-luna',
      prompt: 'a lamp',
      outputFormat: 'png',
      sessionId: 'sess',
      retryDelayMs: () => 0,
      fetchImpl: async () => {
        attempts += 1
        if (attempts === 1) return new Response('rate limited', { status: 429 })
        return new Response(sse(imageEvents()), { status: 200 })
      },
    })
    expect(attempts).toBe(2)
    expect(generated.id).toBe('ig_1')
  })

  it('redacts JWTs in HTTP error bodies', async () => {
    await expect(requestCodexImage({
      accessToken: 'token',
      accountId: 'acct',
      model: 'gpt-5.6-luna',
      prompt: 'a lamp',
      outputFormat: 'png',
      sessionId: 'sess',
      retryDelayMs: () => 0,
      fetchImpl: async () => new Response('denied eyJhbGciOiJub25lIn0.eyJhIjoiYiJ9.sig', { status: 400 }),
    })).rejects.toThrow(/\[REDACTED\]/)
  })

  it('throws when the stream has text but no image_generation_call', async () => {
    await expect(requestCodexImage({
      accessToken: 'token',
      accountId: 'acct',
      model: 'gpt-5.6-luna',
      prompt: 'a lamp',
      outputFormat: 'png',
      sessionId: 'sess',
      retryDelayMs: () => 0,
      fetchImpl: async () => new Response(sse([
        { type: 'response.output_text.delta', delta: 'cannot draw that' },
        { type: 'response.completed', response: { id: 'resp_1' } },
      ]), { status: 200 }),
    })).rejects.toThrow(/cannot draw that/)
  })
})
