/**
 * Isolated Codex Responses client for hosted image_generation.
 * Protocol can change without touching the DSH tool surface.
 */
export declare const CODEX_RESPONSES_URL: string;
export declare const CODEX_IMAGE_ORIGINATOR = "deepseek-harness";
export declare const CODEX_IMAGE_BETA = "responses=experimental";
export declare const CODEX_BACKEND_IMAGE_MODEL = "gpt-image-2";
export declare const CODEX_IMAGE_OUTPUT_FORMATS: readonly ["png", "jpeg", "webp"];
export type CodexImageOutputFormat = typeof CODEX_IMAGE_OUTPUT_FORMATS[number];
export interface CodexImageInput {
    readonly data: string;
    readonly mimeType: string;
}
export interface CodexImageGenerationBody {
    readonly model: string;
    readonly store: false;
    readonly stream: true;
    readonly prompt_cache_key: string;
    readonly instructions: string;
    readonly input: readonly [
        {
            readonly role: 'user';
            readonly content: readonly ({
                readonly type: 'input_text';
                readonly text: string;
            } | {
                readonly type: 'input_image';
                readonly image_url: string;
            })[];
        }
    ];
    readonly tools: readonly [{
        readonly type: 'image_generation';
        readonly output_format: CodexImageOutputFormat;
    }];
    readonly tool_choice: 'auto';
    readonly parallel_tool_calls: false;
    readonly text: {
        readonly verbosity: 'low';
    };
}
export interface CodexGeneratedImage {
    readonly id: string;
    readonly status: string;
    readonly bytes: Uint8Array;
    readonly revisedPrompt?: string;
    readonly responseId?: string;
}
export interface CodexImageRequest {
    readonly accessToken: string;
    readonly accountId: string;
    readonly model: string;
    readonly prompt: string;
    readonly outputFormat: CodexImageOutputFormat;
    readonly sessionId: string;
    readonly inputImages?: readonly CodexImageInput[];
    readonly signal?: AbortSignal;
    readonly fetchImpl?: typeof fetch;
    readonly retryDelayMs?: (attempt: number, retryAfter: string | null) => number;
}
/** Strip JWT-shaped secrets before an error message leaves the client. */
export declare function redactSecrets(text: string): string;
export declare function parseRetryAfter(value: string | null, nowMs?: number): number | undefined;
export declare function retryDelayMs(attempt: number, retryAfter: string | null, random?: () => number, nowMs?: number): number;
/** Build the hosted-tool Responses payload. tool_choice is always auto. */
export declare function buildImageGenerationBody(model: string, prompt: string, outputFormat: CodexImageOutputFormat, sessionId: string, inputImages?: readonly CodexImageInput[]): CodexImageGenerationBody;
/** Decode and sniff Codex image_generation_call base64 without a recursive regex. */
export declare function decodeImageData(base64Data: string): Uint8Array;
/** POST /codex/responses with hosted image_generation and parse the SSE image. */
export declare function requestCodexImage(request: CodexImageRequest): Promise<CodexGeneratedImage>;
//# sourceMappingURL=image-generation-client.d.ts.map