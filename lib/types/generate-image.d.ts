/** Model-invoked `codex_generate_image` tool over ChatGPT Codex OAuth. */
import type { Context } from '@deepseek-ai/cordis';
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
export declare const GENERATE_IMAGE_TOOL_NAME = "codex_generate_image";
export interface GenerateImageToolOptions {
    resolveAccessToken: () => Promise<string>;
    routingModel: () => string;
    fetchImpl?: typeof fetch;
    retryDelayMs?: (attempt: number, retryAfter: string | null) => number;
}
export declare function resolveImageGenerationRoutingModel(model: string): string;
export declare function generateImageTool(ctx: Context, options: GenerateImageToolOptions): ToolDefinition;
//# sourceMappingURL=generate-image.d.ts.map