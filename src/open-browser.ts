/** Open an http(s) URL in the system browser, matching Cursor/Grok. */

import { spawn } from 'node:child_process'

function spawnDetached(command: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore', detached: true })
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

/** Open the authorize URL in the system browser. */
export async function openSystemBrowser(url: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('refusing to open an invalid url')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('refusing to open a non-http url')
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new Error('refusing to open a url with credentials')
  }
  const launchers: Array<{ command: string, args: readonly string[] }> = process.platform === 'darwin'
    ? [{ command: 'open', args: [url] }]
    : process.platform === 'win32'
      ? [{ command: 'cmd', args: ['/c', 'start', '', url] }]
      : [{ command: 'xdg-open', args: [url] }, { command: 'sensible-open', args: [url] }]
  let last: unknown
  for (const launcher of launchers) {
    try {
      await spawnDetached(launcher.command, launcher.args)
      return
    } catch (error) {
      last = error
    }
  }
  throw last instanceof Error ? last : new Error('could not open a system browser')
}
