/** Magic-byte sniffing for the image tools. */
import type { ImageMediaType } from '@deepseek-ai/dsh-attachment';
/** Detect PNG, JPEG, WebP, or GIF from a leading signature. */
export declare function mediaTypeOf(data: Uint8Array): ImageMediaType | undefined;
//# sourceMappingURL=image-bytes.d.ts.map