import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { ModelSwitchAdapterRegistry, ModelSwitchGeneratedImage, ModelSwitchProviderAdapters } from 'dsh-model-switch/adapter-registry'
import { resolveCodexAccessToken } from './adapter.ts'
import type { CodexSearchContextSize, CodexSearchMode } from './client-contract.ts'
import { generateImageTool } from './generate-image.ts'
import { CodexSearchProvider } from './search.ts'
import type { CodexCredentialStore } from './store.ts'

interface CodexModelSwitchSettings {
  readonly searchMode: CodexSearchMode
  readonly searchContextSize: CodexSearchContextSize
  readonly searchMaxOutputTokens: number
  readonly models: readonly { readonly id: string; readonly tools?: boolean; readonly vision?: boolean }[]
}
type GeneratedValue = { path: string; revisedPrompt?: string; image: { attachmentId: string; mediaType: string; bytes: number; width: number; height: number; name?: string } }
function generatedValue(value: unknown): GeneratedValue {
  if (typeof value !== 'object' || value === null) throw new Error('Codex image adapter returned no metadata')
  const result = value as Partial<GeneratedValue>
  if (typeof result.path !== 'string' || typeof result.image !== 'object' || result.image === null) throw new Error('Codex image adapter returned invalid metadata')
  const image = result.image as Partial<GeneratedValue['image']>
  if (typeof image.attachmentId !== 'string' || typeof image.mediaType !== 'string' || typeof image.bytes !== 'number' || typeof image.width !== 'number' || typeof image.height !== 'number') throw new Error('Codex image adapter returned invalid image metadata')
  return result as GeneratedValue
}
function normalize(value: GeneratedValue): ModelSwitchGeneratedImage {
  return { path: value.path, mediaType: value.image.mediaType, width: value.image.width, height: value.image.height, bytes: value.image.bytes, attachmentId: value.image.attachmentId, ...(value.image.name === undefined ? {} : { name: value.image.name }), ...(value.revisedPrompt === undefined ? {} : { revisedPrompt: value.revisedPrompt }) }
}

declare module '@deepseek-ai/cordis' { interface Context { modelSwitch: { readonly adapters: ModelSwitchAdapterRegistry } } }

/** Optional Search/Image integration; standalone Codex behavior is unchanged when Model Switch is absent. */
export function installCodexModelSwitchAdapters(
  ctx: Context,
  credentials: CodexCredentialStore,
  settings: () => CodexModelSwitchSettings | undefined,
): void {
  let imageContext: Context | undefined
  ctx.inject(['attachments', 'fs'], scope => { imageContext = scope; return () => { if (imageContext === scope) imageContext = undefined } })
  const adapters: ModelSwitchProviderAdapters = {
    provider: 'codex',
    search: {
      provider: 'codex',
      supportsModel: model => settings()?.models.some(candidate => candidate.id === model && candidate.tools !== false) === true,
      async search(model, request, signal) {
        const current = settings()
        if (current === undefined) throw new Error('Codex settings are unavailable')
        return new CodexSearchProvider({
          credentials,
          model,
          mode: current.searchMode,
          contextSize: current.searchContextSize,
          maxOutputTokens: current.searchMaxOutputTokens,
          resolveRequestId: randomUUID,
        }).search(request, signal)
      },
    },
    image: {
      provider: 'codex',
      supportsModel: model => imageContext !== undefined && settings()?.models.some(candidate => candidate.id === model && candidate.vision !== false) === true,
      async generate(model, request, execution) {
        if (typeof execution !== 'object' || execution === null) throw new Error('image adapter requires public ToolRunContext')
        const toolExecution = execution as ToolRunContext
        if (imageContext === undefined) throw new Error('Codex image adapter requires attachments and fs')
        const tool = generateImageTool(imageContext, { resolveAccessToken: () => resolveCodexAccessToken(credentials), routingModel: () => model })
        return normalize(generatedValue(await tool.execute(request as never, toolExecution)))
      },
    },
  }
  ctx.inject(['modelSwitch'], scope => scope.effect(() => scope.modelSwitch.adapters.register(adapters), 'Model Switch: register Codex Search/Image adapters'))
}
