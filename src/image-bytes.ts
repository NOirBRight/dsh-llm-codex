/** Magic-byte sniffing for the image tools. */

import type { ImageMediaType } from '@deepseek-ai/dsh-attachment'

/** Detect PNG, JPEG, WebP, or GIF from a leading signature. */
export function mediaTypeOf(data: Uint8Array): ImageMediaType | undefined {
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47
    && data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a) return 'image/png'
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg'
  if (data.length >= 6) {
    const signature = String.fromCharCode(...data.subarray(0, 6))
    if (signature === 'GIF87a' || signature === 'GIF89a') return 'image/gif'
  }
  if (data.length >= 12
    && String.fromCharCode(...data.subarray(0, 4)) === 'RIFF'
    && String.fromCharCode(...data.subarray(8, 12)) === 'WEBP') return 'image/webp'
  return undefined
}
